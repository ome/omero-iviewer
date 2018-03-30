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

import Context from '../app/context';
import Misc from '../utils/misc';
import {Converters} from '../utils/converters';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spinner} from 'jquery-ui/ui/widgets/spinner';
import {slider} from 'jquery-ui/ui/widgets/slider';

/**
 * Extends the channel range (showing advanced rendering settings)
 */
@customElement('channel-range-advanced')
@inject(Context, Element, BindingEngine)
export default class ChannelRangeAdvanced  {
    /**
     * channel informetion (bound in template)
     * @memberof ChannelRangeAdvanced
     * @type {Object}
     */
    @bindable channel = null;

    /**
     * the channel index
     * @memberof ChannelRangeAdvanced
     * @type {number}
     */
    @bindable index = null;

    /**
     * the mode
     * @memberof ChannelRangeAdvanced
     * @type {number}
     */
    @bindable mode = null;

    /**
     * the revision count (used for history)
     * @memberof ChannelRangeAdvanced
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
     * property observers
     * @memberof ChannelRangeAdvanced
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the slider min/max for gamma values
     * @memberof ChannelRangeAdvanced
     * @type {Array.<number>}
     */
    GAMMA_MIN_MAX = [0,4];

    /**
     * the families allowed
     * @memberof ChannelRangeAdvanced
     * @type {Array.<string>}
     */
    families = [
        'linear',
        'logarithmic',
        'exponential',
        'polynomial'
    ];

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
     * @memberof ChannelRangeAdvanced
     */
    bind() {
        this.updateUI();
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.channel, 'show_advanced_settings')
                .subscribe((newValue, oldValue) => this.updatePreview()));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.channel, 'color')
                .subscribe((newValue, oldValue) => this.updatePreview()));
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelRangeAdvanced
     */
    unbind() {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof ChannelRangeAdvanced
     */
    detached() {
        // tear down jquery elements
        try {
            $(this.element).find(".gamma-input").off();
            $(this.element).find(".gamma-input").spinner("destroy");
            $(this.element).find(".gamma-slider").slider("destroy");
        } catch (ignored) {}
    }

    /**
     * Updates the UI elements (jquery)
     *
     * @memberof ChannelRangeAdvanced
     */
    updateUI() {
        // just in case
        this.detached();

        let imgConf = this.context.getSelectedImageConfig();
        let imgInf = imgConf.image_info;

        // gamma input
        let channelGammaInput = $(this.element).find(".gamma-input");
        channelGammaInput.spinner({
            min: this.GAMMA_MIN_MAX[0], max: this.GAMMA_MIN_MAX[1],
            step: 0.1
        });
        let channelGammaInputArrows =
            $(channelGammaInput).parent().find('a.ui-spinner-button');
        channelGammaInputArrows.css('display','none');
        channelGammaInput.on("focus",
            (event) => channelGammaInputArrows.css('display','block'));
        channelGammaInput.on("blur",
            (event) => {
                channelGammaInputArrows.css('display','none');
                this.onGammaChange(event.target.value);
            });
        channelGammaInput.on("spinstop",
            (event) => {
                if (typeof event.keyCode !== 'number' ||
                    event.keyCode === 13)
                        this.onGammaChange(event.target.value);
            });
        channelGammaInput.spinner("value", this.channel.coefficient);

        let channelGammaSlider = $(this.element).find(".gamma-slider");
        channelGammaSlider.slider({
            min: this.GAMMA_MIN_MAX[0], max: this.GAMMA_MIN_MAX[1], step: 0.1,
            value: this.channel.coefficient,
            change: (event, ui) => {
                if (event.originalEvent) this.onGammaChange(ui.value);
            }, slide: (event,ui) => {
                channelGammaInput.spinner("value", ui.value);
            }
        });

        this.updatePreview();
    }

    /**
     * Gamma change handler
     *
     * @param {number} value the new value
     * @memberof ChannelRangeAdvanced
     */
    onGammaChange(value) {
        let gammaInput = $(this.element).find('.gamma-input');
        if (typeof value !== 'number' && typeof value !== 'string') {
            gammaInput.parent().css("border-color", "rgb(255,0,0)");
            return;
        }

        gammaInput.parent().css("border-color", "rgb(170,170,170)");
        let oldValue = this.channel.coefficient;
        if (typeof value === 'string') {
            // strip whitespace
            value = value.replace(/\s/g, "");
            if (value.length === 0 && replace_empty_value) {
                // we replace with the old value
                gammaInput.spinner("value", oldValue);
                return;
            }
            value = parseFloat(value);
            if (isNaN(value)) {
                gammaInput.parent().css("border-color", "rgb(255,0,0)");
                return;
            }
        }

        // clamp
        let min = this.GAMMA_MIN_MAX[0];
        let max = this.GAMMA_MIN_MAX[1];
        let exceededBounds = false;
        if (value < min) {
            value = min;
            exceededBounds = true;
        }
        if (value > max) {
            value = max;
            exceededBounds = true;
        }
        // set new value
        if (!exceededBounds) {
            if (oldValue === value) return;
            this.channel.coefficient = value;
            try {
                gammaInput.spinner("value", value);
                $(this.element).find(".gamma-slider").slider(
                    "option", "value", value);

                let conf = this.context.getSelectedImageConfig();
                // add history record
                conf.addHistory({
                    prop:
                    ['image_info', 'channels', '' + this.index, 'coefficient'],
                    old_val : oldValue, new_val: value, type : "number"
                });
            } catch (ignored) {}
        } else gammaInput.parent().css("border-color", "rgb(255,0,0)");
    }

    /**
     * Quantization Family change handler
     *
     * @param {string} value the new value
     * @memberof ChannelRangeAdvanced
     */
    onFamilyChange(value) {
        let oldValue = this.channel.family;
        if (value !== oldValue) {
            this.channel.family = value;
            let conf = this.context.getSelectedImageConfig();
            // add history record
            conf.addHistory({
                prop:
                ['image_info', 'channels', '' + this.index, 'family'],
                old_val : oldValue, new_val: value, type : "string"
            });

        }
    }

    /**
     * Hides advanced settings
     *
     * @memberof ChannelRangeAdvanced
     */
    hideAdvancedSettings() {
        this.channel.show_advanced_settings = false;
    }

    /**
     * Updates the preview
     *
     * @memberof ChannelRangeAdvanced
     */
     updatePreview() {
         if (!this.channel.show_advanced_settings) return;

         let preview = $(this.element).find(".settings-preview");
         let canvas = null;
         if (preview && typeof preview.length === 'number' &&
            preview.length > 0) canvas = preview.get(0);

         if (canvas instanceof HTMLCanvasElement &&
            this.context.luts_png.image instanceof Image) {
                let ctx = canvas.getContext("2d");
                let isLut =
                    this.context.hasLookupTableEntry(this.channel.color);
                let offset = this.context.luts_png.height - 10;
                if (isLut) {
                    let lut = this.context.luts.get(this.channel.color);
                    if (lut) offset = lut.index * 10;
                } else {
                    let colors =
                        Converters.convertHexColorToRGB(this.channel.color);
                    let imageData =
                            ctx.getImageData(0,0,canvas.width,canvas.height);
                    let i=0;1
                    let grad = 0;
                    while (i<imageData.data.length) {
                        imageData.data[i] = colors[0];
                        imageData.data[i+1] = colors[1];
                        imageData.data[i+2] = colors[2];
                        imageData.data[i+3] = 255;
                        i += 4;
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
                ctx.drawImage(
                    this.context.luts_png.image,
                    0, offset+1, 256, 8,
                    0, 0, canvas.width, canvas.height);
         }
     }
}
