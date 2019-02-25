//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import JSONFeature from 'ol/format/JSONFeature';
import {createFeatureFromShape} from '../utils/Regions';

/**
* @classdesc
* Feature format for reading and writing data in the OME JSON format.
*
* @api
*/
class OmeJSON extends JSONFeature {

    /**
    * @param {Options=} opt_options Options.
    */
    constructor(opt_options) {

        const options = opt_options ? opt_options : {};

        super();

        this.projection = options.projection;

        this.regions = options.regions;

    }

    /**
     * Creates Features from JSON response string
     *
     * @param {string} source Text response from AJAX call
     * @param {object} opt_options Options
     */
    readFeatures(source, opt_options) {
        let responseJSON = JSON.parse(source);
        let shapesJSON = responseJSON.data;

        let features = shapesJSON.map((shape) => {
            shape.type = shape['@type'].split('#')[1].toLowerCase();

            // create features with a Style function that references Regions
            let feature = createFeatureFromShape(shape, this.regions);
            // Feature ID is 'roiId:shapeId'
            feature.setId(shape['roi']['@id'] + ":" + shape['@id']);
            ['TheZ', 'TheC', 'TheT'].forEach(dim => {
                feature[dim] = typeof shape[dim] === 'number' ? shape[dim] : -1
            });
            return feature;
        });

        return features;
    };

    /**
     * Override this to simply return the OMERO Projection
     *
     * @param {*} source
     */
    readProjection(source) {
        return this.projection;
    }
}

export default OmeJSON;
