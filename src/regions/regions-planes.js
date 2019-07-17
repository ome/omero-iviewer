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

import {computedFrom} from 'aurelia-framework';
import Context from '../app/context';
import Ui from '../utils/ui';
import { IVIEWER, ROI_TABS,
    PROJECTION} from '../utils/constants';
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

        // Pick one of 5 colors
        let index = Math.round(percent/25);
        let colors = ['rgb(212, 222, 223)', 'rgb(178, 189, 193)', 'rgb(149, 153, 164)',
                    'rgb(90, 89, 109)', 'rgb(20, 18, 30)']
        return colors[index];
    }

    /**
     * Handle clicking on a grid Cell - select the corresponding T and Z index/range
     *
     * @param {Event} event
     * @param {Number} zIndex clicked Z-index
     * @param {Number} tIndex clicked T-index
     */
    handleGridClick(event, zIndex, tIndex) {
        if (!this.checkForUnsavedRoiLoss()) {
            return;
        }
        zIndex = parseInt(zIndex);
        tIndex = parseInt(tIndex);
        // T-index doesn't support projection - simply select it
        this.regions_info.image_info.dimensions['t'] = tIndex;
        // Support Shift-click to select Z-range (projection)
        if (!event.shiftKey) {
            // select single Z plane (no projection)
            this.regions_info.image_info.projection = PROJECTION.NORMAL;
            this.regions_info.image_info.dimensions['z'] = zIndex;
        } else {
            // select range...
            // If projection enabled, update start/end (whichever is closest to zIndex)
            if (this.regions_info.image_info.projection === PROJECTION.INTMAX) {
                let start = this.regions_info.image_info.projection_opts.start;
                let end = this.regions_info.image_info.projection_opts.end;
                let midPoint = (start + end)/2;
                if (zIndex < midPoint) {
                    this.regions_info.image_info.projection_opts.start = zIndex;
                } else {
                    this.regions_info.image_info.projection_opts.end = zIndex;
                }
            } else {
                // If projection not enabled, select range from current Z
                this.regions_info.image_info.projection = PROJECTION.INTMAX;
                this.regions_info.image_info.projection_opts.start = Math.min(
                    zIndex, this.regions_info.image_info.dimensions.z
                )
                this.regions_info.image_info.projection_opts.end = Math.max(
                    zIndex, this.regions_info.image_info.dimensions.z
                )
            }
        }
    }

    /**
     * Any change in Z/T or projection will cause ROIs to reload if we are
     * paginating ROIs by Z/T plane.
     * Returns true if we are paginating ROIs by plane AND we have unsaved
     * changes to ROIs.
     */
    checkForUnsavedRoiLoss() {
        if (this.regions_info.isRoiLoadingPaginatedByPlane() &&
                this.regions_info.hasBeenModified()) {
            Ui.showModalMessage(
                "You have unsaved ROI changes. Please Save or Undo " +
                "before moving to a new plane.",
                "OK");
            return false;
        } else {
            return true;
        }
    }

    /**
     * Allow template to know which Z-planes are selected, depending on
     * Z-projection or Z-index.
     */
    @computedFrom('regions_info.image_info.dimensions.z',
                'regions_info.image_info.projection',
                'regions_info.image_info.projection_opts.start',
                'regions_info.image_info.projection_opts.end')
    get selectedZ() {
        let imgInf = this.regions_info.image_info;
        let zPlanes = [];
        if (imgInf.projection === PROJECTION.INTMAX) {
            let opts = imgInf.projection_opts;
            for(let z=opts.start; z<=opts.end; z++) {
                zPlanes.push(z);
            }
        } else {
            zPlanes.push(imgInf.dimensions.z);
        }
        return zPlanes;
    }

    /**
     * Allow template to use parseInt.
     *
     * @param {String} number
     */
    toInt(number) {
        return parseInt(number)
    }
}
