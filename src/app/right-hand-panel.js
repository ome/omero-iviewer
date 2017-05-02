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
import {inject, bindable, customElement} from 'aurelia-framework';
import Context from './context';
import {REGIONS_SET_PROPERTY} from '../events/events';
import 'bootstrap';


/**
 * @classdesc
 *
 * the right hand panel
 */
@customElement('right-hand-panel')
@inject(Context, Element)
export class RightHandPanel {
    /**
     * which image config do we belong to (bound via template)
     * @memberof RightHandPanel
     * @type {number}
     */
    @bindable config_id = null;
 
    /**
     * the selected tab
     */
     selected_tab = null;

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context, element) {
        this.context = context;
        this.element = element;
        this.selected_tab = "#settings"
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RightHandPanel
     */
    attached() {
        $(this.element).find("a").click((e) => {
            e.preventDefault();

            this.selected_tab = e.currentTarget.hash;

            // we don't allow clicking the regions if we don't show them
            // or if the regions info is not present
            let img_conf = this.context.getImageConfig(this.config_id);
            if (this.selected_tab === '#rois' &&
                (img_conf === null || img_conf.regions_info === null ||
                 img_conf.regions_info.data === null ||
                 img_conf.image_info.projection === 'split')) return;

            if (!this.context.show_regions && this.selected_tab === '#rois') {
                this.context.show_regions = true;
                this.context.publish(
                    REGIONS_SET_PROPERTY, {property: "visible", value: true});
            }
            $(e.currentTarget).tab('show');
        });
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof RightHandPanel
     */
    detached() {
        $(this.element).find("a").unbind("click");
    }
}
