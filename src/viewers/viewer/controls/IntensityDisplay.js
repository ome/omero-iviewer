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

import EventType from 'ol/events/EventType';
import MapEventType from 'ol/MapEventType';
import MapBrowserEventType from 'ol/MapBrowserEventType';
import {removeNode} from 'ol/dom';
import Control from 'ol/control/Control';
import {listen, unlistenByKey} from 'ol/events';
import {CLASS_UNSELECTABLE, CLASS_CONTROL} from 'ol/css';
import {inherits} from 'ol/util';
import {getTargetId,
    isArray} from '../utils/Misc';
import {sendRequest} from '../utils/Net';

/**
 * @classdesc
 * A control for intensity display.
 * It handles the request on mouse move
 *
 * @constructor
 */
const IntensityDisplay = function() {

    /**
     * maximum number of cached intensity values
     * @type {number}
     * @private
     */
    this.CACHE_LIMIT = 1000*1000;

    /**
     * a 2 level cache for intensity values
     * we don't let it grow too big so we
     * have a first level per z/t combination
     * to ensure that we delete z/t entries
     * other than the present one first once
     * we reach the maximum count allowed
     * the second layer is arranged in x-y
     * location entries with their respective
     * channel intensitiess
     * @type {Object}
     * @private
     */
    this.intensities_cache_ = {
        'count': 0,
        'intensities': {}
    }

    /**
     * a handle for the setTimeout routine
     * @type {number}
     * @private
     */
    this.movement_handle_ = null;

    /**
     * the last cursor position
     * @type {Array.<number>}
     * @private
     */
    this.last_cursor_ = [0,0];

    /**
     * a possible request prefix we need to include
     * @type {string}
     * @private
     */
    this.prefix_ = "";

    /**
     * flag that controls whether we query the intensity or not
     * @type {boolean}
     * @private
     */
    this.query_intensity_ = false;

    /**
     * a reference to the Image instance
     * @type {source.Image}
     * @private
     */
    this.image_ = null;

    /**
     * handle on the pointer move listener
     * @type {number}
     * @private
     */
    this.pointer_move_listener_ = null;

    // set up html
    var cssClasses =
        'ol-intensity ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;

    // main container
    var container = document.createElement('div');
    container.className = cssClasses;

    var coords = document.createElement('div');
    coords.className = "intensity-display";
    coords.appendChild(document.createTextNode(""));
    var crosshair = document.createElement('span');
    crosshair.className = "intensity-toggler";
    crosshair.title = "Turn on intensity querying";
    listen(crosshair, EventType.CLICK,
        function() {
            this.toggleIntensityQuerying(!this.query_intensity_);
            if (this.query_intensity_) {
                crosshair.title = "Turn off intensity querying";
                crosshair.className = "intensity-toggler intensity-on";
            } else {
                crosshair.title = "Turn on intensity querying";
                crosshair.className = "intensity-toggler";
            }
        }, this);

    container.appendChild(coords);
    container.appendChild(crosshair);

    // call super
    Control.call(this, {
        element: container
    });
};
inherits(IntensityDisplay, Control);

/**
 * Overide setMap to avoid listener keys being null when removing the control
 * @param {ol.PluggableMap} map Map.
 */
IntensityDisplay.prototype.setMap = function(map) {
    if (this.map_) {
        removeNode(this.element);
    }

    for (var i = 0, ii = this.listenerKeys.length; i < ii; ++i) {
        unlistenByKey(this.listenerKeys[i]);
    }
    this.listenerKeys = [];
    this.map_ = map;

    if (this.map_) {
        var target = this.target_ ?
            this.target_ : map.getOverlayContainerStopEvent();
        target.appendChild(this.element);
        if (this.render !== null) {
            this.listenerKeys.push(listen(map,
                MapEventType.POSTRENDER, this.render, this));
        }
        map.render();
    }
};

/**
 * Makes control start listening to mouse movements and display coordinates
 * Does not mean that it we start requesting intensity values
 * see {@link toggleIntensityQuerying}
 * @param {string=} prefix the prefix for the intensity request
 */
IntensityDisplay.prototype.enable = function(prefix) {
    if (this.getMap() === null) return;

    this.query_intensity_ = false;
    this.prefix_ = prefix || "";
    this.image_ = this.getMap().getLayers().item(0).getSource();

    this.pointer_move_listener_ =
        listen(
            this.getMap(),
            MapBrowserEventType.POINTERMOVE,
            IntensityDisplay.prototype.handlePointerMove_.bind(this));
    this.getMap().getTargetElement().onmouseleave = function() {
        this.resetMoveTracking_();
    }.bind(this);
}

/**
 * Stop listening to mouse movements (and querying intensities)
 */
IntensityDisplay.prototype.disable = function() {
    this.query_intensity_ = false;
    if (this.pointer_move_listener_) {
        unlistenByKey(this.pointer_move_listener_);
        this.pointer_move_listener_ = null;
    }

    if (this.getMap() && this.getMap().getTargetElement())
        this.getMap().getTargetElement().onmouseleave = null;
    this.resetMoveTracking_();

    var el = this.getIntensityDisplayElement();
    if (el) el.innerHTML = "";
    this.image_ = null;
}

/**
 * Updates the Mouse Tooltip with either one of the following:
 * - hiding (if no querying/display)
 * - loading message (if querying)
 * - data display (after querying)
 * @private
 * @param {ol.MapBrowserEvent} event the pointe move event
 * @param {Array.<Object>} data the pixel intensity results
 * @param {boolean} is_querying if true we are querying and display a message
 */
IntensityDisplay.prototype.updateTooltip =
    function(event, data, is_querying) {
        if (this.getMap() === null ||
            this.getMap().getTargetElement() === null) return;

        if (typeof is_querying !== 'boolean') is_querying = false;
        var targetId = getTargetId(this.getMap().getTargetElement());
        if (targetId === null) return;

        var els = document.getElementById('' + targetId).querySelectorAll(
            '.ol-intensity-popup');
        var tooltip = els && els.length > 0 ? els[0] : null;
        var hasData = typeof data === 'object' && data !== null;
        var hideTooltip =
            typeof event !== 'object' ||
            event === null || (!is_querying && !hasData);
        if (hideTooltip) {
            if (tooltip) tooltip.style.display = "none";
            return;
        }

        var createTooltip = typeof tooltip === 'undefined' || tooltip === null;
        if (createTooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'ol-intensity-popup';
        }

        tooltip.style.position = 'absolute';
        // visibility hidden let's us measure the dims of the tooltip
        tooltip.style.display = '';
        tooltip.style.visibility = 'hidden';
        tooltip.innerHTML = "";
        if (hasData) {
            var intensity_html =
                '<div style="display:table-row">' +
                    '<div class="intensity-header">Channel</div>' +
                    '<div class="intensity-header">Intensity</div>' +
                '</div>';
            for (var x in data) {
                if (!this.image_.channels_info_[x]['active']) continue;
                var val = data[x];
                var label = this.image_.channels_info_[x]['label'];
                intensity_html +=
                    '<div style="display:table-row">' +
                        '<div class="intensity-label">' + label + '</div>' +
                        '<div class="intensity-value">' +
                        (val % 1 === 0 ? val : val.toFixed(3)) + '</div>' +
                    '</div>';
            }
            tooltip.innerHTML = intensity_html;
        } else if (is_querying) {
            tooltip.innerHTML = "Querying Intensity...";
        }

        var coordinate = event.pixel.slice();
        var offset = [15, 15];
        try {
            var parent = event.originalEvent.target.parentNode;
            var w = tooltip.offsetWidth;
            var h = tooltip.offsetHeight;
            if (coordinate[0] + w > parent.offsetWidth) {
                var x = coordinate[0] - w;
                coordinate[0] = (x >= 0) ? x : 0;
                offset[0] = -offset[0];
            }
            if (coordinate[1] + h > parent.offsetHeight) {
                var y = coordinate[1] - h;
                coordinate[1] = (y >= 0) ? y : 0;
                offset[1] = -offset[1];
            }
        } catch (ignored) {}
        tooltip.style.left = "" + (coordinate[0] + offset[0]) + "px";
        tooltip.style.top = "" + (coordinate[1] + offset[1]) + "px";

        if (this.last_cursor_[0] === event.pixel[0] &&
            this.last_cursor_[1] === event.pixel[1]) {
            tooltip.style.visibility = "visible";
            if (createTooltip) {
                var target = this.getMap().getTargetElement();
                if (target) target.childNodes[0].appendChild(tooltip);
            }
        }
}

/**
 * Resets params for move 'tracking'
 * @param {Array.<number>} pixel the pixel coordinates to reset to
 * @private
 */
IntensityDisplay.prototype.resetMoveTracking_ = function(pixel) {
    this.last_cursor_ = isArray(pixel) && pixel.length === 2 ?
            pixel : [0,0];
    this.updateTooltip();
    if (typeof this.movement_handle_ === 'number') {
        clearTimeout(this.movement_handle_);
        this.movement_handle_ = null;
    }
}

/**
 * Returns the intensity display element
 * @return {Element|null} the intensity display element
 */
IntensityDisplay.prototype.getIntensityDisplayElement = function() {
    if (this.element === null) return;

    var els = this.element.querySelectorAll('.intensity-display');
    if (els && els.length > 0) return els[0];

    return null;
}

/**
 * Handles the pointer move
 * (display of coordinates and a potential triggering of the intensity request)
 * @private
 */
IntensityDisplay.prototype.handlePointerMove_ = function(e) {
    var isMainCanvas = false;
    try {
        this.resetMoveTracking_(e.pixel);
        var target =  e.originalEvent.target;
        var isCanvas = target.nodeName.toUpperCase() === 'CANVAS';
        if (isCanvas) {
            isMainCanvas =
                target.parentNode.parentNode.className.indexOf(
                    "ol-overviewmap") < 0;
        }
    } catch(ignored) {}

    // set cursor style
    this.getMap().getTargetElement().style.cursor =
        this.query_intensity_ && isMainCanvas ? 'crosshair' : 'auto';

    // we ignore dragging actions and mouse over controls
    if (!isMainCanvas || e.dragging) return;

    var el = this.getIntensityDisplayElement();
    var x = e.coordinate[0], y = -e.coordinate[1];
    if (x < 0 || x >= this.image_.getWidth() ||
        y < 0 || y >= this.image_.getHeight()) {
            el.style.display = 'none';
            el.innerHTML = "";
            return;
        }
    el.style.display = 'block';
    el.innerHTML = "X: " + x.toFixed(0) + " Y: " + y.toFixed(0);

    if (this.query_intensity_) {
        var activeChannels = this.image_.getChannels();
        if (activeChannels.length === 0) return;

        x = parseInt(x);
        y = parseInt(y);
        var z = this.image_.getPlane();
        var t = this.image_.getTime();
        var displayIntensity = function(results) {
            el.innerHTML = "X: " + x.toFixed(0) + " Y: " + y.toFixed(0);
            this.updateTooltip(e, results);
        }.bind(this);

        var cache_entry = this.getCachedIntensities(z, t, x, y);
        var channelsThatNeedToBeRequested = []
        // could be that we need a channel that is missing
        // while others are there already...
        // request only the missing ones
        if (cache_entry !== null) {
            for (var c in activeChannels)
                if (typeof cache_entry[activeChannels[c]] !== 'number')
                    channelsThatNeedToBeRequested.push(activeChannels[c]);
        } else channelsThatNeedToBeRequested = activeChannels;

        var action = null;
        var delay = 250;
        if (channelsThatNeedToBeRequested.length > 0) {
            delay = 500;
            action = function() {
                // we have to request the intensities
                // for the z,t,c,x and y given
                var reqParams = {
                    "server" : this.image_.server_,
                    "uri" : this.prefix_ + "/get_intensity/?image=" + this.image_.id_ +
                            "&z=" + z + "&t=" + t + "&x=" + x + "&y=" + y +
                            "&c=" + channelsThatNeedToBeRequested.join(','),
                    "success" : function(resp) {
                        try {
                            var res = JSON.parse(resp);
                            this.cacheIntensities(res);
                            displayIntensity(this.getCachedIntensities(z, t, x, y));
                        } catch(parseError) {
                            console.error(parseError);
                        }
                    }.bind(this),
                    "error" : function(err) {
                        this.updateTooltip();
                        console.error(err);
                    }.bind(this)
                };
                this.updateTooltip(e, null, true);
                sendRequest(reqParams);
            }
        } else {
            action = function() {displayIntensity(cache_entry);};
        }

        this.movement_handle_ = setTimeout(
            function() {
                if (this.last_cursor_[0] === e.pixel[0] &&
                    this.last_cursor_[1] === e.pixel[1]) action.call(this);
            }.bind(this), delay);
    }
}

/**
 * Looks up cached intensities using plane and time as well as location
 *
 * @param {number} plane
 * @param {number} time
 * @param {number} x
 * @param {number} y
 * @return {Object} an object with channels and their respective intensity
 */
IntensityDisplay.prototype.getCachedIntensities =
    function(plane, time, x, y) {
        if (this.intensities_cache_['count'] === 0) return null;
        try {
            var planeTimeEntry =
                this.intensities_cache_['intensities']["" + plane + "-" + time];
            if (typeof planeTimeEntry['pixels']["" + x + "-" + y] !== 'object')
                return null;
            return planeTimeEntry['pixels']["" + x + "-" + y];
        } catch(ex) {
            return null;
        }
}

IntensityDisplay.prototype.cacheIntensities =
    function(intensities) {
        try {
            var plane = this.image_.getPlane();
            var time = this.image_.getTime();
            var key = "" + plane + "-" + time;

            // check if we exceed cache limit
            // if so we remove cache entries
            // preferably for other plane/time
            if (this.intensities_cache_['count']  +
                    intensities['count'] > this.CACHE_LIMIT) {
                for (var tmp in this.intensities_cache_['intensities']) {
                    if (tmp !== key) {
                        this.intensities_cache_['count'] -=
                            this.intensities_cache_['intensities'][tmp]['count'];
                        delete this.intensities_cache_['intensities'][tmp];
                    }
                    if (this.intensities_cache_['count']  +
                            intensities['count'] < this.CACHE_LIMIT) break;
                }
                if (this.intensities_cache_['count']  +
                        intensities['count'] > this.CACHE_LIMIT) {
                    delete this.intensities_cache_['intensities'][key];
                    this.intensities_cache_['count'] = 0;
                }
            }

            if (typeof this.intensities_cache_['intensities'][key] !== 'object') {
                // set planeTimeEntry to be the new intensities queried
                this.intensities_cache_['intensities'][key] = intensities;
                this.intensities_cache_['count'] += intensities['count'];
            } else {
                // we have an existing planeTimeEntry with existing intensities
                // loop over the ones we queried and add them
                var planeTimeEntry = this.intensities_cache_['intensities'][key];
                for (var pixel in intensities['pixels']) {
                    if (typeof planeTimeEntry['pixels'][pixel] !== 'object')
                        planeTimeEntry['pixels'][pixel] = {}
                    // add intensity for queries channel (if not exists)
                    var pixelIntensities = intensities['pixels'][pixel];
                    for (var chan in pixelIntensities)
                        if (typeof planeTimeEntry['pixels'][pixel][chan] !== 'number') {
                            planeTimeEntry['pixels'][pixel][chan] = pixelIntensities[chan];
                            planeTimeEntry['count']++;
                            this.intensities_cache_['count']++;
                        }
                }
            }
        } catch(ex) {
            console.error("Failed to cache intensities: " + ex);
        }
}

/**
 * Enables/Disables intensity querying on pointerdrag
 * @param {boolean} flag if true enable intensity querying, otherwise disable it
 */
IntensityDisplay.prototype.toggleIntensityQuerying = function(flag) {
    // could be we have not been enabled before
    if (this.pointer_move_listener_ === null || this.image_ === null) {
        this.disable(); // just to make sure
        this.enable(this.prefix_);
    };

    if (typeof flag !== 'boolean') flag = false;
    if ((flag && this.query_intensity_) || // no change
        (!flag && !this.query_intensity_)) return this.query_intensity_;

    // change value
    return (this.query_intensity_ = flag);
}

/**
 * sort of destructor
 */
IntensityDisplay.prototype.disposeInternal = function() {
    this.disable();
};
