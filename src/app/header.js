//css and images
require('../css/images/link.png');
// js
import {inject,customElement} from 'aurelia-framework';
import Context from './context';
import {
    IMAGE_CONFIG_UPDATE,
    IMAGE_VIEWER_SCALEBAR,
    IMAGE_REGIONS_VISIBILITY,
    EventSubscriber
} from '../events/events';

/**
 * @classdesc
 *
 * the app header
 * @extends EventSubscriber
 */
@customElement('header')
@inject(Context)
export class Header extends EventSubscriber {
    /**
     * events we subscribe to
     * @memberof Header
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Header
     */
    bind() {
        this.subscribe();
    }

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        super(context.eventbus);
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
     * Handles changes of the associated ImageConfig
     *
     * @memberof Header
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         let image_info =
             this.context.getImageConfig(params.config_id).image_info;

         if (!image_info.has_scalebar) {
             this.context.show_scalebar = false;
             $(".has_scalebar").addClass("disabled-color");
             $(".has_scalebar input").prop('disabled', true);
         } else {
            $(".has_scalebar").removeClass("disabled-color");
            $(".has_scalebar input").prop('disabled', false);
        }
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.unsubscribe();
        this.context = null;
    }
}
