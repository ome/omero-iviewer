//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import ScaleLine from 'ol/control/ScaleLine';
import PluggableMap from 'ol/PluggableMap';
import {inherits} from 'ol/util';
import {listen, unlistenByKey} from 'ol/events';
import {UNITS_LENGTH} from '../globals';

/**
 * @classdesc
 * Extends the built ScaleLine
 *
 * @constructor
 * @extends {ol.control.ScaleLine}
 * @param {Object} opt_options optional options
 */
const ScaleBar = function(opt_options) {
    if (typeof(opt_options) !== 'object') opt_options = {};

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

    // goog.base(this, opt_options);
    ScaleLine.call(this, opt_options);

    // give element a tooltip
    this.element.title = "Click and drag to move scalebar";
    // append ol-control
    this.element.className += " ol-control";

    // register 'drag' listener
    listen(
        this.element, "mousedown",
        function(start) {
            if (!(this.map_ instanceof PluggableMap)) return;
            if (this.drag_listener_ !== null) {
                unlistenByKey(this.drag_listener_);
                this.drag_listener_ = null;
            }
            var offsetX = -start.offsetX;
            var offsetY = -start.offsetY;
            this.drag_listener_ =
                listen(this.map_, "pointermove",
                    function(move) {
                        var e = move.originalEvent;
                        if (!((typeof e.buttons === 'undefined' &&
                            e.which === 1) || e.buttons === 1)) {
                                unlistenByKey(this.drag_listener_);
                                this.drag_listener_ = null;
                                return;
                            }
                        this.element.style.bottom = "auto";
                        this.element.style.left =
                            (move.pixel[0] + offsetX) + "px";
                        this.element.style.top =
                            (move.pixel[1] + offsetY) + "px";
                    }, this);
     }, this);
}
inherits(ScaleBar, ScaleLine);

/**
 * Overridden to deal with mere pixel to unit issues instead of geographic
 * projections
 * @private
 */
ScaleBar.prototype.updateElement_ = function() {
  var viewState = this.viewState_;

  if (!viewState) {
    if (this.renderedVisible_) {
      this.element.style.display = 'none';
      this.renderedVisible_ = false;
    }
    return;
  }

  var micronsPerPixel = viewState.projection.getMetersPerUnit();
  var resolution = viewState.resolution;
  var scaleBarLengthInUnits = micronsPerPixel * this.bar_width_ * resolution;
  var symbol = '\u00B5m';
  for (var u=0;u<UNITS_LENGTH.length;u++) {
      var unit = UNITS_LENGTH[u];
      if (scaleBarLengthInUnits < unit.threshold) {
          scaleBarLengthInUnits *= unit.multiplier;
          symbol = unit.symbol;
          break;
      }
  }

  var html = scaleBarLengthInUnits.toFixed(2) + ' ' + symbol;
  if (this.renderedHTML_ !== html) {
    this.innerElement_.innerHTML = html;
    this.renderedHTML_ = html;
  }

  if (this.renderedWidth_ != this.bar_width_) {
    this.innerElement_.style.width = this.bar_width_ + 'px';
    this.renderedWidth_ = this.bar_width_;
  }

  if (!this.renderedVisible_) {
    this.element.style.display = '';
    this.renderedVisible_ = true;
  }
};

export default ScaleBar;
