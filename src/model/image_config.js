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
import ImageInfo from '../model/image_info';
import RegionsInfo from '../model/regions_info';
import ImageAnnotations from '../model/image_annotations';
import Misc from '../utils/misc';
import History from './history';

/**
 * Holds the combined data/model that is relevant to working with an image:
 * ImageInfo and RegionsInfo
 */
@noView
export default class ImageConfig extends History {
    /**
     * id
     * @memberof ImageConfig
     * @type {number}
     */
    id = null;

    /**
     * revision for history
     * @memberof ImageConfig
     * @type {ImageInfo}
     */
    old_revision = 0;

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
     * @type {ImageAnnotations}
     */
    image_annotations = null;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} image_id the image id to be queried
     * @param {number} parent_id an optional parent id
     * @param {number} parent_type an optional parent type  (e.g. dataset or well)
     */
    constructor(context, image_id, parent_id, parent_type) {
        super(); // for history
        // for now this should suffice, especially given js 1 threaded nature
        this.id = new Date().getTime();
        // go create the data objects for an image and its associated region
        this.image_info =
            new ImageInfo(context, this.id, image_id, parent_id, parent_type);
        this.regions_info = new RegionsInfo(this.image_info)
        this.image_annotations = new ImageAnnotations(context, image_id);
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
     * Returns whether the revisions align or there has been a change
     * @memberof ImageConfig
     * @return {boolean} true if the revisions changed, i.e. if we need to save to history
     */
    hasChanged() {
        return this.old_revision !== this.revision;
    }

    /**
     * Marks a change, i.e. makes revision differ from old revision
     * @memberof ImageConfig
     */
    changed() {
        this.revision++;
    }
}
