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
import Misc from '../utils/misc';
import {IVIEWER, TABS} from '../utils/constants';

/**
 * Contains the annotations linked to an image
 */
@noView
export default class ImageAnnotations {
    /**
     * the app context
     * @memberof ImageAnnotations
     * @type {Context}
     */
    context = null;

    /**
     * the image id
     * @memberof ImageAnnotations
     * @type {number}
     */
    image_id = null;

    /**
     * a flag that signals whether we have successfully
     * executed the annotations request
     * @memberof ImageAnnotations
     * @type {boolean}
     */
    ready = false;

    /**
     * the image id
     * @memberof ImageAnnotations
     * @type {number}
     */
    annotations = [];

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} image_id the image id to be queried
     */
    constructor(context, image_id) {
        this.context = context;
        this.image_id = image_id;

        if (this.context.selected_tab === TABS.ANNOTATIONS)
            this.requestData(true);
    }

    /**
     * Requests the annotations for the image
     * @param {boolean} force if true we force a request even though we have
     *                        done so before
     * @memberof ImageAnnotations
     */
    requestData(force = false) {
        if (this.ready && !force) return;
        this.annotations.splice(0, this.annotations.length);
        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(IVIEWER) +
                "/get_annotations/?image=" + this.image_id,
            success : (response) => {
                if (typeof response === 'object' &&
                    Misc.isArray(response.annotations)) {
                        // extract type without schema prefix
                        for (let a in response.annotations) {
                            let ann = response.annotations[a];
                            let type = ann['@type'];
                            ann['type'] = type.substring(type.lastIndexOf("#")+1);
                            delete ann['@type'];
                            this.annotations.push(ann);
                        }
                    }
                this.ready = true;
            },
            error : (error) => {
                this.ready = true;
                console.error(error);
            }
        });
    }
}
