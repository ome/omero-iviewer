goog.provide('ome.ol3.controls.Zoom');

goog.require('ol');
goog.require('ol.events');
goog.require('ol.events.EventType');
goog.require('ol.animation');
goog.require('ol.control.Control');
goog.require('ol.css');
goog.require('ol.easing');


/**
 * @classdesc
 * A custom zoom control that displays the zoom with the possibility to
 * enter a number
 *
 * @constructor
 * @extends {ol.control.Control}
 * @param {olx.control.ZoomOptions=} opt_options Zoom options.
 */
ome.ol3.controls.Zoom = function(opt_options) {
    var options = opt_options ? opt_options : {};

    /**
    * @type {number}
    * @private
    */
    this.duration_ = options.duration !== undefined ? options.duration : 0;

    /**
    * @type {number}
    * @private
    */
    this.delta_ = options.delta === 'number' ? options.delta : 1;

    /**
    * @type {string}
    * @private
    */
    this.class_name_ =
        options.className === 'string' ? options.className : 'ol-zoom';

    var cssClasses =
        this.class_name_ + ' ' + ol.css.CLASS_UNSELECTABLE + ' ' +
            ol.css.CLASS_CONTROL;

    var element = document.createElement('div');
    element.className = cssClasses;
    element.appendChild(this.addZoomButton_(true));
    element.appendChild(this.addOneToOneButton_());
    element.appendChild(this.addDisplayField_());
    element.appendChild(this.addFitToExtentButton_());
    element.appendChild(this.addZoomButton_(false));

    ol.control.Control.call(this, {
        element: element,
        target: options.target
    });
};
ol.inherits(ome.ol3.controls.Zoom, ol.control.Control);

/**
 * Adds both, zoom in and out buttons
 * @param {boolean} zoom_in the in zoom button is added if true, otherwise out
 * @private
 */
ome.ol3.controls.Zoom.prototype.addZoomButton_ = function(zoom_in) {
    if (typeof zoom_in !== 'boolean') zoom_in = false;

    var label = zoom_in ? '+' : '\u2212';
    var title = 'Zoom ' + (zoom_in ? 'in' : 'out');

    var element = document.createElement('button');
    element.className = this.class_name_ + (zoom_in ? '-in' : '-out');
    element.setAttribute('type', 'button');
    element.title = title;
    element.appendChild(document.createTextNode(label));

    ol.events.listen(element, ol.events.EventType.CLICK,
        ome.ol3.controls.Zoom.prototype.handleClick_,
        this);

    return element;
};

/**
 * Adds an input field for zoom values for both, display and changing
 * @private
 */
ome.ol3.controls.Zoom.prototype.addDisplayField_ = function() {
    var zoomDisplayElement = document.createElement('input');
    zoomDisplayElement.className = this.class_name_ + '-display';
    zoomDisplayElement.setAttribute('type', 'input');
    ol.events.listen(
        zoomDisplayElement, "keyup",
        function(event) {
            if (event.keyCode === 13)
                this.changeResolution_(parseInt(zoomDisplayElement.value));
        },this);

    var percent = document.createElement('button');
    percent.className = 'ol-zoom-percent';
    percent.title = 'Click to apply Zoom Value';
    percent.appendChild(document.createTextNode("%"));
    ol.events.listen(
        percent, "click",
        function() {
            this.changeResolution_(parseInt(zoomDisplayElement.value));
        },this);

    var element = document.createElement('div');
    element.appendChild(zoomDisplayElement);
    element.appendChild(percent);

    return element;
}

/**
 * Changes the resolution to the given value
 * @param {number} value the new value
 * @private
 */
ome.ol3.controls.Zoom.prototype.changeResolution_ = function(value) {
    var map = this.getMap();
    var view = map ? map.getView() : null;
    if (view === null) return;

    if (!isNaN(value)) {
        if (value < 0 ) value = 0;
        var constrainedResolution =
            view.constrainResolution(1 / (value / 100), 0, 0);
            view.setResolution(constrainedResolution);
    }
    var zoomDisplayElement = document.getElementsByClassName('ol-zoom-display');
    if (zoomDisplayElement.length === 0) return;
    zoomDisplayElement[0].value = Math.round((1 / view.getResolution()) * 100);
}

/**
 * Adds a 1:1 zoom button
 * @private
 */
ome.ol3.controls.Zoom.prototype.addOneToOneButton_ = function() {
    var oneToOneElement = document.createElement('button');
    oneToOneElement.className = this.class_name_ + '-1-1';
    oneToOneElement.setAttribute('type', 'button');
    oneToOneElement.title = "Actual Size";
    oneToOneElement.appendChild(document.createTextNode("1:1"));
    ol.events.listen(oneToOneElement, ol.events.EventType.CLICK,
        function() {
            var map = this.getMap();
            var view = map ? map.getView() : null;
            if (view === null) return;
            view.setResolution(1);
            var ext = view.getProjection().getExtent();
            view.setCenter([(ext[2]-ext[0])/2, -(ext[3]-ext[1])/2]);
        }, this);

    return oneToOneElement;
};

/**
 * Adds a zoom button that will make the image fit into the viewing extent
 * @private
 */
ome.ol3.controls.Zoom.prototype.addFitToExtentButton_ = function() {
    var oneToOneElement = document.createElement('button');
    oneToOneElement.className = this.class_name_ + '-fit';
    oneToOneElement.setAttribute('type', 'button');
    oneToOneElement.title = "Zoom Image to Fit";
    oneToOneElement.appendChild(document.createTextNode("FIT"));
    ol.events.listen(oneToOneElement, ol.events.EventType.CLICK,
        function() {
            var map = this.getMap();
            var view = map ? map.getView() : null;
            if (view === null) return;

            var ext = view.getProjection().getExtent();
            view.fit([ext[0], -ext[3], ext[2], ext[1]], map.getSize());
        }, this);

    return oneToOneElement;
};

/**
 * @param {Event} event The event to handle
 * @private
 */
ome.ol3.controls.Zoom.prototype.handleClick_ = function(event) {
    event.preventDefault();

    var map = this.getMap();
    var view = map.getView();
    if (!view) return;

    var delta = event.target.className.indexOf("ol-zoom-out") !== -1 ? -1 : 1;
    var currentResolution = view.getResolution();
    if (currentResolution) {
        if (this.duration_ > 0) {
          map.beforeRender(ol.animation.zoom({
            resolution: currentResolution,
            duration: this.duration_,
            easing: ol.easing.easeOut
          }));
        }
        var newResolution = view.constrainResolution(currentResolution, delta);
        view.setResolution(newResolution);
    }
};
