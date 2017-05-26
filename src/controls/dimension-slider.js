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
//css and images
require('../../node_modules/jquery-ui/themes/base/slider.css');

import Context from '../app/context';
import {inject,customElement, bindable, BindingEngine} from 'aurelia-framework';
import {slider} from 'jquery-ui/ui/widgets/slider';

import {
    IMAGE_DIMENSION_CHANGE, IMAGE_DIMENSION_PLAY, EventSubscriber
} from '../events/events';

/**
 * Represents a dimension slider using jquery slider
 */

@customElement('dimension-slider')
@inject(Context, Element, BindingEngine)
export default class DimensionSlider {
    /**
     * the image config we belong to (bound in template)
     * @memberof DimensionSlider
     * @type {ImageConfig}
     */
    @bindable image_config = null;

    /**
     * a selector to conveniently access the dimension element slider
     * @memberof DimensionSlider
     * @type {ImageInfo}
     */
    elSelector = null;

    /**
     * which dimension do we represent (bound via template)
     * @memberof DimensionSlider
     * @type {string}
     */
    @bindable dim = 't';

    /**
     * the info needed for the play loop (bound via template)
     * @memberof DimensionSlider
     * @type {number}
     */
    @bindable player_info = {dim: null, forwards: null, handle: null};

    /**
     * Watches for dimension changes
     * @memberof DimensionSlider
     * @type {Object}
     */
    observer = null;

    /**
     * the image info  observers
     * @memberof DimensionSlider
     * @type {Object}
     */
    image_info__observer = null;

    /**
     * the starting point of play
     * @memberof DimensionSlider
     * @type {Object}
     */
    last_player_start = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine injected instance of BindingEngine
     */
    constructor(context, element, bindingEngine) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    playDimension(forwards) {
        let stop =
            this.player_info.dim !== null &&
            this.player_info.dim === this.dim &&
            this.player_info.forwards === forwards;

        // make history entry for stop
        if (stop)
            this.image_config.addHistory({
                prop: ['image_info', 'dimensions', this.dim],
                old_val : this.last_player_start,
                new_val:  this.image_config.image_info.dimensions[this.dim],
                type : "number"
            });
        else this.last_player_start =
                this.image_config.image_info.dimensions[this.dim];

        // send out a dimension change notification
        this.context.publish(
            IMAGE_DIMENSION_PLAY, {
                config_id: this.image_config.id,
                dim: this.dim,
                forwards: forwards,
                stop: stop
            });
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof DimensionSlider
     */
    bind() {
        // define the element selector
        this.elSelector = "#" + this.image_config.id +
            " [dim='" + this.dim + "']" + " [name='dim']";
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof DimensionSlider
     */
    attached() {
        let imageDataReady = () => {
            this.registerObserver();
            this.initSlider();
        };
        // if the data is ready we initalize the viewer now,
        // otherwise we listen via the observer
        if (this.image_config.image_info.ready) imageDataReady();
        else this.image_info_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'ready').subscribe(
                        (newValue, oldValue) => imageDataReady());
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof DimensionSlider
     */
    detached() {
        try {
            // get rid of slider
            $(this.elSelector).slider( "destroy" );
        } catch (ignored) {}
        $(this.element).hide()
    }

    /**
     * Unregisters the dimension property listener for model change
     *
     * @memberof DimensionSlider
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
    }

    /**
     * Registers the dimension property listener for dimension changes
     *
     * @memberof DimensionSlider
     */
    registerObserver() {
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) => {
                            $(this.elSelector).slider({value: newValue});
                            // send out a dimension change notification
                            this.context.publish(
                                IMAGE_DIMENSION_CHANGE,
                                    {config_id: this.image_config.id,
                                     dim: this.dim,
                                     value: [newValue]});
                        })
    }

    /**
     * Handles changes in the dimension model both via the UI or
     * driven by the application/programmatically (see second param)
     *
     * @memberof DimensionSlider
     * @param {number|string} value the new dimension value
     * @param {boolean} slider_interaction true if change was affected by UI
     */
    onChange(value, slider_interaction = false) {
        value = Math.round(parseFloat(value));
        let imgInf = this.image_config.image_info;
        let oldValue = imgInf.dimensions[this.dim];

        // no need to change for a the same value
        if (value === oldValue) return;

        // make history entry only for slider interaction
        if (slider_interaction)
            this.image_config.addHistory({
               prop: ['image_info', 'dimensions', this.dim],
               old_val : oldValue, new_val:  value, type : "number"});

        // this will trigger the observer who does the rest
        imgInf.dimensions[this.dim] = value;
    }

    /**
     * Initialize jquery slider
     *
     * @memberof DimensionSlider
     */
    initSlider() {
        let imgInf = this.image_config.image_info;
        // no slider for a 0 length dimension
        if (imgInf.dimensions['max_' + this.dim] <= 1) return;

        // create jquery slider
        $(this.elSelector).slider({
            orientation: this.dim === 'z' ? "vertical" : "horizontal",
            min: 0,
            max: imgInf.dimensions['max_' + this.dim] - 1 ,
            step: 0.01, value: imgInf.dimensions[this.dim],
            slide: (event, ui) => {
                if (this.player_info.handle !== null) return false;
                if (typeof event.keyCode === 'number') {
                    let upKey =
                        (event.keyCode === 38 || event.keyCode === 39);
                    let downKey =
                        (event.keyCode === 37 || event.keyCode === 40);
                    let newVal = ui.value;
                    if (upKey) newVal = Math.ceil(newVal);
                    else if (downKey) newVal = Math.floor(newVal);
                    $(this.elSelector).slider('value',  newVal);
                    return false;
                }
                let sliderValueSpan = $(this.elSelector + ' .slider-value');
                let newDimVal = Math.round(ui.value);
                let sliderTip =
                    this.dim.toUpperCase() + ":" + (newDimVal+1);
                if (this.dim === 't' && imgInf.image_delta_t.length > 0 &&
                    newDimVal < imgInf.image_delta_t.length)
                        sliderTip += " [" + imgInf.image_delta_t[newDimVal] + "]";
                sliderValueSpan.text(sliderTip);
                let percent = (ui.value / (imgInf.dimensions['max_' + this.dim] - 1)) * 100;
                if (this.dim === 'z') {
                    sliderValueSpan.css({bottom: percent + "%"})
                } else {
                    sliderValueSpan.css({left: percent + "%"})
                }
                sliderValueSpan.show();
            },
            stop: (event, ui) => {
                let sliderValueSpan = $(this.elSelector + ' .slider-value');
                sliderValueSpan.text("");
                sliderValueSpan.hide();
                //$(this.elSelector).slider('value',  Math.round(ui.value));
            },
            change: (event, ui) => this.onChange(ui.value,
                event.originalEvent ? true : false)
        });
        $(this.element).show();
    }

    /**
     * Arrow Click Handler
     *
     * @memberof DimensionSlider
     */
    onArrowClick(step) {
        if (this.player_info.handle !== null) return;
        let oldVal = $(this.elSelector).slider('value');
        $(this.elSelector).slider('value',  oldVal + step);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof DimensionSlider
     */
    unbind() {
        this.unregisterObserver();
        this.image_config = null;
    }
}
