// js
import {inject} from 'aurelia-framework';
import Context from '../app/context';
import {customElement, bindable} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE, IMAGE_DIMENSION_CHANGE, IMAGE_CHANNEL_RANGE_CHANGE,
    EventSubscriber
} from '../events/events';

/**
 * Represents a channel slider
 * @extends {EventSubscriber}
 */

@customElement('channel-slider')
@inject(Context)
export default class ChannelSlider extends EventSubscriber {
    /**
     * which image config do we belong to (bound in template)
     * @memberof ChannelSlider
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image info
     * @memberof ChannelSlider
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * events we subscribe to
     * @memberof ChannelSlider
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ChannelSlider
     */
    bind() {
        this.subscribe();
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof ChannelSlider
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         // if the event is for another config, forget it...
         if (params.config_id !== this.config_id) return;

         // change image config and update image info
         this.config_id = params.config_id;
         this.image_info =
             this.context.getImageConfig(params.config_id).image_info;
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelSlider
     */
    unbind() {
        this.unsubscribe()
        this.image_info = null;
    }
}
