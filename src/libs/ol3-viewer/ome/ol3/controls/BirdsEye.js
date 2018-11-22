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
import Control from 'ol/control/control';
import Pointer from "ol/interaction";
import Event from 'ol/events/event';
import EventType from 'ol/events/eventtype';
import MapEventType from "ol/mapeventtype";
import OverlayPositioning from "ol/overlaypositioning";
import Collection from 'ol/collection';
import ImageStatic from 'ol/source/imagestatic';
import Projection from 'ol/proj/projection';
import Overlay from "ol/overlay";
import View from "ol/view";
import PluggableMap from "ol/pluggablemap";
import MapBrowserPointerEvent from "ol/mapbrowserpointerevent";
import Dom from "ol/dom";
import Css from "ol/css";
import Events from "ol/events";
import Extent from 'ol/extent';

import * as MiscUtils from '../utils/Misc';


export default class BirdsEye extends Control {

    /**
     * Altered version of control.OverviewMap:
     * - The image used for the birds eye is the thumbnail of the image viewed.
     * - The birds eye view remains fixed in size (no adjustment for zooms)
     *
     * @constructor
     * @extends {control.Control}
     * @param {Object=} options additional (optional) options (e.g. collapsed)
     */
    constructor(options) {
        options = options || {};
        options.element = document.createElement('div');
        options.render = BirdsEye.render;

        // Call super
        super(options);
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

        let activeLabel = !this.collapsed_ ? this.collapseLabel_ : this.label_;
        let button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.appendChild(activeLabel);
        Events.listen(button, EventType.CLICK, this.handleClick_, this);

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
         * @type {Array.<number>}
         * @private
         */
        this.full_image_size_ = options['size'];

        /**
         * @type {Array.<number>}
         * @private
         */
        this.thumbnail_size_ = [150, 100];
        let fullSidesRatio = this.full_image_size_[0] / this.full_image_size_[1];
        let tmp = [
            this.thumbnail_size_[0],
            parseInt(this.thumbnail_size_[0] / fullSidesRatio)
        ];
        if (tmp[1] > this.thumbnail_size_[1]) {
            let factor = this.thumbnail_size_[1] / tmp[1];
            this.thumbnail_size_ = [
                parseInt(this.thumbnail_size_[0] * factor),
                this.thumbnail_size_[1]
            ];
        } else this.thumbnail_size_ = tmp.slice();

        /**
         * @type {Array.<number>}
         * @private
         */
        this.ratio_ = [
            this.thumbnail_size_[0] / this.full_image_size_[0],
            this.thumbnail_size_[1] / this.full_image_size_[1],
        ];

        /**
         * @type {PluggableMap}
         * @private
         */
        this.birds_eye_ = this.initOrUpdate();

        let box = document.createElement('DIV');
        box.className = 'ol-overviewmap-box';
        box.style.boxSizing = 'border-box';

        /**
         * @type {Overlay}
         * @private
         */
        this.boxOverlay_ = new Overlay({
            position: [0, 0],
            positioning: OverlayPositioning.BOTTOM_LEFT,
            element: box
        });
        this.birds_eye_.addOverlay(this.boxOverlay_);

        // This is where the old super call was
        this.element.className = 'ol-overviewmap  ' + Css.CLASS_UNSELECTABLE + ' ' +
            Css.CLASS_CONTROL + (this.collapsed_ ? ' ol-collapsed' : '');
        this.element.appendChild(this.controlDiv_);
        this.element.appendChild(button);

        this.singleBoxClick = null;
        this.lastBoxCoordinate_ = null;

        this.birds_eye_.addInteraction(new Pointer({
            handleDownEvent: (event) => {
                if (!(event instanceof MapBrowserPointerEvent) ||
                    this.clickedIntoBox(event.pixel)) return false;

                let boxDims = this.getBoxDims();
                let newCenterOfBox =
                    [event.pixel[0] - boxDims[0] / 2,
                        event.pixel[1] + boxDims[1] / 2
                    ];

                this.boxOverlay_.setPosition(
                    this.birds_eye_.getCoordinateFromPixel(newCenterOfBox));

                this.getMap().getView().setCenter(
                    this.convertBirdsEyeCoords(
                        this.birds_eye_.getCoordinateFromPixel(event.pixel)));

                return false;
            },
            handleMoveEvent: (event) => {
                if (!(event instanceof MapBrowserPointerEvent) ||
                    !(event.originalEvent instanceof MouseEvent) ||
                    event.originalEvent.buttons === 0) return;

                if (this.clickedIntoBox(event.pixel)) {
                    if (this.lastBoxCoordinate_ === null) {
                        let position =
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
            },
        }));

        // this is unfortunately necessary
        // since the mouse up event is not bubbling up
        this.onUpEvent = Events.listen(
            this.birds_eye_.getTarget(),
            EventType.MOUSEUP,
            (event) => {
                if (this.lastBoxCoordinate_ === null) return;

                let boxDims = this.getBoxDims();
                let newCenter = [
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

    /**
     * Converts the bird's eye coordinates to full image coordinates
     *
     * @param {Array.<number>} coords the bird's eye coords
     * @return {Array.<number>} the corresponsing full image coordinates
     */
    convertBirdsEyeCoords(coords) {
        return [coords[0] / this.ratio_[0], coords[1] / this.ratio_[1]];
    }

    /**
     * Sets map and rerenders/updates bird's eye view
     * @param {PluggableMap} map
     */
    setMap(map) {
        if (map) {
            super.setMap(this, map);
            this.birds_eye_.updateSize();
            this.render();
        }
    }

    /**
     * Creates/Initializes a PluggableMap that represents the bird's eye view
     * or merely updates it if one exists already
     * @return {PluggableMap} the bird's eye view
     */
    initOrUpdate() {
        // determine thumbnail size
        let ext = [0, -this.thumbnail_size_[1], this.thumbnail_size_[0], 0];
        let proj = new Projection({
            code: 'BIRDSEYE',
            units: 'pixels',
            extent: ext.slice()
        });

        // replace layer if we have one already,
        // effectively updating the static image source
        if (this.birds_eye_ instanceof PluggableMap &&
            this.birds_eye_.getLayers().getLength() > 0) {
            this.birds_eye_.getLayers().item(0).setSource(
                new ImageStatic({
                    url: this.getThumbnailUrlWithVersion(),
                    projection: proj,
                    imageExtent: ext
                }));
            return this.birds_eye_;
        }

        let view = new View({
            projection: proj,
            center: Extent.getCenter(ext),
            resolutions: [1],
            resolution: 1
        });
        let imageLayer = new layer.Image({
            source: new ImageStatic({
                url: this.getThumbnailUrlWithVersion(),
                projection: proj,
                imageExtent: ext
            })
        });

        return new PluggableMap({
            controls: new Collection(),
            interactions: new Collection(),
            renderer: renderer.Type.CANVAS,
            layers: [imageLayer],
            view: view,
            target: this.controlDiv_
        });
    }

    /**
     * Gets the thumbnail url for requesting
     * @return {string} the thumbnail url including config id and version
     */
    getThumbnailUrlWithVersion() {
        let map = this.getMap();
        let rev = new Date().getTime();
        if (map) rev += "-" + MiscUtils.getTargetId(map.getTargetElement());

        return this.thumbnail_url_ + "/" + this.thumbnail_size_[0] +
            "/" + this.thumbnail_size_[1] + "/?rev=" + rev;
    }

    /**
     * Update the bird eye view
     * @param {MapEvent} mapEvent Map event.
     * @this {ome.ol3.controls.BirdsEye}
     */
    render = (mapEvent) => {
        if (this.lastBoxCoordinate_ !== null || this.singleBoxClick) {
            this.singleBoxClick = false;
            return;
        }
        this.updateBox_();
    };


    /**
     * Updates the box overlay
     * @private
     */
    updateBox_() {
        let map = this.getMap();
        if (!this.birds_eye_.isRendered()) return;

        let view = map.getView();
        let rotation = view.getRotation();
        this.birds_eye_.getView().setRotation(rotation);
        let extentObj = Extent.getForViewAndSize(view.getCenter(), view.getResolution(), 0, map.getSize());
        let bottomLeft = extentObj.getBottomLeft(Extent);
        let topRight = extentObj.getTopRight(Extent);

        let rotatedBottomLeft = this.calculateCoordinateRotate_(rotation, bottomLeft);
        this.boxOverlay_.setPosition(
            [rotatedBottomLeft[0] * this.ratio_[0],
                rotatedBottomLeft[1] * this.ratio_[1]]);

        let box = this.boxOverlay_.getElement();
        if (box) {
            box.style.width = Math.abs((bottomLeft[0] - topRight[0]) * this.ratio_[0]) + 'px';
            box.style.height = Math.abs((topRight[1] - bottomLeft[1]) * this.ratio_[1]) + 'px';
        }
    };


    /**
     * @param {number} rotation Target rotation.
     * @param {Coordinate} coordinate Coordinate.
     * @return {Coordinate|undefined} Coordinate for rotation and center anchor.
     * @private
     */
    calculateCoordinateRotate_(rotation, coordinate) {
        let coordinateRotate;

        let map = this.getMap();
        let view = map.getView();

        let currentCenter = view.getCenter();

        if (currentCenter) {
            coordinateRotate = [
                coordinate[0] - currentCenter[0],
                coordinate[1] - currentCenter[1]
            ];
            coordinate.rotate(coordinateRotate, rotation);
            coordinate.add(coordinateRotate, currentCenter);
        }
        return coordinateRotate;
    };


    /**
     * @param {Event} event The event to handle
     * @private
     */
    handleClick_(event) {
        event.preventDefault();
        this.handleToggle_();
    };


    /**
     * Handles transition from collapsed to not collapsed and vice versa
     * @private
     */
    handleToggle_() {
        this.element.classList.toggle('ol-collapsed');
        if (this.collapsed_) {
            Dom.replaceNode(this.collapseLabel_, this.label_);
        } else {
            Dom.replaceNode(this.label_, this.collapseLabel_);
        }
        this.collapsed_ = !this.collapsed_;

        if (!this.collapsed_) {
            if (!this.birds_eye_.isRendered()) this.birds_eye_.updateSize();
            Events.listenOnce(
                this.birds_eye_, MapEventType.POSTRENDER,
                () => {
                    try {
                        this.updateBox_();
                    } catch (ignored) {
                    }
                }, this);
        }
    };


    /**
     * Toggles collapsed state of bird eye view
     * @param {boolean} collapsed if true bird eye view will be hidden
     */
    setCollapsed(collapsed) {
        if (this.collapsed_ === collapsed) return;
        this.handleToggle_();
    };


    /**
     * Returns the collapsed state of the bird eye view
     * @return {boolean} true if bird eye view is hidden, false otherwise.
     */
    getCollapsed() {
        return this.collapsed_;
    };

    /**
     * Gets the width and height of the box in the birds eye view
     *
     * @return {Array<number>} the dimension of the box
     * @private
     */
    getBoxDims() {
        let el = this.boxOverlay_.getElement();
        let tmp = [
            Dom.outerWidth(el),
            Dom.outerHeight(el)
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
    clickedIntoBox(coords) {
        let offset =
            this.birds_eye_.getPixelFromCoordinate(this.boxOverlay_.getPosition());
        let boxDims = this.getBoxDims();
        let extent = [
            offset[0] - 5, offset[1] - boxDims[1] - 5,
            offset[0] + boxDims[0] + 5, offset[1] + 5
        ];
        return extent.containsCoordinate(extent, coords);
    }

    /**
     * sort of destructor
     */
    disposeInternal() {
        if (typeof(this.onUpEvent) !== 'undefined' && this.onUpEvent)
            Events.unlistenByKey(this.onUpEvent);

        super.disposeInternal();
        if (this.birds_eye_) this.birds_eye_.dispose();
    };
}

