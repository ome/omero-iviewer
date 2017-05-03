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
import {inject,customElement} from 'aurelia-framework';
import Context from './context';

import {
    IMAGE_CONFIG_UPDATE,
    EventSubscriber
} from '../events/events';

/**
 * @classdesc
 *
 * the app header
 * @extends EventSubscriber
 */
@customElement('header')
@inject(Context)
export class Header extends EventSubscriber {
    /**
     * events we subscribe to
     * @memberof Header
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * the selected image info
     * @memberof Header
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * shorter version of the image name
     * @memberof Header
     * @type {String}
     */
     short_image_name = ""

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Header
     */
    bind() {
        this.subscribe();
    }

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
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
        let result = this.image_info.image_name.replace("\\", "/");
        let fields = result.split("/");
        this.short_image_name = fields[fields.length-1];
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.unsubscribe();
    }
}
