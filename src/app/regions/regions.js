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

// js
import Context from '../context';
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {TABS} from '../utils/constants';
import {REGIONS_STORE_SHAPES, REGIONS_SHOW_COMMENTS} from '../events/events';
import {PROJECTION} from '../utils/constants';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions section in the right hand panel
 */
@customElement('regions')
@inject(Context)
export default class Regions {
    /**
     * a bound reference to regions_info
     * and its associated change handler
     * @memberof Regions
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * a list of keys we want to listen for
     * @memberof Regions
     * @type {Object}
     */
    key_actions = [
        { key: 'S', func: this.saveShapes},                          // ctrl - s
        { key: 'Y', func: this.redoHistory},                         // ctrl - y
        { key: 'Z', func: this.undoHistory}                          // ctrl - z
    ];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Regions
     */
    attached() {
        Ui.registerKeyHandlers(this.context, this.key_actions, TABS.ROIS, this);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Regions
     */
    detached() {
        this.key_actions.map(
            (action) => this.context.removeKeyListener(action.key, TABS.ROIS));
    }

    /**
     * Saves all modified, deleted and new shapes
     *
     * @memberof Regions
     */
    saveShapes() {
        if (Misc.useJsonp(this.context.server)) {
            alert("Saving the regions will not work cross-domain!");
            return;
        }
        if (!this.regions_info.ready) return;

        this.context.publish(
            REGIONS_STORE_SHAPES,
            {config_id : this.regions_info.image_info.config_id});
    }

    /**
     * Show/Hide Text Labels
     *
     * @param {Object} event the mouse event object
     * @memberof Regions
     */
    showComments(event) {
        event.stopPropagation();
        event.preventDefault();

        if (!this.regions_info.ready) return false;

        this.regions_info.show_comments = event.target.checked;
        this.context.publish(
            REGIONS_SHOW_COMMENTS,
            {config_id : this.regions_info.image_info.config_id,
             value: this.regions_info.show_comments});
        return false;
    }

    /**
     * Undoes the last region modification
     *
     * @memberof Regions
     */
    undoHistory() {
        if (!this.regions_info.ready) return;

        this.regions_info.history.undoHistory();
    }

    /**
     * Redoes a previous region modification
     *
     * @memberof Regions
     */
    redoHistory() {
        if (!this.regions_info.ready) return;

        this.regions_info.history.redoHistory();
    }
}
