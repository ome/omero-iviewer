// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions section in the right hand panel
 */
@customElement('regions')
@inject(Context)
export default class Regions {
    /**
     * which image config do we belong to (bound in template)
     * @memberof Regions
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image config
     * @memberof Regions
     * @type {RegionsInfo}
     */
    regions_info = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Regions
     */
    bind() {
        let img_conf = this.context.getImageConfig(this.config_id);
        if (img_conf && img_conf.regions_info)
            this.regions_info = img_conf.regions_info;

    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Regions
     */
    unbind() {
        this.regions_info = null;
    }
}
