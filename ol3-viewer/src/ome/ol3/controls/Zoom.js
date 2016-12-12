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

    var className =
        options.className !== undefined ? options.className : 'ol-zoom';

    var delta = options.delta !== undefined ? options.delta : 1;

    var zoomInLabel =
        options.zoomInLabel !== undefined ? options.zoomInLabel : '+';
    var zoomOutLabel =
        options.zoomOutLabel !== undefined ? options.zoomOutLabel : '\u2212';

    var zoomInTipLabel = options.zoomInTipLabel !== undefined ?
      options.zoomInTipLabel : 'Zoom in';
    var zoomOutTipLabel = options.zoomOutTipLabel !== undefined ?
      options.zoomOutTipLabel : 'Zoom out';

    var inElement = document.createElement('button');
    inElement.className = className + '-in';
    inElement.setAttribute('type', 'button');
    inElement.title = zoomInTipLabel;
    inElement.appendChild(
        typeof zoomInLabel === 'string' ?
            document.createTextNode(zoomInLabel) : zoomInLabel);

    ol.events.listen(inElement, ol.events.EventType.CLICK,
        ome.ol3.controls.Zoom.prototype.handleClick_.bind(this, delta));

    var zoomDisplayElement = document.createElement('input');
    zoomDisplayElement.className = className + '-display';
    zoomDisplayElement.setAttribute('type', 'input');
    // TODO: improve style and move to css
    zoomDisplayElement.style = 'width: 1.375em';
    // TODO: improve method to be more 'responsive' than change but not as
    // responsive as input
    ol.events.listen(
        zoomDisplayElement, "change",
        function() {
            var map = this.getMap();
            var view = map ? map.getView() : null;
            if (view === null) return;

            var constrainedResolution =
                 view.constrainResolution(
                     1 / (parseInt(zoomDisplayElement.value) / 100), 0, 0);
            view.setResolution(constrainedResolution);
            zoomDisplayElement.value =
                parseInt((1 / view.getResolution()) * 100);
        },this);

    var outElement = document.createElement('button');
    outElement.className = className + '-out';
    outElement.setAttribute('type', 'button');
    outElement.title = zoomOutTipLabel;
    outElement.appendChild(
        typeof zoomOutLabel === 'string' ?
            document.createTextNode(zoomOutLabel) : zoomOutLabel);

    ol.events.listen(outElement, ol.events.EventType.CLICK,
      ome.ol3.controls.Zoom.prototype.handleClick_.bind(this, -delta));

    var cssClasses = className + ' ' + ol.css.CLASS_UNSELECTABLE + ' ' +
      ol.css.CLASS_CONTROL;
    var element = document.createElement('div');
    element.className = cssClasses;
    element.appendChild(inElement);
    element.appendChild(zoomDisplayElement);
    element.appendChild(outElement);

    ol.control.Control.call(this, {
        element: element,
        target: options.target
    });

    /**
    * @type {number}
    * @private
    */
    this.duration_ = options.duration !== undefined ? options.duration : 0;

};
ol.inherits(ome.ol3.controls.Zoom, ol.control.Control);


/**
* @param {number} delta Zoom delta.
* @param {Event} event The event to handle
* @private
*/
ome.ol3.controls.Zoom.prototype.handleClick_ = function(delta, event) {
    event.preventDefault();
    this.zoomByDelta_(delta);
};


/**
* @param {number} delta Zoom delta.
* @private
*/
ome.ol3.controls.Zoom.prototype.zoomByDelta_ = function(delta) {
    var map = this.getMap();
    var view = map.getView();
    if (!view) return;

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
