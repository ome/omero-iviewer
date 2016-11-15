// js
import Context from '../app/context';
import {REGIONS_DRAWING_MODE} from '../utils/constants';
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
     * Handler for region drawing mode selection (propagation or present Z/T)
     * @memberof RegionsDrawingMode
     * @param {boolean} propagate true if we use propagation options
     * @param {boolean} flag true or false depending on the checkbox status
     */
    onDrawingModeChange(propagate, flag) {
        this.propagate = (propagate && flag) || (!propagate && !flag);
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
}
