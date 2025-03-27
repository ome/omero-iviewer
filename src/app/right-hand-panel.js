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
import {inject, customElement, BindingEngine} from 'aurelia-framework';
import Context from './context';
import {PROJECTION, TABS} from '../utils/constants';
import 'bootstrap';

/**
 * @classdesc
 *
 * the right hand panel
 */
@customElement('right-hand-panel')
@inject(Context, BindingEngine)
export class RightHandPanel {
    /**
     * expose TABS constants to template (no other way in aurelia)
     */
    TABS = TABS;

    /**
     * the selected image config
     * @memberof RightHandPanel
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * observer listening for image config changes
     * @memberof RightHandPanel
     * @type {Object}
     */
    observer = null;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
        // set initial image config
        // NB: This will likely be null initially
        this.image_config = this.context.getSelectedImageConfig();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof RightHandPanel
     */
    bind() {
        // listen for image config changes
        this.observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config').subscribe(
                    (newValue, oldValue) => {
                        this.image_config = this.context.getSelectedImageConfig();
                        // If multi-view mode (image data is already loaded),
                        // may need to load ROIs for selected image.
                        this.makeInitialRoisRequestIfRoisTabIsActive();
                });
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RightHandPanel
     */
    unbind() {
        // get rid of observer
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RightHandPanel
     */
    attached() {
        $("#panel-tabs").find("a").click((e) => {
            e.preventDefault();
            this.context.selected_tab = e.currentTarget.hash.substring(1);
            this.makeInitialRoisRequestIfRoisTabIsActive();
            $(e.currentTarget).tab('show');
        });

        // If ROI ID is set, show ROIs tab:
        if (this.image_config && this.image_config.image_info &&
                (this.image_config.image_info.initial_roi_id || this.image_config.image_info.initial_shape_id)) {
            // This will trigger image_info to load ROIs once image data is loaded
            this.context.selected_tab = TABS.ROIS;
        }
    }

    /**
     * Requests rois if tab is active and rois have not yet been requested
     * and image_info is ready.
     *
     * @memberof RightHandPanel
     */
    makeInitialRoisRequestIfRoisTabIsActive() {
        if (this.context.isRoisTabActive()) {
            // If image_info is not yet ready (still loading) then ROIs will be
            // requested when image_info is loaded. We don't want to load ROIs
            // before image_info since we won't know image_info.roi_count
            // (don't know if we need to paginate ROIs)
            if (this.image_config === null ||
                !this.image_config.image_info.ready ||
                this.image_config.regions_info === null) return;

            this.image_config.regions_info.requestData();
        };
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof RightHandPanel
     */
    detached() {
        $("#panel-tabs").find("a").unbind("click");
    }
}
