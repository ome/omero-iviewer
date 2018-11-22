//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

import Context from '../context';
import Misc from '../utils/misc';
import {
    CHANNEL_SETTINGS_MODE, FLOATING_POINT_PRECISION, URI_PREFIX
} from '../utils/constants';
import {HISTOGRAM_RANGE_UPDATE} from '../events/events';
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
     * channel informetion (bound in template)
     * @memberof ChannelRange
     * @type {Object}
     */
    @bindable channel = null;

    /**
     * the channel index
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable index = null;

    /**
     * the mode
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable mode = null;

    /**
     * the channel's full range (min,max)
     * @memberof ChannelRange
     * @type {number}
     */
    full_range_min_max = null;

    /**
     * the channel's min-max range
     * @memberof ChannelRange
     * @type {number}
     */
    min_max_range = null;

    /**
     * the revision count (used for history)
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable revision = 0;
    revisionChanged(newVal, oldVal) {
        let imgInf =
            this.context.getSelectedImageConfig().image_info;
        imgInf.initial_values = true;
        this.updateUI();
    }

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
            $(this.element).find(".channel-start").off();
            $(this.element).find(".channel-start").spinner("destroy");
            $(this.element).find(".channel-end").off();
            $(this.element).find(".channel-end").spinner("destroy");
            $(this.element).find(".channel-slider").slider("destroy");
            $(this.element).find(".spectrum-input").spectrum("destroy");
        } catch (ignored) {}
    }

    /**
     * Updates the range values
     *
     * @param {ImageInfo} imgInf the image info
     * @memberof ChannelRange
     */
    updateRanges(imgInf) {
        this.full_range_min_max =
            imgInf.getChannelMinMaxValues(
                CHANNEL_SETTINGS_MODE.FULL_RANGE, this.index,
                    FLOATING_POINT_PRECISION);
        this.min_max_range =
            imgInf.getChannelMinMaxValues(this.mode, this.index,
                FLOATING_POINT_PRECISION);
        // round if we are floating point
        if (this.min_max_range.step_size !== 1) {
            this.channel.window.start =
                Misc.roundAtDecimal(
                    this.channel.window.start, FLOATING_POINT_PRECISION);
            this.channel.window.end =
                Misc.roundAtDecimal(
                    this.channel.window.end, FLOATING_POINT_PRECISION);
        }
    }

    /**
     * Updates the UI elements (jquery)
     *
     * @memberof ChannelRange
     */
    updateUI() {
        // just in case
        this.detached();

        let imgConf = this.context.getSelectedImageConfig();
        let imgInf = imgConf.image_info;
        this.updateRanges(imgInf);

        // channel start
        let channelStart = $(this.element).find(".channel-start");
        channelStart.spinner({
            min: this.full_range_min_max.start_min, max: this.full_range_min_max.start_max,
            step: this.min_max_range.step_size
        });
        let channelStartArrows =
            $(channelStart).parent().find('a.ui-spinner-button');
        channelStartArrows.css('display','none');
        channelStart.on("focus",
            (event) => channelStartArrows.css('display','block'));
        channelStart.on("blur",
            (event) => {
                channelStartArrows.css('display','none');
                this.onRangeChange(event.target.value, true, true);
            });
        channelStart.on("spinstop",
            (event) => {
                if (typeof event.keyCode !== 'number' ||
                    event.keyCode === 13)
                        this.onRangeChange(event.target.value, true);
            });
        channelStart.spinner("value", this.min_max_range.start_val);

        // channel range slider
        let channelRange = $(this.element).find(".channel-slider");
        let channelRangeMin =
            this.mode === CHANNEL_SETTINGS_MODE.FULL_RANGE ?
                this.full_range_min_max.start_min :
                this.min_max_range.start_val > this.min_max_range.start_min ?
                    this.min_max_range.start_min : this.min_max_range.start_val;
        let channelRangeMax =
            this.mode === CHANNEL_SETTINGS_MODE.FULL_RANGE ?
                this.full_range_min_max.end_max :
                this.min_max_range.end_val < this.min_max_range.end_max ?
                    this.min_max_range.end_max : this.min_max_range.end_val;
        if (this.min_max_range.step_size !== 1)
            channelRangeMax =
                this.adjustCalculatedMax(channelRangeMin, channelRangeMax);
        channelRange.slider({
            min: channelRangeMin,
            max: channelRangeMax,
            step: this.min_max_range.step_size,
            range: true,
            values: [this.min_max_range.start_val, this.min_max_range.end_val],
            change: (event, ui) => {
                // if slide update is pending => clear it
                if (this.lastUpdate) {
                    clearTimeout(this.lastUpdate);
                    this.lastUpdate = null;
                }
                this.onRangeChangeBoth(ui,
                    event.originalEvent ? true : false);
            }, slide: (event,ui) => {
                if (ui.values[0] >= ui.values[1]) return false;

                // adjust value in respective input field
                if (ui.value === ui.values[0])
                    $(this.element).find(".channel-start").spinner(
                        "value", ui.values[0]);
                if (ui.value === ui.values[1])
                    $(this.element).find(".channel-end").spinner(
                        "value", ui.values[1]);

                let imgConf = this.context.getSelectedImageConfig();
                if (imgConf.image_info.tiled) return true;

                // we want to update the histogram on slide so we
                // need a separate event. we throttle so that
                // we send only the last slider value within a 100ms window.
                this.lastDelayedTimeout = new Date().getTime();
                let delayedUpdate = (() => {
                    if (new Date().getTime() < this.lastDelayedTimeout) return;
                    this.context.publish(
                        HISTOGRAM_RANGE_UPDATE,{
                            config_id : imgConf.id,
                            prop: 'start',
                            channel: this.index,
                            start: ui.values[0],
                            end: ui.values[1]
                        });
                }).bind(this);
                this.lastUpdate = setTimeout(delayedUpdate, 100);
        }});
        channelRange.css("background", "white");
        let isLut = this.context.hasLookupTableEntry(this.channel.color);
        // change slider background
        this.setBackgroundAfterColorChange(isLut);

        //channel end
        let channelEnd = $(this.element).find(".channel-end");
        channelEnd.spinner({
            min: this.full_range_min_max.end_min, max: this.full_range_min_max.end_max,
            step: this.min_max_range.step_size
        });
        let channelEndArrows =
            $(channelEnd).parent().find('a.ui-spinner-button');
        channelEndArrows.css('display','none');
        channelEnd.on("focus",
            (event) => channelEndArrows.css('display','block'));
        channelEnd.on("blur",
            (event) => {
                channelEndArrows.css('display','none');
                this.onRangeChange(event.target.value, false, true);
            });
        channelEnd.on("spinstop",
            (event) => {
                if (typeof event.keyCode !== 'number' ||
                    event.keyCode === 13)
                        this.onRangeChange(event.target.value)
            });
        channelEnd.spinner("value", this.min_max_range.end_val);

        //channel color
        $(this.element).find(".spectrum-input").spectrum({
            color: isLut ? '#fff' : "#" + this.channel.color,
            showInput: true,
            containerClassName: 'color-range-spectrum-container',
            replacerClassName: 'color-range-replacer',
            showInitial: true,
            preferredFormat: "hex",
            appendTo: $(this.element).find('.channel-color'),
            change: (color) => this.onColorChange(color.toHexString())
        });
    }

    /**
     * Adjusts max for floating point cases such that it does not end up being
     * 1 step size under (after jquery corrects it internally for the slider)
     *
     * @private
     * @param {number} range_min the minimum for the slider range
     * @param {number} range_max the maximum for the slider range
     * @return {number} the adjusted max range
     * @memberof ChannelRange
    */
    adjustCalculatedMax(range_min, range_max) {
        // counteract jquery logic for max setting in some float cases
        let jqueryCalculatedMax =
            range_min +
            Math.round((range_max - range_min) /
                        this.min_max_range.step_size) *
            this.min_max_range.step_size;

        return (jqueryCalculatedMax > range_max) ?
                    range_max + this.min_max_range.step_size : range_max;
    }

    /**
     * channel color change handler
     *
     * @param {number} value the new value
     * @memberof ChannelRange
    */
    onColorChange(value) {
        let imgConf = this.context.getSelectedImageConfig();
        let isLut = this.context.hasLookupTableEntry(value);
        let oldValue = this.channel.color;
        this.channel.color = isLut ? value : value.substring(1);
        // change slider background
        this.setBackgroundAfterColorChange(isLut);
        $(this.element).find(".spectrum-input").spectrum(
            "set", isLut ? '#fff' : value);
        // add history record
        imgConf.addHistory({
            prop: ['image_info', 'channels', '' + this.index,'color'],
            old_val : oldValue, new_val: this.channel.color, type: 'string'
        });
    }

    /**
     * Adds history entry when inverted flag is toggled
     *
     * @memberof ChannelRange
    */
    onInvertedToggle() {
        let value = this.channel.inverted;
        this.context.getSelectedImageConfig().addHistory({
            prop: ['image_info', 'channels', '' + this.index,'inverted'],
            old_val : !value, new_val: value, type: 'boolean'
        });
        this.updateUI();
    }

    /**
     * Chnages slider and button background after color/lut selection
     *
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @private
     * @memberof ChannelRange
     */
    setBackgroundAfterColorChange(isLut) {
        // style removal helper
        let removeStyles = (el) => {
            let styles = el.prop('style');
            if (styles) {
                styles.removeProperty('background-color');
                styles.removeProperty('background-image');
                styles.removeProperty('background-size');
                styles.removeProperty('background-position');
                styles.removeProperty('background-repeat');
                styles.removeProperty('transform');
            }
        }
        let css = {};
        if (this.channel.inverted) css["transform"] = "scaleX(-1)";
        let channelSlider =
            $(this.element).find(".channel-slider").find(".ui-slider-range");
        if (isLut) {
            let idx = this.context.luts.get(this.channel.color).index;
            if (idx === -1) {
                removeStyles(channelSlider);
                channelSlider.addClass('gradient-png');
            } else {
                channelSlider.removeClass('gradient-png');
                css["background-image"] =
                    "url('" + this.context.luts_png.url + "')";
                css["background-size"] =
                    "100% " + (this.context.luts_png.height * 3) + "px";
                css["background-position"] = "0px -" + (idx * 30 + 1) + "px";
                css["background-repeat"] = "no-repeat";
            }
        } else {
            removeStyles(channelSlider);
            channelSlider.addClass('gradient-png');
            css['background-color'] = "#" + this.channel.color;
        }
        channelSlider.css(css);
        let channelButton = $(this.element).find(".channel");
        removeStyles(channelButton);
        delete css['transform'];
        channelButton.css(css);
    }

    /**
     * channel range change handler for changing start and end
     *
     * @param {Object} ui the jquery ui object (with values)
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @memberof ChannelRange
    */
    onRangeChangeBoth(ui, ui_triggered=false) {
        let values = ui.values;
        if (!ui_triggered || !Misc.isArray(values)) return;

        if (this.min_max_range.step_size !== 1) {
            values[0] = Misc.roundAtDecimal(values[0],FLOATING_POINT_PRECISION);
            values[1] = Misc.roundAtDecimal(values[1],FLOATING_POINT_PRECISION);
        }

        let startManipulated = ui.value === ui.values[0];
        if (startManipulated) {
            if (values[0] >= values[1]) {
                values[0] = values[1] - this.min_max_range.step_size;
            }
            this.onRangeChange(values[0], true);
        } else {
            if (values[1] <= values[0]) {
                values[1] = values[0] + this.min_max_range.step_size;
            }
            this.onRangeChange(values[1], false);
        }
    }

    /**
     * channel range change handler
     *
     * @param {Array.<number>} value the new value
     * @param {boolean} is_start was start of range or not
     * @param {boolean} replace_empty_value if true we replace an empty string
     *                                      with the old value
     * @memberof ChannelRange
     */
    onRangeChange(value, is_start=false, replace_empty_value=false) {
        let clazz = is_start ? '.channel-start' : '.channel-end';
        let oldValue =
            is_start ? this.channel.window.start : this.channel.window.end;

        // some sanity checks
        if (typeof value !== 'number' && typeof value !== 'string') return;
        if (typeof value === 'string') {
            $(this.element).children("span").css(
                "border-color", "rgb(170,170,170)");
            // strip whitespace
            value = value.replace(/\s/g, "");
            if (value.length === 0 && replace_empty_value) {
                // we replace with the old value
                $(this.element).find(clazz).spinner("value", oldValue);
                return;
            }
            value = parseFloat(value);
            if (isNaN(value)) {
                $(this.element).find(clazz).parent().css(
                    "border-color", "rgb(255,0,0)");
                return;
            }
            if (this.min_max_range.step_size !== 1)
                value = Misc.roundAtDecimal(value,FLOATING_POINT_PRECISION);
        }

        // set appropriate min/max for start/end
        let min = is_start ?
            this.full_range_min_max.start_min : this.full_range_min_max.end_min;
        let max = is_start ?
            this.full_range_min_max.start_max : this.full_range_min_max.end_max;
        let sliderMin = is_start ?
            this.min_max_range.start_min : this.min_max_range.end_min;
        let sliderMax = is_start ?
            this.min_max_range.start_max : this.min_max_range.end_max;
        if (!is_start && this.min_max_range.step_size !== 1)
            sliderMax = this.adjustCalculatedMax(sliderMin, sliderMax);

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
        if (!exceededBounds) {
            let otherClazz = is_start ? '.channel-end' : '.channel-start';
            $(this.element).children("span").css(
                "border-color", "rgb(170,170,170)");
            if (oldValue === value) return;

            if (is_start) this.channel.window.start = value;
            else this.channel.window.end = value;

            try {
                $(this.element).find(clazz).spinner("value", value);
                $(this.element).find(".channel-slider").slider(
                    "option", "values",
                    [this.channel.window.start, this.channel.window.end]);

                if (is_start) {
                    $(this.element).find(otherClazz).spinner(
                        "option", "min", value + this.min_max_range.step_size);
                    $(this.element).find(".channel-slider").slider(
                        "option", "min", value < sliderMin ? value : sliderMin);
                } else {
                    $(this.element).find(otherClazz).spinner(
                        "option", "max", value - this.min_max_range.step_size);
                    $(this.element).find(".channel-slider").slider(
                        "option", "max",value > sliderMax ? value : sliderMax);
                }
                let conf = this.context.getSelectedImageConfig();
                // add history record
                conf.addHistory({
                    prop:
                    ['image_info', 'channels', '' + this.index,
                    'window', is_start ? 'start' : 'end'],
                    old_val : oldValue, new_val: value, type : "number"
                });
                this.updateRanges(conf.image_info);
            } catch (ignored) {}
        } else $(this.element).find(clazz).parent().css(
            "border-color", "rgb(255,0,0)");
    }

    /**
     * Hides color picker
     *
     * @memberof ChannelRange
     */
    hideColorPicker() {
        $(this.element).find(".spectrum-input").spectrum("hide");
    }

    /**
     * Toggles a channel, i.e. sets it active or inactive
     *
     * @memberof ChannelRange
     */
    toggleChannel() {
        let imgConf = this.context.getSelectedImageConfig();

        // we don't allow to deactivate the only active channel for grayscale
        if (imgConf.image_info.model === 'greyscale' &&
            this.channel.active) return;

        let history = [];

        // toggle channel active state
        this.channel.active = !this.channel.active;
        // remember change
        history.push({
            prop: ['image_info', 'channels', '' + this.index, 'active'],
            old_val :   !this.channel.active,
            new_val: this.channel.active, type: 'boolean'
        });

        if (imgConf.image_info.model === 'greyscale') {
            // for grayscale: we allow only one active channel
            let channels = imgConf.image_info.channels;
            for (let i=0;i<channels.length;i++) {
                let c = channels[i];
                if (i === this.index || !c.active) continue;
                // deactivate other channels
                c.active = false;
                history.push({
                    prop: ['image_info', 'channels', '' + i, 'active'],
                    old_val : true, new_val: false, type: 'boolean'
                });
            };
        };
        imgConf.addHistory(history);
    }

    /**
     * Makes advanced settings visible
     *
     * @memberof ChannelRange
     */
    showAdvancedSettings() {
        this.channel.show_advanced_settings = true
    }
}
