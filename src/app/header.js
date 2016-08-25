// js
import {inject,customElement} from 'aurelia-framework';
import Context from './context';
import {
    IMAGE_VIEWER_SCALEBAR,
    IMAGE_REGIONS_VISIBILITY
} from '../events/events';

/**
 * @classdesc
 *
 * the app header
 */
@customElement('header')
@inject(Context)
export class Header  {
    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleRegions() {
        this.context.publish(IMAGE_REGIONS_VISIBILITY,
            {visible: this.context.show_regions});
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleScalebar() {
        this.context.publish(IMAGE_VIEWER_SCALEBAR,
            {visible: this.context.show_scalebar});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.context = null;
    }
}
