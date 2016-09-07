//css
require('../../node_modules/jquery-ui/themes/base/spinner.css');
require('../../node_modules/spectrum-colorpicker/spectrum.css');

// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {CHANNEL_SETTINGS_MODE} from './channel-settings';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spinner} from 'jquery-ui/ui/widgets/spinner';
import {slider} from 'jquery-ui/ui/widgets/slider';
import {spectrum} from 'spectrum-colorpicker';
import {
    IMAGE_CONFIG_UPDATE
} from '../events/events';

/**
 * A channel range widget
 */

@customElement('channel-range')
@inject(Context, Element, BindingEngine)
export default class ChannelRange  {
    /**
     * which image config do we belong to (bound in template)
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable channel = null;

    /**
     * the channel index
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable index = null;

    /**
     * the channel settings mode
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable mode = null;

    /**
     * the absolute channel range limits
     * @memberof ChannelRange
     * @type {Array.<number>}
     */
    @bindable range = null;

    /**
     * a flag to remind us if these are the initial binding values
     * which we need because the existing display rules are different then
     * @type {boolean}
     */
    initial_values = true;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context, element, bindingEngine) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ChannelRange
     */
    bind() {
        this.registerObserver();
        this.updateUI();

    }

    /**
     * Registers property observer for mode changes
     *
     * @memberof ChannelRange
     */
    registerObserver() {
        this.unregisterObserver();
        this.observer =
            this.bindingEngine.propertyObserver(this, 'mode')
                .subscribe((newValue, oldValue) => {
                    let adjustRange = (() => {
                        // set appropriate start and end values
                        let minMaxValues = this.getMinMaxValues(newValue);
                        if (this.channel.window.start !== minMaxValues.start_val)
                             this.channel.window.start = minMaxValues.start_val;
                        if (this.channel.window.end !== minMaxValues.end_val)
                            this.channel.window.end = minMaxValues.end_val;
                        // we have to also reset channel color, dimensions
                        // model and projection
                        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED) {
                            let imgInfo =
                                this.context.getSelectedImageConfig().image_info;
                            let impImgData = imgInfo.imported_settings;
                            // channel color reset
                            this.channel.color =
                                impImgData.c[this.index].color;
                            // z,t dimension reset
                            imgInfo.dimensions.t = impImgData.t;
                            imgInfo.dimensions.z = impImgData.z;
                            // model and projection
                            imgInfo.model = impImgData.m;
                            imgInfo.projection = impImgData.p;
                        }
                        this.updateUI();
                    });
                    // for imported we do this (potentilly) async
                    if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED)
                        this.context.getSelectedImageConfig().image_info.
                            requestImportedData(adjustRange);
                    else adjustRange();
                });
    }

    /**
     * Unregisters the observer for mode changes
     *
     * @memberof ChannelRange
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
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
             $(this.element).find(".channel-start").off("input");
             $(this.element).find(".channel-start").spinner("destroy");
             $(this.element).find(".channel-end").off("input");
             $(this.element).find(".channel-end").spinner("destroy");
             $(this.element).find(".channel-slider").slider("destroy");
             $(this.element).find(".channel-color").spectrum("destroy");
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

    let minMaxValues = this.getMinMaxValues();
     // channel start
     $(this.element).find(".channel-start").spinner(
         {min: minMaxValues.start_min, max: minMaxValues.start_max});
     $(this.element).find(".channel-start").on("input spinstop",
        (event) => this.onRangeChange(event.target.value, true));
    $(this.element).find(".channel-start").spinner(
        "value", minMaxValues.start_val);

    // channel range slider
    $(this.element).find(".channel-slider").slider(
        {min: minMaxValues.start_min, max: minMaxValues.end_max,
            range: true,
            values: [minMaxValues.start_val, minMaxValues.end_val],
            change: (event, ui) =>
                this.onRangeChangeBoth(ui.values,
                    event.originalEvent ? true : false),
            slide: (event,ui) => {
                if (ui.values[0] >= ui.values[1]) return false;}
    });
    $(this.element).find(".channel-slider").css(
        "background", "white");
    $(this.element).find(".channel-slider").find(".ui-slider-range").css(
        "background", "#" + this.channel.color);

    //channel end
    $(this.element).find(".channel-end").spinner(
        {min: minMaxValues.end_min, max: minMaxValues.end_max});
    $(this.element).find(".channel-end").on("input spinstop",
        (event) => this.onRangeChange(event.target.value));
   $(this.element).find(".channel-end").spinner(
       "value",minMaxValues.end_val);

   //channel end
   $(this.element).find(".channel-color input").spectrum({
        color: "#" + this.channel.color,
        showInput: true,
        className: "full-spectrum",
        showInitial: true,
        preferredFormat: "hex",
        appendTo: $(this.element),
        change: (color) => this.onColorChange(color.toHexString())});
    this.initial_values = false; // reset flag
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
         $(this.element).find(".channel-slider").find(".ui-slider-range").css(
             "background", "#" + this.channel.color);
     }

     /**
     * channel range change handler for changing start and end
     *
     * @param {Array.<number>} values the new value
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @memberof ChannelRange
     */
     onRangeChangeBoth(values, ui_triggered=false) {
         if (!ui_triggered || !Misc.isArray(values)) return;

         let startManipulated =
            this.channel.window.start !== values[0];
         if (startManipulated) {
             if (values[0] >= values[1]) {
                 values[0] = values[1]-1;
             }
             this.onRangeChange(values[0], true);
         } else {
             if (values[1] <= values[0]) {
                 values[1] = values[0]+1;
             }
             this.onRangeChange(values[1], false);
         }
     }

     /**
     * Helper to determine min and max values for start and end based on channel
     * settings mode
     *
     * @param {number} mode the channel setting mode
     * @return {Object} returns object with the respective min,max properties
     * @memberof ChannelRange
     */
     getMinMaxValues(mode=null) {
         let start_min,start_max,end_min,end_max,start_val,end_val;
         if (mode === null) mode=this.mode;
         switch(mode) {
             case CHANNEL_SETTINGS_MODE.MIN_MAX:
                 start_min = this.channel.window.min;
                 start_max = this.channel.window.end-1;
                 end_min = this.channel.window.start+1;
                 end_max = this.channel.window.max;
                 start_val = this.initial_values ?
                     this.channel.window.start : this.channel.window.min;
                 end_val = this.initial_values ?
                     this.channel.window.end : this.channel.window.max;
                 break;

             case CHANNEL_SETTINGS_MODE.FULL_RANGE:
                 start_min = this.range[0];
                 start_max = this.channel.window.end-1;
                 end_min = this.channel.window.start+1;
                 end_max = this.range[1];
                 start_val = this.initial_values ?
                      this.channel.window.start : this.range[0];
                 end_val =
                     this.initial_values ?
                          this.channel.window.end : this.range[1];
                 break;

             case CHANNEL_SETTINGS_MODE.IMPORTED:
             default:
                let chan =
                    this.context.getSelectedImageConfig().image_info.imported_settings.c;
                 start_min = chan[this.index].window.min;
                 start_max = chan[this.index].window.end-1;
                 end_min = chan[this.index].window.start+1;
                 end_max = chan[this.index].window.max;
                 start_val = chan[this.index].window.start;
                 end_val = chan[this.index].window.end;
         }

         return {
             start_min: start_min,
             start_max: start_max,
             end_min: end_min,
             end_max: end_max,
             start_val: start_val,
             end_val: end_val
         }
     }


     /**
     * channel range change handler
     *
     * @param {Array.<number>} value the new value
     * @param {boolean} is_start was start of range or not
     * @memberof ChannelRange
     */
     onRangeChange(value, is_start=false) {
         value = parseInt(value);
         if (isNaN(value)) return;

         // get appropriate min/max for start/end
         let minMaxValues = this.getMinMaxValues();
         let min = is_start ? minMaxValues.start_min : minMaxValues.end_min;
         let max = is_start ? minMaxValues.start_max : minMaxValues.end_max;

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
                    $(this.element).find(".channel-slider").slider(
                        "option", "values",
                        [this.channel.window.start, this.channel.window.end]);
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
        this.image_info = null;
    }
}
