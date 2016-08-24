//css and images
require('../../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../css/app.css');
require('../css/images/collapse-left.png');
require('../css/images/collapse-right.png');

// js
import {inject} from 'aurelia-framework';
import Context from './context';
import Ui from '../utils/ui';
import {
    IMAGE_VIEWER_RESIZE,
    IMAGE_VIEWER_SCALEBAR,
    IMAGE_REGIONS_VISIBILITY
} from '../events/events';

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
        this.context.publish(IMAGE_REGIONS_VISIBILITY,
            {visible: $("#toggle_regions").prop("checked")});
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Index
     */
    toggleScalebar() {
        this.context.publish(IMAGE_VIEWER_SCALEBAR,
            {visible: $("#toggle_scalebar").prop("checked")});
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
