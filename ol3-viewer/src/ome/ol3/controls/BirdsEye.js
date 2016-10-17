goog.provide('ome.ol3.controls.BirdsEye');

goog.require('ol.control.OverviewMap');

/**
 * @classdesc
 * Extends the built OverviewMap
 *
 * @constructor
 * @extends {ol.control.OverviewMap}
 * @param {Object} opt_options optional options
 */
ome.ol3.controls.BirdsEye = function(opt_options) {
    if (typeof(opt_options) !== 'object')
        opt_options = {};
    opt_options.render = ome.ol3.controls.BirdsEye.render.bind(this);
    goog.base(this, opt_options);

    this.singleBoxClick = null;
    this.lastBoxCoordinate = null;

    this.ovmap_.addInteraction(new ol.interaction.Pointer({
        handleDownEvent : function(event) {
            if (!(event instanceof ol.MapBrowserPointerEvent) ||
                this.clickedIntoBox(event.pixel)) return false;

                var boxDims = this.getBoxDims();
                var newCenterOfBox =
                    [event.pixel[0] - boxDims[0] / 2,
                     event.pixel[1] + boxDims[1] / 2
                 ];

                 this.singleBoxClick = true;
                 this.boxOverlay_.setPosition(
                     this.ovmap_.getCoordinateFromPixel(newCenterOfBox));

                this.getMap().getView().setCenter(
                    this.ovmap_.getCoordinateFromPixel(event.pixel));

            return false;
      }.bind(this),
        handleMoveEvent : function(event) {
            if (!(event instanceof ol.MapBrowserPointerEvent) ||
                !(event.originalEvent instanceof MouseEvent) ||
                event.originalEvent.buttons === 0) return;

            if (this.clickedIntoBox(event.pixel) ||
                this.lastBoxCoordinate !== null)
                this.lastBoxCoordinate = event.pixel;
            else return;

            var boxDims = this.getBoxDims();
            var newCenterOfBox =
                [event.pixel[0] - boxDims[0] / 2,
                 event.pixel[1] + boxDims[1] / 2
             ];

            this.boxOverlay_.setPosition(
                this.ovmap_.getCoordinateFromPixel(newCenterOfBox));
      }.bind(this)}));

      // this is unfortunately necessary
      // since the mouse up event is not bubbling up
      this.onUpEvent =
          ol.events.listen(
              this.ovmap_.getTarget(),
              ol.events.EventType.MOUSEUP,
              function(event) {
                  if (this.lastBoxCoordinate === null) return;

                  var newCoord =
                    this.ovmap_.getCoordinateFromPixel(this.lastBoxCoordinate);
                  this.getMap().getView().setCenter(newCoord);
                  this.lastBoxCoordinate = null;
              }, this);
}
goog.inherits(ome.ol3.controls.BirdsEye, ol.control.OverviewMap);

/**
 * Overridden to add projection to view
 * @param {ol.Map} map
 */
ome.ol3.controls.BirdsEye.prototype.setMap = function(map) {
  var oldMap = this.getMap();
  if (map === oldMap) {
    return;
  }
  if (oldMap) {
    var oldView = oldMap.getView();
    if (oldView) {
      this.unbindView_(oldView);
    }
  }
  ol.control.Control.prototype.setMap.call(this, map);

  if (map) {
     this.ovmap_.getView().projection_ =
        map.getView().getProjection();

    this.listenerKeys.push(ol.events.listen(
        map, ol.ObjectEventType.PROPERTYCHANGE,
        this.handleMapPropertyChange_, this));

    if (this.ovmap_.getLayers().getLength() === 0) {
        //this.ovmap_.setLayerGroup(map.getLayerGroup());
        map.getLayers().forEach(
            function(layer) {
                if (layer instanceof ol.layer.Tile)
                    this.ovmap_.addLayer(layer);
            }.bind(this));
    }

    var view = map.getView();
    if (view) {
      this.bindView_(view);
      if (view.isDef()) {
        this.ovmap_.updateSize();
        this.resetExtent_();
      }
    }
  }
};

/**
 * Overridden to suppress updates when loading tiles still
 * @param {ol.MapEvent} mapEvent Map event.
 * @this {ol.control.OverviewMap}
 */
ome.ol3.controls.BirdsEye.render = function(mapEvent) {
    if (this.lastBoxCoordinate !== null || this.singleBoxClick) {
        this.singleBoxClick = false;
        return;
    };
    this.validateExtent_();
    this.updateBox_();
};
/**
 * Gets the width and height of the box in the birds eye view
 *
 * @return {Array<number>} the dimension of the box
 */
ome.ol3.controls.BirdsEye.prototype.getBoxDims = function() {
    var el = this.boxOverlay_.getElement();
    var tmp = [
        ol.dom.outerWidth(el),
        ol.dom.outerHeight(el)
    ];
    // in IE we get a NaN because the method calls parseInt on margin left
    // which is 'auto'
    if (isNaN(tmp[0]) || isNaN(tmp[1]))
        tmp = [el.offsetWidth, el.offsetHeight];

    return tmp;
}

/**
 * Checks if a given x/y coordinate is within the box of the birds eye view
 *
 * @return {boolean} true if the given coordinates fall into the box
 */
ome.ol3.controls.BirdsEye.prototype.clickedIntoBox = function(coords) {
    var offset =
        this.ovmap_.getPixelFromCoordinate(this.boxOverlay_.getPosition())
    var boxDims = this.getBoxDims();
    var extent =
        [offset[0], offset[1] - boxDims[1], offset[0] + boxDims[0], offset[1]];
    return ol.extent.containsCoordinate(extent, coords);
}

/**
 * sort of destructor
 */
ome.ol3.controls.BirdsEye.prototype.disposeInternal = function() {
    if (typeof(this.onUpEvent) !== 'undefined' &&
    			this.onUpEvent)
    		ol.events.unlistenByKey(this.onUpEvent);

    goog.base(this, 'disposeInternal');
    if (this.ovmap_) this.ovmap_.dispose();
};
