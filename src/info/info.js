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
import Context from '../app/context';
import Misc from '../utils/misc';
import {WEBCLIENT} from '../utils/constants';

import {inject, customElement, bindable} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE,
    EventSubscriber
} from '../events/events';


@customElement('info')
@inject(Context)
export class Info extends EventSubscriber {

    /**
     * events we subscribe to
     * @memberof Header
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * which image config do we belong to (bound in template)
     * @memberof Regions
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image info
     * @memberof Info
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * Values to display
     * @memberof Info
     */
    columns = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Info
     */
    bind() {
        this.subscribe();
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof Header
     * @param {Object} params the event notification parameters
     */
    onImageConfigChange(params = {}) {
        let conf = this.context.getImageConfig(params.config_id);

        if (conf === null) return;
        this.image_info = conf.image_info;
        let acquisition_date = "-";
        if (typeof this.image_info.image_pixels_size.x == 'number') {
            acquisition_date = new Date(this.image_info.image_timestamp * 1000).toISOString().slice(-25, -14);
        }
        let pixels_size = "";
        if (typeof this.image_info.image_pixels_size === 'object') {
            let count = 0;
            if (typeof this.image_info.image_pixels_size.x == 'number') {
                pixels_size += Number(this.image_info.image_pixels_size.x).toFixed(2);
            } else {
               pixels_size += "-";
               count++;
            }
            pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.y == 'number') {
                pixels_size += Number(this.image_info.image_pixels_size.y).toFixed(2);
            } else {
                pixels_size += "-";
                count++;
            }
            pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.z == 'number') {
                pixels_size += Number(this.image_info.image_pixels_size.z).toFixed(2);
            } else {
                pixels_size += "-";
                count++;
            }
            if (count === 3) {
                pixels_size = "Not available"
            }
        }
        this.columns = [
            {"label": "Image ID:",
             "value": this.image_info.image_id,
            },
            {"label": "Name:",
             "value": this.image_info.image_name,
            },
            {"label": "Owner:",
             "value": this.image_info.author,
            },
            {"label": "Acquisition Date:",
             "value": acquisition_date,
            },
            {"label": "Pixels Type:",
             "value": this.image_info.image_pixels_type,
            },
            {"label": "Pixels Size (XYZ):",
             "value": pixels_size,
            },
            {"label": "Z-sections:",
             "value": this.image_info.dimensions.max_z,
            },
            {"label": "Timepoints:",
             "value": this.image_info.dimensions.max_t,
            }
        ];
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Info
     */
    unbind() {
        this.unsubscribe();
        this.image_info = null;
        this.columns = [];
    }

}
