//css & images
require('../../node_modules/jquery-ui/themes/base/spinner.css');
require('../../node_modules/spectrum-colorpicker/spectrum.css');
require('../css/images/close.gif');
require('../css/images/colorpicker.png');

// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {CHANNEL_SETTINGS_MODE} from '../utils/constants';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spinner} from 'jquery-ui/ui/widgets/spinner';
import {slider} from 'jquery-ui/ui/widgets/slider';
import {spectrum} from 'spectrum-colorpicker';

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
    @bindable mode = 0;

    /**
     * the channels settings change mode handler
     * @memberof ChannelRange
     * @type {function}
     */
    @bindable change_mode = null;

    /**
     * the revision count (used for history)
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable revision = 0;

    /**
     * property observers
     * @memberof ChannelRange
     * @type {Array.<object>}
     */
    observers = [];

    /**
     * the absolute channel range limits
     * @memberof ChannelRange
     * @type {Array.<number>}
     */
    @bindable range = null;

    /**
     * the lookup tables (bound via channel-settings
     * @memberof ChannelRange
     * @type {Array.<Object>}
     */
    @bindable luts = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context, element, bindingEngine, bindingContext) {
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
        this.registerObservers();
        this.updateUI();
    }

    /**
     * Registers property observers
     * @memberof ChannelRange
     */
    registerObservers() {
        this.unregisterObservers();
        this.observers.push(
            this.bindingEngine.propertyObserver(this, 'mode')
                .subscribe((newValue, oldValue) =>
                    this.changeMode(newValue, oldValue)));
        this.observers.push(
            this.bindingEngine.propertyObserver(this, 'revision')
                .subscribe((newValue, oldValue) => {
                    let imgInf =
                        this.context.getSelectedImageConfig().image_info;
                    imgInf.initial_values = true;
                    // we need to distinguish for cases that exceed the
                    // min/max view
                    let fRange = imgInf.needsFullRange();
                    if (fRange) {
                        this.mode = CHANNEL_SETTINGS_MODE.FULL_RANGE;
                        this.change_mode({mode: this.mode, fullrange: true});
                    } else if (!fRange &&
                        this.mode !== CHANNEL_SETTINGS_MODE.MIN_MAX) {
                        this.mode = CHANNEL_SETTINGS_MODE.MIN_MAX;
                        this.change_mode({mode: this.mode, fullrange: true});
                    }
                    this.updateUI();}));
    }

    /**
     * Deals with the mode change triggered by the observer
     *
     * @memberof ChannelRange
     */
    showLuts(newValue, oldValue) {
        let luts = $(this.element).find('.luts');
        luts.show();
        $(this.element).find('.luts-close').off("click");
        $(this.element).find('.luts-close').on("click", () => luts.hide());
    }

    /**
     * click handler for lut
     *
     * @param {string} id the lookup name
     * @memberof ChannelRange
     */
    chooseLut(id) {
        $(this.element).find('.luts').hide();
        this.onColorChange(id);
    }

    /**
     * Deals with the mode change triggered by the observer
     *
     * @memberof ChannelRange
     */
    changeMode(newValue, oldValue) {
        if (newValue === null) return;
        if (oldValue === null) oldValue = newValue;

        let adjustRange = (() => {
            // delegate for clarity and to break up code
            this.changeMode0(newValue);
            this.updateUI();
        });
        // for imported we do this (potentilly) async
        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED)
            this.context.getSelectedImageConfig().image_info.
                requestImportedData(adjustRange);
        else adjustRange();
    }

    /**
     * Deals with the mode change triggered by the observer.
     * Should never be called by itself but by changeMode (see above)
     *
     * @private
     * @param {number} newValue the new value for 'mode'
     * @memberof ChannelRange
     */
    changeMode0(newValue) {
        let imgInfo =  this.context.getSelectedImageConfig().image_info;
        // set appropriate start and end values
        let minMaxValues =
            imgInfo.getChannelMinMaxValues(newValue, this.index);
        if (this.channel.window.start !== minMaxValues.start_val)
             this.channel.window.start = minMaxValues.start_val;
        if (this.channel.window.end !== minMaxValues.end_val)
            this.channel.window.end = minMaxValues.end_val;
        // we have to also reset channel color, dimensions
        // model and projection
        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED) {
            let impImgData = imgInfo.imported_settings;
            // channel color reset
            if (this.channel.color !== impImgData.c[this.index].color)
                this.channel.color = impImgData.c[this.index].color;
            // active reset
            if (this.channel.active !== impImgData.c[this.index].active)
                 this.channel.active = impImgData.c[this.index].active;
            // z,t dimension reset
            if (imgInfo.dimensions.t !== impImgData.t)
                imgInfo.dimensions.t = impImgData.t;
            if (imgInfo.dimensions.z !== impImgData.z)
                imgInfo.dimensions.z = impImgData.z;
            // model and projection
            if (imgInfo.model !== impImgData.m)
                imgInfo.model = impImgData.m;
            if (imgInfo.projection !== impImgData.p)
                imgInfo.projection = impImgData.p;
        }
    }

    /**
     * Unregisters the observers
     *
     * @memberof ChannelRange
     */
    unregisterObservers() {
        if (this.observers) {
            this.observers.map((obs) => obs.dispose());
            this.observers = [];
        }
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
             $(this.element).find(".channel-color input").spectrum("destroy");
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

        let imgInf = this.context.getSelectedImageConfig().image_info;
        let minMaxValues =
            imgInf.getChannelMinMaxValues(this.mode,this.index);
         // channel start
         $(this.element).find(".channel-start").spinner(
             {min: minMaxValues.start_min, max: minMaxValues.start_max});
         $(this.element).find(".channel-start").on("input spinstop",
            (event, ui) => this.onRangeChange(event.target.value, true));
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
        // change slider background
        this.setSliderBackgroundAfterColorChange(
            this.luts instanceof Map &&
               typeof this.luts.get(this.channel.color) === 'object');

        //channel end
        $(this.element).find(".channel-end").spinner(
            {min: minMaxValues.end_min, max: minMaxValues.end_max});
        $(this.element).find(".channel-end").on("input spinstop",
            (event) => this.onRangeChange(event.target.value));
       $(this.element).find(".channel-end").spinner(
           "value",minMaxValues.end_val);

       //channel color
       $(this.element).find(".channel-color input").spectrum({
            color: "#" + this.channel.color,
            showInput: true,
            className: "full-spectrum",
            showInitial: true,
            preferredFormat: "hex",
            appendTo: $(this.element).find('.channel-color'),
            beforeShow: () => {
                $(this.element).find('.luts').hide();
            },
            change: (color) => this.onColorChange(color.toHexString())});
}

     /**
     * channel color change handler
     *
     * @param {number} value the new value
     * @param {boolean} is_start was start of range or not
     * @memberof ChannelRange
     */
     onColorChange(value) {
         let isLut = false;
         if (this.luts instanceof Map &&
                typeof this.luts.get(value) === 'object')
            isLut = true;
         let oldValue = this.channel.color;
         this.channel.color = isLut ? value : value.substring(1);
         // change slider background
         this.setSliderBackgroundAfterColorChange(isLut);
         // add history record
         this.context.getSelectedImageConfig().addHistory({
             prop: ['image_info', 'channels', '' + this.index,'color'],
             old_val : oldValue, new_val: this.channel.color, type: 'string'});
     }

     /**
     * Chnages slider looks after color/lut selection
     *
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @private
     * @memberof ChannelRange
     */
     setSliderBackgroundAfterColorChange(isLut) {
         if (isLut) {
             $(this.element).find(".channel-slider").find(".ui-slider-range").css(
             "background", "");
             $(this.element).find(".channel-slider").find(".ui-slider-range").css(
                 {"background-image" :
                    "url('" + this.context.server +
                    "/static/webgateway/img/luts_10.png'",
                  "background-position" : "0 -" +
                    (this.luts.get(this.channel.color).index*20) + "px",
                  "background-size" : "100% 740px",
                  "background-repeat": "no-repeat"});
         } else {
             $(this.element).find(".channel-slider").find(".ui-slider-range").css(
                 {"background-image" :"",
                  "background-position" : "",
                  "background-size" : "",
                  "background-repeat": ""});
             $(this.element).find(".channel-slider").find(".ui-slider-range").css(
             "background", "#" + this.channel.color);
         }
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
         let minMaxValues =
            this.context.getSelectedImageConfig().
                image_info.getChannelMinMaxValues(this.mode, this.index);
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
            let oldValue = null;
             if (is_start) {
                 oldValue = this.channel.window.start;
                 this.channel.window.start = value;
             } else {
                 oldValue = this.channel.window.end;
                 this.channel.window.end = value;
             }
             try {
                 $(this.element).find(clazz).spinner("value", value);
                 if (is_start)
                    $(this.element).find(otherClazz).spinner("option", "min", value+1);
                 else
                    $(this.element).find(otherClazz).spinner("option", "max", value-1);
                    $(this.element).find(".channel-slider").slider(
                        "option", "values",
                        [this.channel.window.start, this.channel.window.end]);
                    // add history record
                    this.context.getSelectedImageConfig().addHistory({
                        prop:
                            ['image_info', 'channels', '' + this.index,
                            'window', is_start ? 'start' : 'end'],
                            old_val : oldValue, new_val: value, type : "number"});
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
