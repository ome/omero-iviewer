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
import Context from '../context';
import {Utils} from '../utils/regions';
import {Converters} from '../utils/converters';
import {REGIONS_DRAWING_MODE} from '../utils/constants';
import {REGIONS_GENERATE_SHAPES} from '../events/events';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions drawing mode section in the regions settings/tab
 */
@customElement('regions-drawing-mode')
@inject(Context)
export default class RegionsDrawingMode {
    /**
     * a reference to the image config
     * @memberof RegionsDrawingMode
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Hide/Shows regions drawing mode section
     *
     * @memberof RegionsDrawingMode
     */
    toggleRegionsDrawingMode() {
        if ($('.regions-drawing-mode').is(':visible')) {
            $('.regions-drawing-mode').hide();
            $('.regions-drawing-mode-toggler').removeClass('collapse-up');
            $('.regions-drawing-mode-toggler').addClass('expand-down');
        } else {
            $('.regions-drawing-mode').show();
            $('.regions-drawing-mode-toggler').removeClass('expand-down');
            $('.regions-drawing-mode-toggler').addClass('collapse-up');
        }
    }

    /**
     * Clears information
     * @memberof RegionsDrawingMode
     * @param {Element} target the target element (input)
     */
    onDimensionInputFocus(target) {
        if (target.value.indexOf("Enter as") !== -1) {
            target.value = '';
            target.style = '';
        }
    }

    /**
     * Handles z/t propagation changes, typed in by the user
     * @memberof RegionsDrawingMode
     * @param {string} dim the dimension: 't' or 'z'
     * @param {string} value the input value
     */
    onDimensionInputChange(dim, value) {
        if (dim !== 't' && dim !== 'z') return;

        this.regions_info.drawing_dims[dim] =
            Utils.parseDimensionInput(
                value, this.regions_info.image_info.dimensions['max_' + dim]);
    }

    /**
     * Handler for dimension attachment changes
     * @memberof RegionsDrawingMode
     * @param {number} option the chosen attachment option
     */
    onAttachmentOptionChange(option) {
        this.regions_info.drawing_mode = option;
        $('.regions-attachment-choice').html(
            $(".regions-attachment-option-" + option).text());
        if (option !== REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T) {
            let inputs = $('.regions-attachment-options [type="input"]');
            inputs.val('Enter as 4-9 or 3,9,11...');
            inputs.css({
                "filter": "alpha(opacity=65)",
                "opacity": ".65",
                "-webkit-box-shadow": "none",
                "box-shadow": "none"});
        }
        return true;
    }

    /**
     * Propagate selected shapes using chosen drawing modes
     *
     * @memberof RegionsDrawingMode
     */
    propagateSelectedShapes() {
        let hist_id = this.regions_info.history.getHistoryId();
         this.regions_info.selected_shapes.map(
             (id) => {
                 let shape =
                     Object.assign({}, this.regions_info.getShape(id));
                 // collect dimensions for propagation
                 let theDims =
                     Utils.getDimensionsForPropagation(
                         this.regions_info, shape.TheZ, shape.TheT);
                 if (theDims.length > 0)
                     this.context.publish(
                         REGIONS_GENERATE_SHAPES,
                         {
                             config_id: this.regions_info.image_info.config_id,
                             shapes: [shape],
                             number : theDims.length,
                             roi_id: Converters.extractRoiAndShapeId(id).roi_id,
                             hist_id: hist_id,
                             theDims : theDims
                         });
             });
    }
}
