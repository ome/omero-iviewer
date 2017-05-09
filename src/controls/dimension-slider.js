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
    IMAGE_CONFIG_UPDATE, IMAGE_DIMENSION_CHANGE, IMAGE_DIMENSION_PLAY, IMAGE_VIEWER_RESIZE,
    EventSubscriber
} from '../events/events';

/**
 * Represents a dimension slider using jquery slider
 * @extends {EventSubscriber}
 */

@customElement('dimension-slider')
@inject(Context, Element, BindingEngine)
export default class DimensionSlider extends EventSubscriber {
    /**
     * the image config we belong to
     * @memberof DimensionSlider
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * a selector to conveniently access the dimension element slider
     * @memberof DimensionSlider
     * @type {ImageInfo}
     */
    elSelector = null;

    /**
     * which image config do we belong to (bound in template)
     * @memberof DimensionSlider
     * @type {number}
     */
    @bindable config_id = null;

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
     * events we subscribe to
     * @memberof DimensionSlider
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                     (params = {}) => this.onImageConfigChange(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine injected instance of BindingEngine
     */
    constructor(context, element, bindingEngine) {
        super(context.eventbus);
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    playDimension(forwards) {
        // send out a dimension change notification
        this.context.publish(
            IMAGE_DIMENSION_PLAY,
                {config_id: this.config_id,
                 dim: this.dim,
                 forwards: forwards,
                 stop:
                    this.player_info.dim !== null &&
                        this.player_info.dim === this.dim &&
                        this.player_info.forwards === forwards});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof DimensionSlider
     */
    bind() {
        // define the element selector, subscribe to events and register observer
        this.subscribe();
        this.elSelector = "#" + this.config_id +
            " [dim='" + this.dim + "']" + " [name='dim']";
        this.registerObserver();
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
        this.hide();
    }

    /**
     * Shows slider using display or visibility css
     *
     * @memberof DimensionSlider
     * @param {boolean} use_display use css display instead of visibility
     */
    show(use_display=false) {
        if (use_display) $(this.element).show();
        else $(this.element).css('visibility', 'visible');
    }

    /**
     * Hides slider using display or visibility css
     *
     * @memberof DimensionSlider
     * @param {boolean} use_display use css display instead of visibility
     */
    hide(use_display=false) {
        if (use_display) $(this.element).hide();
        else $(this.element).css('visibility', 'hidden');
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
    }

    /**
     * Registers the dimension property listener for model change
     *
     * @memberof DimensionSlider
     */
    registerObserver() {
        if (this.image_config === null ||
                this.image_config.image_info === null) return;
        this.unregisterObserver();
        // we do this in a bit of a roundabout way by setting the slider value
        // which in turn triggers the onchange handler which is where
        // both, programmatic and ui affected change converge
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) => {
                            $(this.elSelector).slider({value: newValue});

                            // send out a dimension change notification
                            this.context.publish(
                                IMAGE_DIMENSION_CHANGE,
                                    {config_id: this.config_id,
                                     dim: this.dim,
                                     value: [newValue]});
                        })
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof DimensionSlider
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         // if the event is for another config, forget it...
         if (params.config_id !== this.config_id) return;

         // change image config and (re)bind
         // as well as update the slider (UI)
         this.config_id = params.config_id;
         if (this.context.getImageConfig(params.config_id) === null) return;
         this.image_config = this.context.getImageConfig(params.config_id);
         this.bind();
         this.updateSlider();
         setTimeout(this.onViewerResize.bind(this), 100);
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
        value = parseInt(value);
        let imgInf = this.image_config.image_info;
        let oldValue = imgInf.dimensions[this.dim];

        // no need to change for a the same value
        if (slider_interaction ||
                (!slider_interaction && value === oldValue)) return;

        // make history entry
        this.image_config.addHistory({
           prop: ['image_info', 'dimensions', this.dim],
           old_val : oldValue, new_val:  value, type : "number"});

        // this will trigger the observer who does the rest
        imgInf.dimensions[this.dim] = value;
    }

    /**
     * Affects updates of the jquery slider
     *
     * @memberof DimensionSlider
     */
    updateSlider() {
        // just in case
        this.detached();

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
                sliderValueSpan.text(
                    this.dim.toUpperCase() + ":" + Math.round(ui.value+1));
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
                $(this.elSelector).slider('value',  Math.round(ui.value));
            },
            change: (event, ui) => this.onChange(ui.value,
                event.originalEvent ? true : false)
        });
        this.show();
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
     * Projects along z or t
     *
     * @memberof DimensionSlider
     */
    projection(value) {
        console.log(value);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof DimensionSlider
     */
    unbind() {
        this.unsubscribe()
        this.unregisterObserver();
        this.image_config = null;
    }
}
