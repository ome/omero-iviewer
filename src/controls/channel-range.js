//css and images
require('../../node_modules/jquery-ui/themes/smoothness/jquery-ui.min.css');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-icons_888888_256x240.png');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-icons_454545_256x240.png');

// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';
import {spinner} from 'jquery-ui';

import {
    IMAGE_CONFIG_UPDATE, EventSubscriber
} from '../events/events';

/**
 * A channel range widget
 * @extends {EventSubscriber}
 */

@customElement('channel-range')
@inject(Context, Element)
export default class ChannelRange extends EventSubscriber {
    /**
     * which image config do we belong to (bound in template)
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable channel = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context, element) {
        super(context.eventbus);
        this.context = context;
        this.element = element;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ChannelRange
     */
    bind() {
        this.subscribe();
        this.updateUI();
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
         this.bind();
         this.updateUI();
     }

     /**
      * Overridden aurelia lifecycle method:
      * fired when PAL (dom abstraction) is unmounted
      *
      * @memberof ChannelSettings
      */
     detached() {
         // tear down jquery elements
         try {
             $(this.element).find("input").off("input spinstop");
             $(this.element).spinner("destroy");
         } catch (ignored) {}
     }

     /**
      * Updates the UI elements (jquery)
      *
      * @memberof ChannelRange
      */
     updateUI() {
         // just in case
         this.detached();

         if (this.channel === null) return;

         // channel start
         $(this.element).find(".channel-start").spinner(
             {min: this.channel.window.min,
                 max: this.channel.window.end-1});
         $(this.element).find(".channel-start").on("input spinstop",
            (event) => this.onRangeChange(event.target.value, true));
        $(this.element).find(".channel-start").spinner(
            "value", this.channel.window.start);

        //channel end
        $(this.element).find(".channel-end").spinner(
            {min: this.channel.window.start+1,
                max: this.channel.window.max});
        $(this.element).find(".channel-end").on("input spinstop",
            (event) => this.onRangeChange(event.target.value));
       $(this.element).find(".channel-end").spinner(
           "value", this.channel.window.end);
     }

     /**
     * channel color change handler
     *
     * @param {number} value the new value
     * @param {boolean} is_start was start of range or not
     * @memberof ChannelRange
     */
     onColorChange(value) {
         this.channel.color = value.substring(1);
     }

     /**
     * channel range change handler
     *
     * @param {number} value the new value
     * @param {boolean} is_start was start of range or not
     * @memberof ChannelRange
     */
     onRangeChange(value, is_start=false) {
         value = parseInt(value);
         if (isNaN(value)) return;

         // get appropriate min/max for start/end
         let min = is_start ?
            this.channel.window.min : this.channel.window.start+1;
         let max = is_start ?
            this.channel.window.end-1 : this.channel.window.max;

         // clamp
         let exceededBounds = false;
         if (value < min) {
             value = min;
             exceededBounds = true;
         }
         if (value > max) {
             value = max;
             exceededBounds = true;
         }
         // set new start/end
         let clazz = is_start ? '.channel-start' : '.channel-end';
         if (!exceededBounds) {
             let otherClazz = is_start ? '.channel-end' : '.channel-start';
              $(this.element).children("span").css(
                  "border-color", "rgb(170,170,170)");
              if ((is_start && value === this.channel.window.start) ||
                (!is_start && value === this.channel.window.end)) return;
             if (is_start) this.channel.window.start = value;
             else this.channel.window.end = value;
             try {
                 $(this.element).find(clazz).spinner("value", value);
                 if (is_start)
                    $(this.element).find(otherClazz).spinner("option", "min", value+1);
                 else
                    $(this.element).find(otherClazz).spinner("option", "max", value-1);
             } catch (ignored) {}
         } else $(this.element).find(clazz).parent().css("border-color", "rgb(255,0,0)");
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelRange
     */
    unbind() {
        this.unsubscribe()
        this.image_info = null;
    }
}
