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
    * @type {ol.Map}
    * @private
    */
    this.birds_eye_ = options['map'];

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

    // TODO: adjust interaction section
    var scope = this;
    var overlay = this.boxOverlay_;
    var overlayBox = this.boxOverlay_.getElement();
    var computeDesiredMousePosition = function(mousePosition) {
        return {
            clientX: mousePosition.clientX - (overlayBox.offsetWidth / 2),
            clientY: mousePosition.clientY + (overlayBox.offsetHeight / 2)
        };
    };

    var birdsEye = this.birds_eye_;
    var move = function(event) {
        var coordinates =
            birdsEye.getEventCoordinate(computeDesiredMousePosition(event));
        overlay.setPosition(coordinates);
    };
    var endMoving = function(event) {
        var coordinates = birdsEye.getEventCoordinate(event);
        scope.getMap().getView().setCenter(coordinates);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', endMoving);
    };

    overlayBox.addEventListener('mousedown', function() {
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', endMoving);
    });
};
ol.inherits(ome.ol3.controls.BirdsEye, ol.control.Control);


/**
 * Listens to map changes
 */
ome.ol3.controls.BirdsEye.prototype.setMap = function(map) {
    if (map) ol.control.Control.prototype.setMap.call(this, map);
    // TODO:  listen to map changes (zoom, rotation)
};


/**
 * Update the bird eye view
 * @param {ol.MapEvent} mapEvent Map event.
 * @this {ome.ol3.controls.BirdsEye}
 */
ome.ol3.controls.BirdsEye.render = function(mapEvent) {
    this.updateBox_();
};


/**
 * Updates the box overlay
 * @private
 */
ome.ol3.controls.BirdsEye.prototype.updateBox_ = function() {
    var map = this.getMap();
    if (!map.isRendered() || !this.birds_eye_.isRendered()) return;

    var mapSize = map.getSize();
    var view = map.getView();
    var ovview = this.birds_eye_.getView();
    var rotation = view.getRotation();
    var overlay = this.boxOverlay_;
    var box = this.boxOverlay_.getElement();
    var extent = view.calculateExtent(mapSize);
    var ovresolution = ovview.getResolution();
    var bottomLeft = ol.extent.getBottomLeft(extent);
    var topRight = ol.extent.getTopRight(extent);

    // set position using bottom left coordinates
    var rotateBottomLeft = this.calculateCoordinateRotate_(rotation, bottomLeft);
    overlay.setPosition(rotateBottomLeft);

    // set box size calculated from map extent size and overview map resolution
    if (box) {
        box.style.width = Math.abs((bottomLeft[0] - topRight[0]) / ovresolution) + 'px';
        box.style.height = Math.abs((topRight[1] - bottomLeft[1]) / ovresolution) + 'px';
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

        if (!this.collapsed_ && !this.birds_eye_.isRendered()) {
            ol.events.listenOnce(this.birds_eye_, ol.MapEventType.POSTRENDER,
                function(event) {
                    this.updateBox_();
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
