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
import ScaleLine from "ol/control/scaleline";
import PluggableMap from "ol/pluggablemap";
import Events from "ol/events";

/**
 * @classdesc
 * Extends the built ScaleLine
 *
 * @constructor
 * @extends {ol.control.ScaleLine}
 * @param {Object} opt_options optional options
 */
export default class ScaleBar extends ScaleLine {
    constructor(opt_options) {
        if (typeof(opt_options) !== 'object') opt_options = {};
        super(opt_options);

        /**
         * default scale bar width in pixels
         * @type {number}
         * @private
         */
        this.bar_width_ = 100;

        /**
         * the scalebar 'drag' listener
         * @type {number}
         * @private
         */
        this.drag_listener_ = null;

        // give element a tooltip
        this.element_.title = "Click and drag to move scalebar";
        // append ol-control
        this.element_.className += " ol-control";

        // register 'drag' listener
        Events.listen(
            this.element_, "mousedown",
            (start) => {
                if (!(this.map_ instanceof PluggableMap)) return;
                if (this.drag_listener_ !== null) {
                    Events.unlistenByKey(this.drag_listener_);
                    this.drag_listener_ = null;
                }
                let offsetX = -start.offsetX;
                let offsetY = -start.offsetY;
                this.drag_listener_ = Events.listen(this.map_, "pointermove",
                        (move) => {
                            let e = move.originalEvent;
                            if (!((typeof e.buttons === 'undefined' &&
                                e.which === 1) || e.buttons === 1)) {
                                Events.unlistenByKey(this.drag_listener_);
                                this.drag_listener_ = null;
                                return;
                            }
                            this.element_.style.bottom = "auto";
                            this.element_.style.left =
                                (move.pixel[0] + offsetX) + "px";
                            this.element_.style.top =
                                (move.pixel[1] + offsetY) + "px";
                        }, this);
            }, this);
    }
    /**
     * Overridden to deal with mere pixel to unit issues instead of geographic
     * projections
     * @private
     */
    updateElement_() {
        let viewState = this.viewState_;

        if (!viewState) {
            if (this.renderedVisible_) {
                this.element_.style.display = 'none';
                this.renderedVisible_ = false;
            }
            return;
        }

        let micronsPerPixel = viewState.projection.getMetersPerUnit();
        let resolution = viewState.resolution;
        let scaleBarLengthInUnits = micronsPerPixel * this.bar_width_ * resolution;
        let symbol = '\u00B5m';
        for (let u=0;u<ome.ol3.UNITS_LENGTH.length;u++) {
            let unit = ome.ol3.UNITS_LENGTH[u];
            if (scaleBarLengthInUnits < unit.threshold) {
                scaleBarLengthInUnits *= unit.multiplier;
                symbol = unit.symbol;
                break;
            }
        }

        let html = scaleBarLengthInUnits.toFixed(2) + ' ' + symbol;
        if (this.renderedHTML_ !== html) {
            this.innerElement_.innerHTML = html;
            this.renderedHTML_ = html;
        }

        if (this.renderedWidth_ !== this.bar_width_) {
            this.innerElement_.style.width = this.bar_width_ + 'px';
            this.renderedWidth_ = this.bar_width_;
        }

        if (!this.renderedVisible_) {
            this.element_.style.display = '';
            this.renderedVisible_ = true;
        }
    };
}
