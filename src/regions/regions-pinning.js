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
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }
}
