// js
import {inject} from 'aurelia-framework';
import Context from '../app/context';
import {customElement, bindable} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE, IMAGE_DIMENSION_CHANGE, IMAGE_CHANNEL_RANGE_CHANGE,
    EventSubscriber
} from '../events/events';

/**
 * Represents the settings section in the right hand panel
 * @extends {EventSubscriber}
 */

@customElement('channel-settings')
@inject(Context)
export default class ChannelSettings extends EventSubscriber {
    /**
     * which image config do we belong to (bound in template)
     * @memberof ChannelSettings
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image info
     * @memberof ChannelSettings
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * events we subscribe to
     * @memberof ChannelSettings
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
     * @memberof ChannelSettings
     */
    bind() {
        this.subscribe();
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof ChannelSettings
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
     * channel change handler
     *
     * @param {Event} event the event object
     * @param {boolean=} start true if we are the start value, otherwise end
     * @memberof ChannelSettings
     */
     onChannelRangeChange(event, start=false) {
         let newVal = event.target.value;
         if (newVal.length === 0) return;

         newVal = parseInt(newVal);
         if (isNaN(newVal)) return;

         // get appropriate min/max for start/end
         let index = parseInt(event.target.index);
         let w = this.image_info.channels[index].window;
         let min = start ? w.min : w.start+1;
         let max = start ? w.end-1 : w.max;

         // clamp
         let exceededBounds = false;
         if (newVal < min) {
             newVal = min;
             exceededBounds = true;
         }
         if (newVal > max) {
             newVal = max;
             exceededBounds = true;
         }
         // set new start/end
         if (!exceededBounds) {
             if (start) w.start = newVal; else w.end = newVal;
             this.propagateChannelChanges(index);
             return;
        }
        event.target.value = newVal;
     }

    /**
    * Publish channel active, range & color changes
    *
    * @param {number} index the channel array index
    * @memberof ChannelSettings
    */
   propagateChannelChanges(index) {
       let c = this.image_info.channels[index];

        this.context.publish(
            IMAGE_CHANNEL_RANGE_CHANGE,
            { config_id: this.config_id, ranges:
                [{index: index, start: c.window.start, end: c.window.end,
                     color: c.color, active: c.active}]});
    }

    /**
    * Toggles a channel, i.e. sets it active or inactive
    *
    * @param {number} index the channel array index
    * @memberof ChannelSettings
    */
   toggleChannel(index) {
       if (this.image_info.channels[index].active)
            this.image_info.channels[index].active = false;
        else
            this.image_info.channels[index].active = true;
        this.propagateChannelChanges(index);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelSettings
     */
    unbind() {
        this.unsubscribe()
        this.image_info = null;
    }
}
