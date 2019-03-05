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

// js
import Context from '../app/context';
import { IVIEWER, ROI_TABS } from '../utils/constants';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

/**
 * Represents the regions planes sub-tab in the right hand panel
 */
@customElement('regions-planes')
@inject(Context, BindingEngine)
export default class RegionsPlanes {
    /**
     * a bound reference to regions_info
     * and its associated change handler
     * @memberof RegionsPlanes
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * When the regions_info changes, force load/refresh data
     * @param {RegionsInfo} newVal
     * @param {RegionsInfo} oldVal
     */
    regions_infoChanged(newVal, oldVal) {
        if (this.selected_roi_tab === ROI_TABS.ROI_PLANE_GRID) {
            this.requestData(true);
        }
    }

    /**
     * The current ROI sub-tab selected by the parent regions component
     */
    @bindable selected_roi_tab = null;

    /**
     * When the selected_roi_tab changes, load data (if not already loaded)
     * @param {String} newVal
     * @param {String} oldVal
     */
    selected_roi_tabChanged(newVal, oldVal) {
        if (this.selected_roi_tab === ROI_TABS.ROI_PLANE_GRID) {
            this.requestData();
        }
    }

    /**
     * the list of property observers
     * @memberof RegionsPlanes
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * 2D array of [z][t] shapes counts
     */
    plane_shape_counts = null;

    /**
     * Max number of shapes on a single plane
     * @type {Number}
     */
    max_shape_count = 0;

    /**
     * Min number of shapes on a single plane
     * @type {Number}
     */
    min_shape_count = 0;

    /**
     * Flag to indicate when we are loading data
     * @type {Boolean}
     */
    is_pending = false;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
    }

    requestData(refresh=false) {
        if (this.plane_shape_counts != null && !refresh) {
            // Data already loaded
            return;
        }
        this.is_pending = true;

        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(IVIEWER) +
                "/plane_shape_counts/" + this.regions_info.image_info.image_id + '/',
            success : (response) => {
                this.is_pending = false;
                let shape_counts = [];
                let max_count = 1;
                let min_count = Infinity;
                // switch 2D array [z][t] to [t][z] to aid layout
                for (let t=0; t<response.data[0].length; t++) {
                    let t_counts = [];
                    for (let z=0; z<response.data.length; z++) {
                        let value = response.data[z][t];
                        min_count = Math.min(min_count, value);
                        max_count = Math.max(max_count, value);
                        t_counts.push(value);
                    }
                    shape_counts.push(t_counts);
                }
                this.plane_shape_counts = shape_counts;
                this.max_shape_count = max_count;
                this.min_shape_count = min_count;
            },
            error : (error, textStatus) => {
                this.is_pending = false;
                if (typeof error.responseText === 'string') {
                    console.error(error.responseText);
                }
            }
        });
    }

    /**
     * Simple copy and reverse of Array
     * @param {Array} arr
     */
    reverse(arr) {
        if (!arr) return [];
        return arr.slice().reverse();
    }

    /**
     * Return a css color to represent the given number as proportion of
     * this.max_shape_count.
     *
     * @param {Number} count
     */
    getColor(count) {
        if (count === 0) {
            return '#ddd';
        }
        let percent = (count - this.min_shape_count) * 100 / 
            (this.max_shape_count - this.min_shape_count);
        if (this.min_shape_count === this.max_shape_count) {
            percent = 100;
        }
        // return `hsl(229, ${ percent }%, 50%)`
        return `rgba(2, 141, 255, ${ (percent / 80) + 0.2 })`
    }
}
