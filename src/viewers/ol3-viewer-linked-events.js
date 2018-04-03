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
    CHANNEL_SETTINGS_MODE, FLOATING_POINT_PRECISION, SYNC_LOCK
} from '../utils/constants';

/**
 * Deals with "locking"/"syncing" of features/behavior for MDI mode
 * Depending on the action the respective function is going to handle
 * one or more of the following:
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
     * Checks whether the image config belongs to the given sync group
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {string} sync_group the sync group to check against
     * @return {boolean} true if the image config id part of a group
     */
    isMemberOfSyncGroup(sync_group = null) {
        let conf = this.getImageConfig();
        if (conf === null ||
            typeof sync_group !== 'string' ||
            sync_group.length === 0) return false;
        return conf.sync_group === sync_group;
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
     * Syncs action (if group member)
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Objct} params the event notification parameters
     * @param {string} action the action i.e. matching function
     */
    syncAction(params={}, action="") {
        // preliminary checks if we are part of a group
        // and input params are good
        if (!this.isMemberOfSyncGroup(params.sync_group) ||
            typeof action !== "string" || action.length === "" ||
            typeof this[action] !== "function") return;

        let func = this[action];
        let conf = this.getImageConfig();
        let group = this.ol3_viewer.context.sync_groups.get(conf.sync_group);
        // one more cross-check
        if (group.members.indexOf(conf.id) === -1) return;

        // delegate to local syncing function
        func.call(this, params, group.sync_locks);
    }

    /**
     * Checks whether the sync lock is set for a specific group
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {string} lock the lock, e.g z, t, c or v
     * @param {Object} sync_locks the sync locks for the group
     * @return {boolean} true if locked, otherwise false
     */
     isLocked(lock = "", sync_locks = {}) {
         if (typeof sync_locks !== 'object' ||
            sync_locks === null ||
            typeof lock !== 'string') return false;

         return sync_locks[lock];
     }


    /**
     * Handles the following image changes of sync_group members:
     * - channel range (start, end, color, reverse)
     * - color/grayscale
     * - projection
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     * @param {Object} sync_locks the sync locks for the group
     */
    changeImageSettings(params = {}, sync_locks = {}) {
        if (!this.isLocked(SYNC_LOCK.CHANNELS.CHAR, sync_locks)) return;

        let conf = this.getImageConfig();
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
                            p.push(prop);
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
     * Deals with projection changes of sync_group members
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     * @param {Object} sync_locks the sync locks for the group
     */
    setProjection(params = {}, sync_locks = {}) {
        if (!this.isLocked(SYNC_LOCK.ZT.CHAR, sync_locks)) return;

        let history = [];
        let conf = this.getImageConfig();
        let oldProjectionValue = conf.image_info.projection;
        let newProjectionValue = params.projection;
        if (oldProjectionValue !== newProjectionValue) {
            // update data
            conf.image_info.projection = newProjectionValue;
            // add a change entry
            history.push({
                prop: ['image_info', 'projection'],
                old_val : oldProjectionValue, new_val: newProjectionValue,
                type: 'string'});
        }
        let oldProjectionOpts = conf.image_info.projection_opts;
        let newProjectionOpts = Object.assign({}, params.projection_opts);
        let maxZ = conf.image_info.dimensions.max_z-1;
        if (newProjectionOpts.start > maxZ) newProjectionOpts.start = maxZ;
        if (newProjectionOpts.end > maxZ) newProjectionOpts.end = maxZ;
        if (oldProjectionOpts.start !== newProjectionOpts.start ||
            oldProjectionOpts.end !== newProjectionOpts.end) {
                // update data
                conf.image_info.projection_opts = newProjectionOpts;
                // add a change entry
                history.push({
                    prop: ['image_info', 'projection_opts'],
                    old_val : Object.assign({}, oldProjectionOpts),
                    new_val: Object.assign({}, newProjectionOpts),
                    type: 'object'});
        }
        if (history.length > 0) {
            history.splice(0,0, {
                prop: ['image_info', 'projection_opts', 'synced'],
                old_val : false, new_val: false, type : "boolean"
            });
            conf.addHistory(history);
            // propagate change to ol3 viewer
            this.getViewer().changeImageProjection(
                params.projection, newProjectionOpts);
            // hack to indicate that we have been synced
            conf.image_info.projection_opts.synced = true;
        }
    }

    /**
     * Deals with dimension changes of sync_group members
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     * @param {Object} sync_locks the sync locks for the group
     */
    setDimensionIndex(params = {}, sync_locks = {}) {
        if (!this.isLocked(SYNC_LOCK.ZT.CHAR, sync_locks)) return;

        let conf = this.getImageConfig();
        let history = [];
        let oldProjectionValue = conf.image_info.projection;
        let newProjectionValue = params.projection;
        if (oldProjectionValue !== newProjectionValue) {
            // update data
            conf.image_info.projection = newProjectionValue;
            conf.image_info.projection_opts.synced = false;
            // add a change entry
            history.push({
                prop: ['image_info', 'projection_opts', 'synced'],
                old_val : false, new_val: false, type : "boolean"
            });
            history.push({
                prop: ['image_info', 'projection'],
                old_val : oldProjectionValue, new_val: newProjectionValue,
                type: 'string'});
        }

        let dims = conf.image_info.dimensions;
        let oldValue = dims[params.dim];
        let dim_max = dims['max_' + params.dim]-1;
        let newValue = params.value[0];
        // we must not exceed the bound
        if (newValue > dim_max) newValue = dim_max;

        this.preventEventPublish(true);
        try {
            if (oldValue !== newValue) {
                // update data
                dims[params.dim] = newValue;
                // add a change entry
                history.push({
                    prop: ['image_info', 'dimensions', params.dim],
                    old_val : oldValue, new_val: newValue, type: 'number'});
                // propagate to ol3 viewer
                this.getViewer().setDimensionIndex(params.dim, [newValue]);
            }
            if (history.length > 0) conf.addHistory(history);
        } catch(just_in_case) {
            console.error(just_in_case);
        }
        this.preventEventPublish(false);
    }

    /**
     * Synchronizes zoom and center of sync_group members
     *
     * @memberof Ol3ViewerLinkedEvents
     * @param {Object} params the event notification parameters
     * @param {Object} sync_locks the sync locks for the group
     */
    syncView(params = {}, sync_locks = {}) {
        if (!this.isLocked(SYNC_LOCK.VIEW.CHAR, sync_locks)) return;

        let w = params.w;
        let h = params.h;
        // adjust center for different size images
        if (typeof w === 'number' && typeof h === 'number' &&
            !isNaN(w) && !isNaN(h) && w > 0 && h > 0) {

            let conf = this.getImageConfig();
            let width = conf.image_info.dimensions.max_x;
            let height = conf.image_info.dimensions.max_y;

            params.center = [
                params.center[0] * (width / w),
                params.center[1] * (height / h)
            ];
        } else params.center = params.center.slice();

        this.getViewer().setViewParameters(
            params.center, params.resolution, params.rotation);
    }
}
