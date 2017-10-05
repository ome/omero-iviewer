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
import {VIEWER_SET_SYNC_GROUP} from '../events/events';

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
     * ui position
     * @memberof ImageConfig
     * @type {Object}
     */
    position = {top: '50px', left: '120px'};

    /**
     * ui size
     * @memberof ImageConfig
     * @type {Object}
     */
    size = {width: '400px', height: '250px'};

    /**
     * show histogram flag
     * @memberof ImageConfig
     * @type {boolean}
     */
    show_histogram = false;

    /**
     * z-index
     * @memberof ImageConfig
     * @type {number}
     */
    zIndex = 15;

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
        // we assign it the incremented zIndex
        this.zIndex = this.context.zIndexForMDI;
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
}
