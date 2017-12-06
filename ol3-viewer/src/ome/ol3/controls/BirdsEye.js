//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
goog.provide('ome.ol3.controls.BirdsEye');

/**
 * Altered version of ol.control.OverviewMap:
 * - The image used for the birds eye is the thumbnail of the image viewed.
 * - The birds eye view remains fixed in size (no adjustment for zooms)
 *
 * @constructor
 * @extends {ol.control.Control}
 * @param {Object=} options additional (optional) options (e.g. collapsed)
 */
ome.ol3.controls.BirdsEye = function(options) {

    options = options || {};

    /**
     * @type {boolean}
     * @private
     */
    this.collapsed_ = options.collapsed !== undefined ? options.collapsed : true;

    /**
     * @private
     * @type {Node}
     */
    this.collapseLabel_ = document.createElement('span');
    this.collapseLabel_.textContent = '\u00AB';

    /**
     * @private
     * @type {Node}
     */
    this.label_ = document.createElement('span');
    this.label_.textContent = '\u00BB';

    var activeLabel = !this.collapsed_ ? this.collapseLabel_ : this.label_;
    var button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.appendChild(activeLabel);
    ol.events.listen(button, ol.events.EventType.CLICK, this.handleClick_, this);

    /**
     * @type {Element}
     * @private
     */
    this.controlDiv_ = document.createElement('DIV');
    this.controlDiv_.className = 'ol-overviewmap-map';

    /**
    * @type {string}
    * @private
    */
    this.thumbnail_url_ = options['url'];

    /**
    * @type {number}
    * @private
    */
    this.thumbnail_revision_ = 0;

    /**
    * @type {Array.<number>}
    * @private
    */
    this.full_image_size_ = options['size'];

    /**
    * @type {Array.<number>}
    * @private
    */
    this.thumbnail_size_ = [150, 100];
    var fullSidesRatio = this.full_image_size_[0] / this.full_image_size_[1];
    var tmp = [
        this.thumbnail_size_[0],
        parseInt(this.thumbnail_size_[0] / fullSidesRatio)
    ];
    if (tmp[1] > this.thumbnail_size_[1]) {
        var factor = this.thumbnail_size_[1] / tmp[1];
        this.thumbnail_size_ = [
            parseInt(this.thumbnail_size_[0] * factor),
            this.thumbnail_size_[1]
        ];
    }

    /**
    * @type {Array.<number>}
    * @private
    */
    this.ratio_ = [
        this.thumbnail_size_[0] / this.full_image_size_[0],
        this.thumbnail_size_[1] / this.full_image_size_[1],
    ];

    /**
    * @type {ol.PluggableMap}
    * @private
    */
    this.birds_eye_ = this.initOrUpdate();

    var box = document.createElement('DIV');
    box.className = 'ol-overviewmap-box';
    box.style.boxSizing = 'border-box';

    /**
    * @type {ol.Overlay}
    * @private
    */
    this.boxOverlay_ = new ol.Overlay({
        position: [0, 0],
        positioning: ol.OverlayPositioning.BOTTOM_LEFT,
        element: box
    });
    this.birds_eye_.addOverlay(this.boxOverlay_);

    var element = document.createElement('div');
    element.className =
        'ol-overviewmap  ' + ol.css.CLASS_UNSELECTABLE + ' ' +
        ol.css.CLASS_CONTROL + (this.collapsed_ ? ' ol-collapsed' : '');
    element.appendChild(this.controlDiv_);
    element.appendChild(button);

    ol.control.Control.call(this, {
        element: element,
        render: ome.ol3.controls.BirdsEye.render,
        target: options.target
    });

    this.singleBoxClick = null;
    this.lastBoxCoordinate_ = null;

    this.birds_eye_.addInteraction(new ol.interaction.Pointer({
        handleDownEvent : function(event) {
            if (!(event instanceof ol.MapBrowserPointerEvent) ||
                this.clickedIntoBox(event.pixel)) return false;

            var boxDims = this.getBoxDims();
            var newCenterOfBox =
                [event.pixel[0] - boxDims[0] / 2,
                event.pixel[1] + boxDims[1] / 2
            ];

            this.boxOverlay_.setPosition(
                this.birds_eye_.getCoordinateFromPixel(newCenterOfBox));

            this.getMap().getView().setCenter(
                this.convertBirdsEyeCoords(
                    this.birds_eye_.getCoordinateFromPixel(event.pixel)));

            return false;
        }.bind(this),
        handleMoveEvent : function(event) {
            if (!(event instanceof ol.MapBrowserPointerEvent) ||
                !(event.originalEvent instanceof MouseEvent) ||
                event.originalEvent.buttons === 0) return;

            if (this.clickedIntoBox(event.pixel)) {
                if (this.lastBoxCoordinate_ === null) {
                    var position =
                        this.birds_eye_.getPixelFromCoordinate(
                            this.boxOverlay_.getPosition());

                    this.clickDistance_ = [
                        event.pixel[0] - position[0],
                        event.pixel[1] - position[1],
                    ];
                }

                this.singleBoxClick = true;
                this.lastBoxCoordinate_ = [
                    event.pixel[0] - this.clickDistance_[0],
                    event.pixel[1] - this.clickDistance_[1]
                ];
                this.boxOverlay_.setPosition(
                    this.birds_eye_.getCoordinateFromPixel(
                        this.lastBoxCoordinate_));
            }
        }.bind(this),
    }));

    // this is unfortunately necessary
    // since the mouse up event is not bubbling up
    this.onUpEvent =
        ol.events.listen(
            this.birds_eye_.getTarget(),
            ol.events.EventType.MOUSEUP,
            function(event) {
                if (this.lastBoxCoordinate_ === null) return;

                var boxDims = this.getBoxDims();
                var newCenter = [
                    this.lastBoxCoordinate_[0] + boxDims[0] / 2,
                    this.lastBoxCoordinate_[1] - boxDims[1] / 2
                ];
                this.getMap().getView().setCenter(
                    this.convertBirdsEyeCoords(
                        this.birds_eye_.getCoordinateFromPixel(newCenter)));
                this.lastBoxCoordinate_ = null;
                this.clickDistance_ = null;
            }, this);
};
ol.inherits(ome.ol3.controls.BirdsEye, ol.control.Control);

/**
 * Converts the bird's eye coordinates to full image coordinates
 *
 * @param {Array.<number>} coords the bird's eye coords
 * @return {Array.<number>} the corresponsing full image coordinates
 */
ome.ol3.controls.BirdsEye.prototype.convertBirdsEyeCoords = function(coords) {
    return [coords[0] / this.ratio_[0], coords[1] / this.ratio_[1]];
}

/**
 * Sets map and rerenders/updates bird's eye view
 * @param {ol.PluggableMap} map
 */
ome.ol3.controls.BirdsEye.prototype.setMap = function(map) {
    if (map) {
        ol.control.Control.prototype.setMap.call(this, map);
        this.birds_eye_.updateSize();
        this.render();
    }
};

/**
 * Creates/Initializes a ol.PluggableMap that represents the bird's eye view
 * or merely updates it if one exists already
 * @return {ol.PluggableMap} the bird's eye view
 */
ome.ol3.controls.BirdsEye.prototype.initOrUpdate = function() {
    if (typeof update_only !== 'boolean') update_only = false;
    // determine thumbnail size
    var ext = [0, -this.thumbnail_size_[1], this.thumbnail_size_[0], 0];
    var proj = new ol.proj.Projection({
        code: 'BIRDSEYE',
        units: 'pixels',
        extent: ext.slice()
    });

    // replace layer if we have one already,
    // effectively updating the static image source
    if (this.birds_eye_ instanceof ol.PluggableMap &&
        this.birds_eye_.getLayers().getLength() >0) {
        this.thumbnail_revision_++;
        this.birds_eye_.getLayers().item(0).setSource(
            new ol.source.ImageStatic({
            url: this.getThumbnailUrlWithVersion(),
            projection: proj,
            imageExtent: ext}));
        return this.birds_eye_;
    }

    var view = new ol.View({
       projection: proj,
       center: ol.extent.getCenter(ext),
       resolutions : [1],
       resolution : 1
    });
    var imageLayer = new ol.layer.Image({
        source: new ol.source.ImageStatic({
        url: this.getThumbnailUrlWithVersion(),
        projection: proj,
        imageExtent: ext})
    });

    return new ol.PluggableMap({
        controls: new ol.Collection(),
        interactions: new ol.Collection(),
        renderer: ol.renderer.Type.CANVAS,
        layers: [imageLayer],
        view: view,
        target: this.controlDiv_
    });
}

/**
 * Gets the thumbnail url for requesting
 * @return {string} the thumbnail url including config id and version
 */
ome.ol3.controls.BirdsEye.prototype.getThumbnailUrlWithVersion = function() {
    var map = this.getMap();
    var conf =
        map ? ome.ol3.utils.Misc.getTargetId(map.getTargetElement()) : "";

    return this.thumbnail_url_ + "/?rev=" +
        conf + "-" + this.thumbnail_revision_;
}

/**
 * Update the bird eye view
 * @param {ol.MapEvent} mapEvent Map event.
 * @this {ome.ol3.controls.BirdsEye}
 */
ome.ol3.controls.BirdsEye.render = function(mapEvent) {
    if (this.lastBoxCoordinate_ !== null || this.singleBoxClick) {
        this.singleBoxClick = false;
        return;
    };
    this.updateBox_();
};


/**
 * Updates the box overlay
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.updateBox_ = function() {
    var map = this.getMap();
    if (!this.birds_eye_.isRendered()) return;

    var view = map.getView();
    var rotation = view.getRotation();
    this.birds_eye_.getView().setRotation(rotation);
    var extent =
        ol.extent.getForViewAndSize(
            view.getCenter(), view.getResolution(),
            0, map.getSize());
    var bottomLeft = ol.extent.getBottomLeft(extent);
    var topRight = ol.extent.getTopRight(extent);

    var rotatedBottomLeft = this.calculateCoordinateRotate_(rotation, bottomLeft);
    this.boxOverlay_.setPosition(
        [rotatedBottomLeft[0] * this.ratio_[0],
         rotatedBottomLeft[1] * this.ratio_[1]]);

    var box = this.boxOverlay_.getElement();
    if (box) {
        box.style.width = Math.abs((bottomLeft[0] - topRight[0]) * this.ratio_[0]) + 'px';
        box.style.height = Math.abs((topRight[1] - bottomLeft[1]) * this.ratio_[1]) + 'px';
    }
};


/**
 * @param {number} rotation Target rotation.
 * @param {ol.Coordinate} coordinate Coordinate.
 * @return {ol.Coordinate|undefined} Coordinate for rotation and center anchor.
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.calculateCoordinateRotate_ =
    function(rotation, coordinate) {
        var coordinateRotate;

        var map = this.getMap();
        var view = map.getView();

        var currentCenter = view.getCenter();

        if (currentCenter) {
            coordinateRotate = [
                coordinate[0] - currentCenter[0],
                coordinate[1] - currentCenter[1]
            ];
            ol.coordinate.rotate(coordinateRotate, rotation);
            ol.coordinate.add(coordinateRotate, currentCenter);
        }
        return coordinateRotate;
};


/**
 * @param {Event} event The event to handle
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.handleClick_ = function(event) {
    event.preventDefault();
    this.handleToggle_();
};


/**
 * Handles transition from collapsed to not collapsed and vice versa
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.handleToggle_ = function() {
    this.element.classList.toggle('ol-collapsed');
        if (this.collapsed_) {
            ol.dom.replaceNode(this.collapseLabel_, this.label_);
        } else {
            ol.dom.replaceNode(this.label_, this.collapseLabel_);
        }
        this.collapsed_ = !this.collapsed_;

        if (!this.collapsed_) {
            if (!this.birds_eye_.isRendered()) this.birds_eye_.updateSize();
            ol.events.listenOnce(
                this.birds_eye_, ol.MapEventType.POSTRENDER,
                function() {
                    try {
                        this.updateBox_();
                    } catch(ignored) {}
                }, this);
        }
};


/**
 * Toggles collapsed state of bird eye view
 * @param {boolean} collapsed if true bird eye view will be hidden
 */
ome.ol3.controls.BirdsEye.prototype.setCollapsed = function(collapsed) {
    if (this.collapsed_ === collapsed) return;
    this.handleToggle_();
};


/**
 * Returns the collapsed state of the bird eye view
 * @return {boolean} true if bird eye view is hidden, false otherwise.
 */
ome.ol3.controls.BirdsEye.prototype.getCollapsed = function() {
    return this.collapsed_;
};

/**
 * Gets the width and height of the box in the birds eye view
 *
 * @return {Array<number>} the dimension of the box
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.getBoxDims = function() {
    var el = this.boxOverlay_.getElement();
    var tmp = [
        ol.dom.outerWidth(el),
        ol.dom.outerHeight(el)
    ];

    // in IE we get a NaN because the method calls parseInt on margin left
    // which is 'auto'
    if (isNaN(tmp[0]) || isNaN(tmp[1])) tmp = [el.offsetWidth, el.offsetHeight];
    return tmp;
}

/**
 * Checks if a given x/y coordinate is within the box of the birds eye view
 *
 * @param {Array.<number>} coords a pair of coordinates
 * @return {boolean} true if the given coordinates fall into the box
 */
ome.ol3.controls.BirdsEye.prototype.clickedIntoBox = function(coords) {
    var offset =
        this.birds_eye_.getPixelFromCoordinate(this.boxOverlay_.getPosition());
    var boxDims = this.getBoxDims();
    var extent = [
        offset[0]-5, offset[1] - boxDims[1]-5,
        offset[0] + boxDims[0]+5, offset[1]+5
    ];
    return ol.extent.containsCoordinate(extent, coords);
}

/**
 * sort of destructor
 */
ome.ol3.controls.BirdsEye.prototype.disposeInternal = function() {
    if (typeof(this.onUpEvent) !== 'undefined' && this.onUpEvent)
        ol.events.unlistenByKey(this.onUpEvent);

    goog.base(this, 'disposeInternal');
    if (this.birds_eye_) this.birds_eye_.dispose();
};
