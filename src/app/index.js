//css
require('../../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../css/app.css');

// js
import {inject} from 'aurelia-framework';
import Context from './context';
import {IMAGE_VIEWER_RESIZE,IMAGE_REGIONS_VISIBILITY} from '../events/events';

/**
 * @classdesc
 *
 * The index view/page so to speak
 */
@inject(Context)
export class Index  {

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Index
     */
    attached() {
        window.onresize =
        () => this.context.publish(IMAGE_VIEWER_RESIZE, {config_id: -1});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        window.onresize = null;
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Index
     */
    toggleRegions() {
        let val = $("#toggle_regions").prop("checked");

        for (let [id,conf] of this.context.image_configs)
            conf.show_regions = val;

        this.context.publish(IMAGE_REGIONS_VISIBILITY, {visible: val});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Index
     */
    unbind() {
        this.context = null;
    }
}
