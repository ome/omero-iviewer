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
import Misc from '../utils/misc';
import ImageConfig from '../model/image_config';
import {noView} from 'aurelia-framework';
import {
    CHANNEL_SETTINGS_MODE, FLOATING_POINT_PRECISION
} from '../utils/constants';

/**
 * Contains functionality that is used in MDI mode for linked image configs
 * to achieve a "locking"/"syncing" of -broadly speaking- features/behavior
 * Depending on what needs to be achieved the respective function
 * is going to need to handle one or more of the following:
 * - data synchronization
 * - history logging
 * - respective ol3 viewer calls
 * - safeguards to prevent event cycles
 */
@noView
export default class Ol3ViewerLinkedEvents {
    ol3_viewer = null;

    /**
     * @constructor
     * @param {Ol3Viewer} ol3_viewer a reference to the Ol3Viewer instance
     */
    constructor(ol3_viewer) {
        this.ol3_viewer = ol3_viewer;
    }

    /**
     * Checks whether our OL3Viewer references are valid
     *
     * @memberof Ol3ViewerLinkedEvents
     * @return {boolean} true if we have a valid instance of an Ol3Viewer
     */
    hasViewerInstance() {
        return this.ol3_viewer !== null && this.ol3_viewer.viewer !== null;
    }

    /**
     * Returns a viewer instance or null
     *
     * @memberof Ol3ViewerLinkedEvents
     * @return {Ol3Viewer} an instance of the viewer
     */
    getViewer() {
        if (!this.hasViewerInstance()) return null;
        return this.ol3_viewer.viewer;
    }

    /**
     * Returns the image config (data) or null
     *
     * @memberof Ol3ViewerLinkedEvents
     * @return {ImageConfig|null} the ImageConfig or null
     */
    getImageConfig() {
        if (!this.hasViewerInstance()) return null;

        return this.ol3_viewer.image_config;
    }

    /**
     * Enables/disabled event sending
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {boolean} flag if true we allow event publishing, otherwise not
     */
    preventEventPublish(flag = false) {
        if (!this.hasViewerInstance()) return;

        this.ol3_viewer.context.prevent_event_notification = flag;
    }

    /**
     * Checks whether the present Ol3Viewer instance (and its ImageConfig)
     * are linked to the given image config id
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {number} config_id a config id
     * @return {boolean} true if the present instance is linked to the given id
     */
    isValidAndLinkedViewerInstance(config_id) {
        let imgConf = this.getImageConfig();
        if (!(imgConf instanceof ImageConfig)) return false;

        return imgConf.linked_image_config === config_id;
    }

    /**
     * Handles the following image changes for linked image configs:
     * - channel range (start, end, color, reverse)
     * - color/grayscale
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     */
    changeImageSettings(params = {}) {
        if (!this.isValidAndLinkedViewerInstance(params.config_id)) return;

        let conf = this.getImageConfig();
        // only if the lock flag for c is set
        if (!conf.dimension_locks.c) return;

        if (typeof params.model === 'string') {
            let oldValue = conf.image_info.model;
            let newValue = params.model;
            if (oldValue !== newValue) {
                // update data
                conf.image_info.model = newValue;
                // add a change entry
                conf.addHistory({
                    prop: ['image_info', 'model'],
                    old_val : oldValue, new_val: newValue, type: 'string'});
                // propagate to ol3 viewer
                this.getViewer().changeImageModel(params.model);
            }
        } else if (Misc.isArray(params.ranges) && params.ranges.length > 0) {
            // make a copy because we need to alter it potentially
            // if we exceed bounds and have to clamp at the min/max
            let ranges = params.ranges.map((r) => Object.assign({}, r));
            let channels = conf.image_info.channels;
            let minMaxRange =
                conf.image_info.getChannelMinMaxValues(
                    CHANNEL_SETTINGS_MODE.FULL_RANGE, 0,
                    FLOATING_POINT_PRECISION);
            let history = [];
            for (let i=0;i<params.ranges.length;i++) {
                let c = params.ranges[i];
                // we have to have matching channel indices
                if (c.index < channels.length) {
                    let min = minMaxRange.start_min;
                    let max = minMaxRange.end_max;
                    let step_size = minMaxRange.step_size;
                    // propagate channel properties
                    for (let prop in c) {
                        if (prop === 'index') continue;
                        let oldValue = null;
                        let newValue = c[prop];
                        if (prop === 'start' || prop === 'end') {
                            oldValue = channels[c.index].window[prop];
                            // bound checks
                            if ((prop === 'start' && newValue >= max) ||
                                (prop === 'end' && newValue <= min)) {
                                    // we are totally outside...
                                    // stick to old values
                                    newValue = oldValue;
                            } else {
                                // we are part in the range...
                                // clamp to min/max
                                if (prop === 'start' && newValue < min)
                                    newValue = min;
                                if (prop === 'end' && newValue > max)
                                    newValue = max;
                                let otherProp =
                                    prop === 'start' ? 'end' : 'start';
                                let otherVal =
                                    channels[c.index].window[otherProp];
                                // if we don't have the minimum step size
                                // in between the 2 end points we also keep
                                // the old value
                                if (Math.abs(otherVal - newValue) <
                                    step_size) newValue = oldValue;
                            }
                            channels[c.index].window[prop] = newValue;
                        } else if (prop === 'reverse') {
                            // TODO: remove after reverse intensity rename
                            oldValue = channels[c.index]['reverseIntensity'];
                            channels[c.index]['reverseIntensity'] = newValue;
                        } else {
                            oldValue = channels[c.index][prop];
                            channels[c.index][prop] = newValue;
                        }
                        ranges[i][prop] = newValue;
                        // write history entry
                        if (newValue !== oldValue) {
                            let p =
                                ['image_info', 'channels', '' + c.index];
                            if (prop === 'start' || prop === 'end')
                                p.push('window');
                            // TODO: remove after reverse intensity rename
                            if (prop === 'reverse')
                                p.push('reverseIntensity');
                            else p.push(prop);
                            history.push({
                                prop: p,
                                old_val : oldValue, new_val: newValue,
                                type: typeof c[prop]
                            });
                        }
                    }
                }
            }
            if (history.length > 0) {
                conf.addHistory(history);
                this.getViewer().changeChannelRange(ranges);
            }
        }
    }

    /**
     * Deals with dimension changes for linked image configs
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     */
    setDimensionIndex(params = {}) {
        if (!this.isValidAndLinkedViewerInstance(params.config_id)) return;

        let conf = this.getImageConfig();
        // only if the lock flag for c is set
        if (!conf.dimension_locks[params.dim]) return;

        let dims = conf.image_info.dimensions;
        let oldValue = dims[params.dim];
        let dim_max = dims['max_' + params.dim];
        let newValue = params.value[0];
        // we must not exceed the bound
        if (newValue >= dim_max) return;

        this.preventEventPublish(true);
        try {
            if (oldValue !== newValue) {
                // update data
                dims[params.dim] = newValue;
                // add a change entry
                conf.addHistory({
                    prop: ['image_info', 'dimensions', params.dim],
                    old_val : oldValue, new_val: newValue, type: 'number'});
                // propagate to ol3 viewer
                this.getViewer().setDimensionIndex(params.dim, [newValue]);
            }
        } catch(just_in_case) {
            console.error(just_in_case);
        }
        this.preventEventPublish(false);
    }

    /**
     * Synchronizes zoom and center of any linked Ol3 Viewer
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     */
    syncLinkedViewer(params = {}) {
        if (!this.isValidAndLinkedViewerInstance(params.config_id)) return;

        this.getViewer().setCenterAndResolution(
            params.center, params.resolution);
    }
}
