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

import {noView} from 'aurelia-framework';
import ImageInfo from './image_info';
import RegionsInfo from './regions_info';
import Misc from '../utils/misc';
import History from './history';
import {WEBGATEWAY} from '../utils/constants';
import {VIEWER_SET_SYNC_GROUP} from '../events/events';
import {CHANNEL_SETTINGS_MODE} from '../utils/constants';

/**
 * Holds the combined data/model that is relevant to working with an image:
 * ImageInfo and RegionsInfo
 */
@noView
export default class ImageConfig extends History {
    /**
     * the context
     * @memberof ImageConfig
     * @type {Context}
     */
     context = null;

    /**
     * id
     * @memberof ImageConfig
     * @type {number}
     */
    id = null;

    /**
     * revision for history
     * @memberof ImageConfig
     * @type {number}
     */
    revision = 0;

    /**
     * @memberof ImageConfig
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * @memberof ImageConfig
     * @type {RegionsInfo}
     */
    regions_info = null;

    /**
     * @memberof ImageConfig
     * @type {string}
     */
    sync_group = null;

    /**
     * @memberof ImageConfig
     * @type {Object}
     */
    sync_locks = null;

    /**
     * @memberof ImageConfig
     * @type {boolean}
     */
    show_controls = true;

    /**
     * ui position
     * @memberof ImageConfig
     * @type {Object}
     */
    position = null;

    /**
     * ui size
     * @memberof ImageConfig
     * @type {Object}
     */
    size = {width: '435px', height: '435px'};

    /**
     * show histogram flag
     * @memberof ImageConfig
     * @type {boolean}
     */
    show_histogram = false;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} image_id the image id to be queried
     * @param {number} parent_id an optional parent id
     * @param {number} parent_type an optional parent type  (e.g. dataset or well)
     */
    constructor(context, image_id, parent_id, parent_type) {
        super(); // for history
        this.context = context;
        // for now this should suffice, especially given js 1 threaded nature
        this.id = new Date().getTime();
        // go create the data objects for an image and its associated region
        this.image_info =
            new ImageInfo(
                this.context, this.id, image_id, parent_id, parent_type);
        this.regions_info = new RegionsInfo(this.image_info)
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method bind for initialization purposes
     *
     * @memberof ImageConfig
     */
    bind() {
        this.image_info.bind();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof ImageConfig
     */
    unbind() {
        this.regions_info.unbind();
        this.image_info.unbind();
    }

    /**
     * Marks a change, i.e. makes revision differ from old revision
     * @memberof ImageConfig
     */
    changed() {
        this.revision++;
    }

    /**
     * Applies the rendering settings, keeping a history of the old settings
     *
     * @param {Object} rdef the rendering definition
     * @param {boolean} for_pasting true if rdef supplied is for pasting of settings, false otherwise
     * @memberof Settings
     */
    applyRenderingSettings(rdef, for_pasting=true) {
        if (rdef === null) return;

        if (typeof for_pasting !== 'boolean') for_pasting = true;
        let imgInfo = this.image_info;
        let history = [];

        // model (color/greyscale)
        let model =
            (for_pasting && typeof rdef.m === 'string' && rdef.m.length > 0) ?
                rdef.m.toLowerCase() :
                    (!for_pasting && typeof rdef.model === 'string' &&
                        rdef.model.length > 0) ?
                            (rdef.model.toLowerCase() === 'greyscale') ?
                                "greyscale" : "color" : null;
        if (model && (model[0] === 'g' || model[0] === 'c')) {
            let oldValue = imgInfo.model;
            imgInfo.model = model[0] === 'g' ? "greyscale" : "color";
            if (oldValue !== imgInfo.model)
               history.push({ // add to history if different
                   prop: ['image_info', 'model'],
                   old_val : oldValue,
                   new_val: imgInfo.model,
                   type: 'string'});
        }

        // copy channel values and add change to history
        let channels = for_pasting ?
            Misc.parseChannelParameters(rdef.c, rdef.maps) : rdef.c;
        let mode = CHANNEL_SETTINGS_MODE.MIN_MAX;
        if (channels)
            for (let i=0;i<channels.length;i++) {
                if (typeof imgInfo.channels[i] !== 'object') continue;
                let actChannel = imgInfo.channels[i];
                let copiedChannel = channels[i];
                if (actChannel.active !== copiedChannel.active) {
                   history.push({
                       prop: ['image_info', 'channels', '' + i, 'active'],
                       old_val : actChannel.active,
                       new_val: copiedChannel.active,
                       type: 'boolean'});
                    actChannel.active = copiedChannel.active;
                }
                if (actChannel.window.start !== copiedChannel.start) {
                    history.push({
                        prop: ['image_info', 'channels',
                            '' + i, 'window', 'start'],
                        old_val : actChannel.window.start,
                        new_val: copiedChannel.start,
                        type: 'number'});
                     actChannel.window.start = copiedChannel.start;
                }
                if (actChannel.window.end !== copiedChannel.end) {
                    history.push({
                        prop: ['image_info', 'channels',
                            '' + i, 'window', 'end'],
                        old_val : actChannel.window.end,
                        new_val: copiedChannel.end,
                        type: 'number'});
                     actChannel.window.end = copiedChannel.end;
                }
                let newColor =
                    typeof copiedChannel.lut === 'string' &&
                        copiedChannel.lut.length > 0 ?
                            copiedChannel.lut : copiedChannel.color;
                if (actChannel.color !== newColor) {
                   history.push({
                       prop: ['image_info', 'channels', '' + i, 'color'],
                       old_val : actChannel.color,
                       new_val: newColor,
                       type: 'string'});
                    actChannel.color = copiedChannel.color;
                }
                if (typeof copiedChannel.inverted === 'undefined')
                    copiedChannel.inverted = null;
                if (actChannel.inverted !==
                        copiedChannel.inverted) {
                            history.push({
                                prop: ['image_info',
                                    'channels', '' + i, 'inverted'],
                                old_val : actChannel.inverted,
                                new_val: copiedChannel.inverted,
                                type: 'boolean'});
                    actChannel.inverted =
                        copiedChannel.inverted;
                }
                if (typeof copiedChannel['family'] === 'string' &&
                    copiedChannel['family'] !== "" &&
                    typeof copiedChannel['coefficient'] === 'number' &&
                    !isNaN(copiedChannel['coefficient'])) {
                        history.push({
                            prop: ['image_info', 'channels', '' + i, 'family'],
                            old_val : actChannel.family,
                            new_val: copiedChannel.family,
                            type: 'string'});
                         actChannel.family = copiedChannel.family;
                        history.push({
                            prop: ['image_info', 'channels', '' + i, 'coefficient'],
                            old_val : actChannel.coefficient,
                            new_val: copiedChannel.coefficient,
                            type: 'string'});
                         actChannel.coefficient = copiedChannel.coefficient;
                }
            };
        if (history.length > 0) {
            history.splice(0, 0,
                {   prop: ['image_info','initial_values'],
                    old_val : true,
                    new_val:  true,
                    type : "boolean"});
            this.addHistory(history);
        }

        this.changed();
    }

    /**
     * Adds/removes the image config from the sync group
     * @param {string|null} sync_group the new sync group or null
     * @memberof ImageConfig
     */
    toggleSyncGroup(sync_group=null) {
        if (this.sync_group === sync_group) return;
        let oldSyncGroup =
            typeof this.sync_group === 'string' ?
                this.context.sync_groups.get(this.sync_group) : null;
        // take out old sync group
        if (typeof oldSyncGroup === 'object' && oldSyncGroup !== null) {
            let index = oldSyncGroup.members.indexOf(this.id);
            if (index !== -1) oldSyncGroup.members.splice(index, 1);
            this.sync_group = null;
            this.sync_locks = null;
        }
        // add new sync group (if exists)
        let newSyncGroup =
            typeof sync_group === 'string' ?
                this.context.sync_groups.get(sync_group) : null;
        if (typeof newSyncGroup === 'object' && newSyncGroup !== null) {
            newSyncGroup.members.push(this.id);
            this.sync_group = sync_group;
            this.sync_locks = newSyncGroup.sync_locks;
        }
        this.context.publish(
            VIEWER_SET_SYNC_GROUP,
            {config_id: this.id, "sync_group": this.sync_group});
    }

    /**
     * Sends ajax request, saving the image settings
     * @param {function} success the success handler
     * @param {function=} error the error handler
     * @memberof ImageConfig
     */
    saveImageSettings(success, error) {
        if (!this.image_info.ready ||
            !this.image_info.can_annotate ||
            this.history.length === 0 ||
            this.historyPointer < 0 ||
            typeof success !== 'function') return;

        if (Misc.useJsonp(this.context.server)) {
            console.error(
                "Saving the rendering settings will not work cross-domain!");
            return;
        }

        let image_info = this.image_info;
        let url =
            this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
            "/saveImgRDef/" +
            image_info.image_id + '/?m=' + image_info.model[0] +
            "&p=" + image_info.projection +
            "&t=" + (image_info.dimensions.t+1) +
            "&z=" + (image_info.dimensions.z+1) +
            "&q=0.9&ia=0";
        url = Misc.appendChannelsAndMapsToQueryString(image_info.channels, url);

        if (typeof error !== 'function')
            error = (error) => console.error(error);
        $.ajax({
            'url': url, 'method': 'POST',
            'success': success, 'error': error
        });
    }
}
