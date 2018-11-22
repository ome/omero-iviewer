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
import EventType from 'ol/events/eventtype';
import Control from 'ol/control/control';
import MapEventType from "ol/mapeventtype";
import Events from "ol/events";
import Css from "ol/css";
import Dom from "ol/dom";

import * as MiscUtils from '../utils/Misc';
import * as NetUtils from '../utils/Net';

/**
 * @classdesc
 * A control for intensity display.
 * It handles the request on mouse move
 *
 * @constructor
 */
export default class IntensityDisplay extends Control {
    constructor() {
        let coords = document.createElement('div');
        coords.className = "intensity-display";
        coords.appendChild(document.createTextNode(""));

        let crosshair = document.createElement('span');
        crosshair.className = "intensity-toggler";
        crosshair.title = "Turn on intensity querying";

        // main container
        let container = document.createElement('div');
        container.className = `ol-intensity ${Css.CLASS_UNSELECTABLE} ${Css.CLASS_CONTROL}`;
        container.appendChild(coords);
        container.appendChild(crosshair);

        // call super
        super({element: container});

        // Listen for crosshair events
        Events.listen(crosshair, EventType.CLICK, () => {
            this.toggleIntensityQuerying(!this.query_intensity_);
            if (this.query_intensity_) {
                crosshair.title = "Turn off intensity querying";
                crosshair.className = "intensity-toggler intensity-on";
            } else {
                crosshair.title = "Turn on intensity querying";
                crosshair.className = "intensity-toggler";
            }
        }, this);


        /**
         * maximum number of cached intensity values
         * @type {number}
         * @private
         */
        this.CACHE_LIMIT = 1000 * 1000;

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
        };

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
        this.last_cursor_ = [0, 0];

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
         * @type {ome.ol3.source.Image}
         * @private
         */
        this.image_ = null;

        /**
         * handle on the pointer move listener
         * @type {Module:ol/events/EventsKey}
         * @private
         */
        this.pointer_move_listener_ = null;
    }

    /**
     * Overide setMap to avoid listener keys being null when removing the control
     * @param {PluggableMap} map Map.
     */
    setMap(map) {
        if (this.map_) {
            Dom.removeNode(this.element);
        }

        for (let i = 0, ii = this.listenerKeys.length; i < ii; ++i) {
            Events.unlistenByKey(this.listenerKeys[i]);
        }
        this.listenerKeys = [];
        this.map_ = map;

        if (this.map_) {
            let target = this.target_ ?
                this.target_ : map.getOverlayContainerStopEvent();
            target.appendChild(this.element);
            if (this.render) {
                this.listenerKeys.push(Events.listen(map,
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
    enable(prefix) {
        if (this.getMap() === null) return;

        this.query_intensity_ = false;
        this.prefix_ = prefix || "";
        this.image_ = this.getMap().getLayers().item(0).getSource();

        this.pointer_move_listener_ = Events.listen(this.getMap(), EventType.POINTERMOVE, (e) => {
            this.handlePointerMove_(e)
        });
        this.getMap().getTargetElement().onmouseleave = () => {
            this.resetMoveTracking_();
        };
    }

    /**
     * Stop listening to mouse movements (and querying intensities)
     */
    disable() {
        this.query_intensity_ = false;
        if (this.pointer_move_listener_) {
            Events.unlistenByKey(this.pointer_move_listener_);
            this.pointer_move_listener_ = null;
        }

        if (this.getMap() && this.getMap().getTargetElement())
            this.getMap().getTargetElement().onmouseleave = null;
        this.resetMoveTracking_();

        let el = this.getIntensityDisplayElement();
        if (el) el.innerHTML = "";
        this.image_ = null;
    }

    /**
     * Updates the Mouse Tooltip with either one of the following:
     * - hiding (if no querying/display)
     * - loading message (if querying)
     * - data display (after querying)
     * @private
     * @param {MapBrowserEvent} event the pointe move event
     * @param {Array.<Object>} data the pixel intensity results
     * @param {boolean} is_querying if true we are querying and display a message
     */
    updateTooltip(event, data, is_querying) {
        if (this.getMap() === null ||
            this.getMap().getTargetElement() === null) return;

        if (typeof is_querying !== 'boolean') is_querying = false;
        let targetId =
            MiscUtils.getTargetId(this.getMap().getTargetElement());
        if (!targetId) return;

        let els = document.getElementById('' + targetId).querySelectorAll(
            '.ol-intensity-popup');
        let tooltip = els && els.length > 0 ? els[0] : null;
        let hasData = typeof data === 'object' && data !== null;
        let hideTooltip =
            typeof event !== 'object' ||
            event === null || (!is_querying && !hasData);
        if (hideTooltip) {
            if (tooltip) tooltip.style.display = "none";
            return;
        }

        let createTooltip = typeof tooltip === 'undefined' || tooltip === null;
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
            let intensity_html =
                '<div style="display:table-row">' +
                '<div class="intensity-header">Channel</div>' +
                '<div class="intensity-header">Intensity</div>' +
                '</div>';
            for (let x in data) {
                if (!this.image_.channels_info_[x]['active']) continue;
                let val = data[x];
                let label = this.image_.channels_info_[x]['label'];
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

        let coordinate = event.pixel.slice();
        let offset = [15, 15];
        try {
            let parent = event.originalEvent.target.parentNode;
            let w = tooltip.offsetWidth;
            let h = tooltip.offsetHeight;
            if (coordinate[0] + w > parent.offsetWidth) {
                let x = coordinate[0] - w;
                coordinate[0] = (x >= 0) ? x : 0;
                offset[0] = -offset[0];
            }
            if (coordinate[1] + h > parent.offsetHeight) {
                let y = coordinate[1] - h;
                coordinate[1] = (y >= 0) ? y : 0;
                offset[1] = -offset[1];
            }
        } catch (ignored) {
        }
        tooltip.style.left = "" + (coordinate[0] + offset[0]) + "px";
        tooltip.style.top = "" + (coordinate[1] + offset[1]) + "px";

        if (this.last_cursor_[0] === event.pixel[0] &&
            this.last_cursor_[1] === event.pixel[1]) {
            tooltip.style.visibility = "visible";
            if (createTooltip) {
                let target = this.getMap().getTargetElement();
                if (target) target.childNodes[0].appendChild(tooltip);
            }
        }
    }

    /**
     * Resets params for move 'tracking'
     * @param {Array.<number>} pixel the pixel coordinates to reset to
     * @private
     */
    resetMoveTracking_(pixel) {
        this.last_cursor_ =
            MiscUtils.isArray(pixel) && pixel.length === 2 ?
                pixel : [0, 0];
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
    getIntensityDisplayElement() {
        if (this.element === null) return;

        let els = this.element.querySelectorAll('.intensity-display');
        if (els && els.length > 0) return els[0];

        return null;
    }

    /**
     * Handles the pointer move
     * (display of coordinates and a potential triggering of the intensity request)
     * @private
     */
    handlePointerMove_(e) {
        let isMainCanvas = false;
        try {
            this.resetMoveTracking_(e.pixel);
            let target = e.originalEvent.target;
            let isCanvas = target.nodeName.toUpperCase() === 'CANVAS';
            if (isCanvas) {
                isMainCanvas =
                    target.parentNode.parentNode.className.indexOf(
                        "ol-overviewmap") < 0;
            }
        } catch (ignored) {
        }

        // set cursor style
        this.getMap().getTargetElement().style.cursor =
            this.query_intensity_ && isMainCanvas ? 'crosshair' : 'auto';

        // we ignore dragging actions and mouse over controls
        if (!isMainCanvas || e.dragging) return;

        let el = this.getIntensityDisplayElement();
        let x = e.coordinate[0], y = -e.coordinate[1];
        if (x < 0 || x >= this.image_.getWidth() ||
            y < 0 || y >= this.image_.getHeight()) {
            el.style.display = 'none';
            el.innerHTML = "";
            return;
        }
        el.style.display = 'block';
        el.innerHTML = "X: " + x.toFixed(0) + " Y: " + y.toFixed(0);

        if (this.query_intensity_) {
            let activeChannels = this.image_.getChannels();
            if (activeChannels.length === 0) return;

            x = parseInt(x);
            y = parseInt(y);
            let z = this.image_.getPlane();
            let t = this.image_.getTime();
            let displayIntensity = (results) => {
                el.innerHTML = "X: " + x.toFixed(0) + " Y: " + y.toFixed(0);
                this.updateTooltip(e, results);
            };

            let cache_entry = this.getCachedIntensities(z, t, x, y);
            let channelsThatNeedToBeRequested = []
            // could be that we need a channel that is missing
            // while others are there already...
            // request only the missing ones
            if (cache_entry !== null) {
                for (let c in activeChannels)
                    if (typeof cache_entry[activeChannels[c]] !== 'number')
                        channelsThatNeedToBeRequested.push(activeChannels[c]);
            } else channelsThatNeedToBeRequested = activeChannels;

            let action = null;
            let delay = 250;
            if (channelsThatNeedToBeRequested.length > 0) {
                delay = 500;
                action = () => {
                    // we have to request the intensities
                    // for the z,t,c,x and y given
                    let reqParams = {
                        "server": this.image_.server_,
                        "uri": this.prefix_ + "/get_intensity/?image=" + this.image_.id_ +
                            "&z=" + z + "&t=" + t + "&x=" + x + "&y=" + y +
                            "&c=" + channelsThatNeedToBeRequested.join(','),
                        "success": (resp) => {
                            try {
                                let res = JSON.parse(resp);
                                this.cacheIntensities(res);
                                displayIntensity(this.getCachedIntensities(z, t, x, y));
                            } catch (parseError) {
                                console.error(parseError);
                            }
                        },
                        "error": (err) => {
                            this.updateTooltip();
                            console.error(err);
                        }
                    };
                    this.updateTooltip(e, null, true);
                    NetUtils.sendRequest(reqParams);
                }
            } else {
                action = () => {
                    displayIntensity(cache_entry);
                };
            }

            this.movement_handle_ = setTimeout(
                () => {
                    if (this.last_cursor_[0] === e.pixel[0] &&
                        this.last_cursor_[1] === e.pixel[1]) action.call(this);
                }, delay);
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
    getCachedIntensities(plane, time, x, y) {
        if (this.intensities_cache_['count'] === 0) return null;
        try {
            let planeTimeEntry =
                this.intensities_cache_['intensities']["" + plane + "-" + time];
            if (typeof planeTimeEntry['pixels']["" + x + "-" + y] !== 'object')
                return null;
            return planeTimeEntry['pixels']["" + x + "-" + y];
        } catch (ex) {
            return null;
        }
    }

    cacheIntensities(intensities) {
        try {
            let plane = this.image_.getPlane();
            let time = this.image_.getTime();
            let key = "" + plane + "-" + time;

            // check if we exceed cache limit
            // if so we remove cache entries
            // preferably for other plane/time
            if (this.intensities_cache_['count'] +
                intensities['count'] > this.CACHE_LIMIT) {
                for (let tmp in this.intensities_cache_['intensities']) {
                    if (tmp !== key) {
                        this.intensities_cache_['count'] -=
                            this.intensities_cache_['intensities'][tmp]['count'];
                        delete this.intensities_cache_['intensities'][tmp];
                    }
                    if (this.intensities_cache_['count'] +
                        intensities['count'] < this.CACHE_LIMIT) break;
                }
                if (this.intensities_cache_['count'] +
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
                let planeTimeEntry = this.intensities_cache_['intensities'][key];
                for (let pixel in intensities['pixels']) {
                    if (typeof planeTimeEntry['pixels'][pixel] !== 'object')
                        planeTimeEntry['pixels'][pixel] = {}
                    // add intensity for queries channel (if not exists)
                    let pixelIntensities = intensities['pixels'][pixel];
                    for (let chan in pixelIntensities)
                        if (typeof planeTimeEntry['pixels'][pixel][chan] !== 'number') {
                            planeTimeEntry['pixels'][pixel][chan] = pixelIntensities[chan];
                            planeTimeEntry['count']++;
                            this.intensities_cache_['count']++;
                        }
                }
            }
        } catch (ex) {
            console.error("Failed to cache intensities: " + ex);
        }
    }

    /**
     * Enables/Disables intensity querying on pointerdrag
     * @param {boolean} flag if true enable intensity querying, otherwise disable it
     */
    toggleIntensityQuerying(flag) {
        // could be we have not been enabled before
        if (this.pointer_move_listener_ === null || this.image_ === null) {
            this.disable(); // just to make sure
            this.enable(this.prefix_);
        }

        if (typeof flag !== 'boolean') flag = false;
        if ((flag && this.query_intensity_) || // no change
            (!flag && !this.query_intensity_)) return this.query_intensity_;

        // change value
        return (this.query_intensity_ = flag);
    }

    /**
     * sort of destructor
     */
    disposeInternal() {
        this.disable();
    }
}
