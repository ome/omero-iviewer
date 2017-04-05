// js
import Context from '../app/context';
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
     * do we propagate or not
     * @memberof RegionsDrawingMode
     * @type {RegionsInfo}
     */
    propagate = false;

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
     * Handles z/t propagation changes, typed in by the user
     * @memberof RegionsDrawingMode
     * @param {string} dim the dimension: 't' or 'z'
     * @param {Element} target the target element (input)
     */
    onDimensionInputChange(dim, target) {
        if (dim !== 't' && dim !== 'z') return;

        // reset
        this.regions_info.drawing_dims[dim] = [];

        let value = target.value;
        //first eliminate all whitespace
        value = value.replace(/\s/g, '');
        if (value.length === 0) return;

        let tokens = value.split(","); // tokenize by ,
        let max = this.regions_info.image_info.dimensions['max_' + dim];
        let vals = [];
        tokens.map((t) => {
            let potentialDashPos = t.indexOf("-");
            if (potentialDashPos === -1) {// single number assumed
                let temp = parseInt(t);
                if (typeof temp === 'number' && !isNaN(temp) &&
                        temp > 0 && temp <= max) vals.push(temp);
            } else { // we might have a range
                let start = parseInt(t.substring(0, potentialDashPos));
                let end = parseInt(t.substring(potentialDashPos+1));
                if (typeof start === 'number' && typeof end === 'number' &&
                    !isNaN(start) && !isNaN(end) && start <= end) {
                         // equal: we increment end
                        if (start === end) end++;
                        else {
                            // we do have a 'range'
                            for (let i=start;i<end;i++)
                                if (i > 0 && i <= max) vals.push(i);
                        }
                    }
            }
        });
        // now let's add to our actual list that is applied for propagation
        // eliminating duplicates and decrementing by 1 to get true dim indices
        vals.sort();
        let previous = -1;
        for (let x=0;x<vals.length;x++) {
            let present = vals[x];
            if (present === previous) continue;
            previous = present;
            this.regions_info.drawing_dims[dim].push(present-1);
        }
    }

    /**
     * Handler for region drawing mode selection (propagation or present Z/T)
     * @memberof RegionsDrawingMode
     * @param {boolean} propagate true if we use propagation options
     * @param {boolean} flag true or false depending on the checkbox status
     */
    onDrawingModeChange(propagate, flag) {
        this.propagate = (propagate && flag) || (!propagate && !flag);
        this.regions_info.drawing_dims.t = [];
        this.regions_info.drawing_dims.z = [];
        let opt = REGIONS_DRAWING_MODE.Z_AND_T_VIEWED;
        if (this.propagate) // find active option
            $(".regions-propagation-options [type='radio']").each(
                (i, what) => {
                    if (what.checked)
                        opt = parseInt(
                            what.name.substring(
                                "propagation-option-".length));
                });
        this.regions_info.drawing_mode = opt;
        $(".propagate-mode").prop("checked", this.propagate);
        $(".viewed-mode").prop("checked", !this.propagate);
        return true;
    }

    /**
     * Handler for propagation option changes
     * @memberof RegionsDrawingMode
     * @param {number} option the chosen propagation option
     */
    onPropagationOptionChange(option) {
        this.regions_info.drawing_mode = option;
        $(".regions-propagation-options [type='radio']").each(
            (i, what) => {
                if (what.name !== ('propagation-option-' + option))
                    what.checked = false;});

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
                             number : theDims.length, random : false,
                             roi_id: Converters.extractRoiAndShapeId(id).roi_id,
                             hist_id: hist_id,
                             theDims : theDims
                         });
             });
    }
}
