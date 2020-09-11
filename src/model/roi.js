
//
// Copyright (C) 2020 University of Dundee & Open Microscopy Environment.
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

import { observable } from 'aurelia-framework';
import { Converters } from '../utils/converters';
import { REGIONS_REQUEST_URL } from '../utils/constants';

export default class Roi {
    // observe when ROI is expanded in table
    @observable expanded = false;
    deleted = 0;
    name = '';
    shapes = new Map();
    shape_count = 0;
    shapes_loaded = true;
    roi_id;

    constructor(roi, api_url) {
        this.roi_id = roi['@id'];
        this.name = roi['Name'] || '';
        this.shapes = this.createShapesFromJson(roi);
        this.shape_count = roi.shape_count !== undefined ? roi.shape_count : this.shapes.size;
        this.api_url = api_url;
        this.shapes_loaded = this.shape_count === this.shapes.size;
    }

    // Called by @observable when expanded changes
    expandedChanged(new_value) {
        if (!new_value || this.shapes_loaded) {
            return;
        }
        this.requestShapes()
    }

    requestShapes() {
        let url = this.api_url + REGIONS_REQUEST_URL + '/' + this.roi_id + '/';

        $.ajax({
            url,
            success: (response) => {
                this.shapes = this.createShapesFromJson(response.data);
                this.shapes_loaded = true;
            }, error: (error) => {
                console.error("Failed to load Shapes for ROI: " + error)
            }
        });
    }

    createShapesFromJson(roi) {
        // some shapes might already be loaded and selected
        let selected_shapes = [];
        let hidden_shapes = [];
        if (this.shapes.values()) {
            selected_shapes = [...this.shapes.values()].filter(s => s.selected).map(s => s.shape_id);
            hidden_shapes = [...this.shapes.values()].filter(s => !s.visible).map(s => s.shape_id);
        }

        let shapes = new Map();
        if (roi.shapes && roi.shapes.length > 0) {
            let roiId = roi['@id'];
            roi.shapes.sort(function (s1, s2) {
                var z1 = parseInt(s1['TheZ']);
                var z2 = parseInt(s2['TheZ']);
                var t1 = parseInt(s1['TheT']);
                var t2 = parseInt(s2['TheT']);
                if (z1 === z2) {
                    return (t1 < t2) ? -1 : (t1 > t2) ? 1 : 0;
                }
                return (z1 < z2) ? -1 : 1;
            });
            for (let s in roi.shapes) {
                let shape = roi.shapes[s];
                let newShape =
                    Converters.amendShapeDefinition(
                        Object.assign({}, shape));
                let shapeId = newShape['@id']
                newShape.shape_id = "" + roiId + ":" + shapeId;
                // we add some flags we are going to need
                newShape.selected = selected_shapes.includes(newShape.shape_id);
                newShape.visible = !hidden_shapes.includes(newShape.shape_id);
                newShape.deleted = false;
                newShape.modified = false;
                shapes.set(shapeId, newShape);
            }
        }
        return shapes;
    }
}
