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
@inject(Context)
export class RightHandPanel {
    /**
     * which image config do we belong to (bound via template)
     * @memberof RightHandPanel
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
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

            this.context.selected_tab = e.currentTarget.hash;

            // we don't allow an active regions tab if we are in spit view
            let img_conf = this.context.getImageConfig(this.config_id);
            if (this.context.isRoisTabActive()) {
                if (img_conf === null || img_conf.regions_info === null ||
                    img_conf.image_info.projection === 'split') return;

                if (!img_conf.regions_info.ready)
                    img_conf.regions_info.requestData(true);
            };
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
        $("#panel-tabs").find("a").unbind("click");
    }
}
