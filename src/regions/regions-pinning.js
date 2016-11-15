// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions pinning section in the regions settings/tab
 */
@customElement('regions-pinning')
@inject(Context)
export default class RegionsPinning {
    /**
     * a reference to the image config
     * @memberof RegionsPinning
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * the chosen pinning option
     * @memberof RegionsPinning
     * @type {RegionsInfo}
     */
    pinning_option = 0;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Hide/Shows regions pinning options
     *
     * @memberof RegionsPinning
     */
    toggleRegionsPinning() {
        if ($('.regions-pinning').is(':visible')) {
            $('.regions-pinning').hide();
            $('.regions-pinning-toggler').removeClass('collapse-up');
            $('.regions-pinning-toggler').addClass('expand-down');
        } else {
            $('.regions-pinning').show();
            $('.regions-pinning-toggler').removeClass('expand-down');
            $('.regions-pinning-toggler').addClass('collapse-up');
        }
    }

    /**
     * @memberof RegionsPinning
     * @param {number} option the chosen option
     */
    onPinningOptionChange(option) {
        this.pinning_option = option;
        $(".regions-pinning [type='radio']").each(
            (i, what) => {
                if (what.name !== ('pinning-option-' + option))
                    what.checked = false;});

        return true;
    }
}
