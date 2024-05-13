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
import {inject,customElement, bindable, BindingEngine} from 'aurelia-framework';
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {UNTILED_RETRIEVAL_LIMIT} from '../viewers/viewer/globals';
import {slider} from 'jquery-ui/ui/widgets/slider';
import {PROJECTION} from '../utils/constants';
import {
    IMAGE_DIMENSION_CHANGE, IMAGE_DIMENSION_PLAY, IMAGE_SETTINGS_CHANGE
} from '../events/events';

/**
 * Represents a dimension slider using jquery slider
 */

@customElement('dimension-slider')
@inject(Context, Element, BindingEngine)
export default class DimensionSlider {
    /**
     * expose constant to template
     * @memberof DimensionSlider
     * @type {string}
     */
    INTMAX = PROJECTION.INTMAX;

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
     * the property observers
     * @memberof DimensionSlider
     * @type {Object}
     */
    observers = [];

    /**
     * the image info  observers
     * @memberof DimensionSlider
     * @type {Object}
     */
    image_info_ready_observer = null;

    /**
     * the starting point of play
     * @memberof DimensionSlider
     * @type {Object}
     */
    last_player_start = null;

    /**
     * we log selectively for projection
     * @memberof DimensionSlider
     * @type {boolean}
     */
    add_projection_history = false;

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
        let conf = this.image_config;
        if (this.dim === 'z' &&
            conf.image_info.projection === PROJECTION.INTMAX) return;

        let stop =
            this.player_info.dim !== null &&
            this.player_info.dim === this.dim &&
            this.player_info.forwards === forwards;

        // make history entry for stop
        if (stop) {
            conf.addHistory({
                prop: ['image_info', 'dimensions', this.dim],
                old_val : this.last_player_start,
                new_val:  conf.image_info.dimensions[this.dim],
                type : "number"
            });
        } else {
            this.last_player_start = conf.image_info.dimensions[this.dim];
        }

        // send out a dimension change notification
        this.context.publish(
            IMAGE_DIMENSION_PLAY, {
                config_id: conf.id,
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
            if (this.image_config.image_info.refresh) return;
            this.registerObservers();
            this.initSlider();
        };
        // listen via the observer for image ready changes
        this.image_info_ready_observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info, 'ready').subscribe(
                    (newValue, oldValue) => {
                        if (!oldValue && newValue) imageDataReady();
            });
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
    unregisterObservers() {
        this.observers.map((o) => o.dispose());
        this.observers = [];
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
    }

    /**
     * Registers the property observers
     *
     * @memberof DimensionSlider
     */
    registerObservers() {
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.image_config.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) => {
                            $(this.elSelector).slider(
                                'option', 'value', newValue);
                            // send out a dimension change notification
                            this.context.publish(
                                IMAGE_DIMENSION_CHANGE,
                                    {config_id: this.image_config.id,
                                     sync_group: this.image_config.sync_group,
                                     projection: this.image_config.image_info.projection,
                                     dim: this.dim,
                                     value: [newValue]});
                        }));
        // Only need to listen for projection changes if we are Z-slider
        if (this.dim === 'z') {
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'projection')
                        .subscribe(
                            (newValue, oldValue) => this.initSlider(true)));
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info.projection_opts, 'start')
                        .subscribe(
                            (newValue, oldValue) => {
                                this.changeProjection(
                                    [newValue, this.image_config.image_info.projection_opts.end], false)}));
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info.projection_opts, 'end')
                        .subscribe(
                            (newValue, oldValue) => {
                                this.changeProjection(
                                    [this.image_config.image_info.projection_opts.start, newValue], false)}));
        }
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
     * @param {boolean} toggle true if init was called after a projection toggle
     * @memberof DimensionSlider
     */
    initSlider(toggle=false) {
        this.detached();
        let imgInf = this.image_config.image_info;
        // no slider for a 0 length dimension
        if (imgInf.dimensions['max_' + this.dim] <= 1) return;

        // create jquery slider
        let options = {
            orientation: this.dim === 'z' ? "vertical" : "horizontal",
            min: 0,
            max: imgInf.dimensions['max_' + this.dim] - 1 ,
            step: 0.01,
            slide: (event, ui) => {
                if (this.player_info.handle !== null) return false;

                // we don't allow min going past max and vice versa
                // with 2 handles
                if (Misc.isArray(ui.values)) {
                    let idx =
                        ui.values[0] === ui.value ? 0 :
                            ui.values[1] === ui.value ? 1 : -1;
                    if ((idx === 0 && ui.value >= ui.values[1]) ||
                        (idx === 1 && ui.value <= ui.values[0]))
                            return false;
                }

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
                    sliderTip += " [" + imgInf.formatDeltaT(imgInf.image_delta_t[newDimVal]) + "]";
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
            }
        };

        if (this.dim === 'z' && imgInf.projection === PROJECTION.INTMAX) {
            options.range = true;
            options.change =
                (event, ui) => {
                    if (event.originalEvent) {
                        if (!this.checkForUnsavedRoiLoss()) {
                            // reset the slider position
                            $(this.elSelector).slider(
                                {values: [imgInf.projection_opts.start,
                                          imgInf.projection_opts.end]});
                            return;
                        }
                        this.add_projection_history = true;
                        imgInf.projection_opts.synced = false;
                        this.changeProjection(ui.values);
                    }
                };
            options.values = [
                imgInf.projection_opts.start,
                imgInf.projection_opts.end
            ];
        } else {
            options.value = imgInf.dimensions[this.dim];
            options.change =
                (event, ui) => {
                    // If slider event from user, check for unsaved ROIs
                    if (event.originalEvent && !this.checkForUnsavedRoiLoss()) {
                        // reset the slider position
                        $(this.elSelector).slider({value: imgInf.dimensions[this.dim]});
                        return;
                    }
                    this.onChange(ui.value, event.originalEvent ? true : false);
                }
        }

        $(this.elSelector).slider(options);
        $(this.element).show();
        this.changeProjection(options.values, toggle);
    }

    /**
     * Notifies the ol3-viewer of projection changes
     *
     * @param {Array.<number>} values an array of start/end for the projection
     * @param {boolean} toggle true if called after projection toggle
     * @memberof DimensionSlider
     */
    changeProjection(values, toggle=false) {
        let conf = this.image_config;
        let entries = [{
            prop: ['image_info', 'projection_opts', 'synced'],
            old_val : false, new_val: false, type : "boolean"
        }];
        if (Misc.isArray(values)) {
            values[0] = Math.round(parseFloat(values[0]));
            values[1] = Math.round(parseFloat(values[1]));
            let oldOpts = Object.assign({}, conf.image_info.projection_opts);
            conf.image_info.projection_opts.start = values[0];
            conf.image_info.projection_opts.end = values[1];
            let maxZ = conf.image_info.dimensions.max_z-1;
            if (conf.image_info.projection_opts.start > maxZ)
                conf.image_info.projection_opts.start = maxZ;
            if (conf.image_info.projection_opts.end > maxZ)
                conf.image_info.projection_opts.end = maxZ;
            $(this.elSelector).slider(
                "option", "values", [
                    conf.image_info.projection_opts.start,
                    conf.image_info.projection_opts.end
            ]);
            if (this.add_projection_history) {
                if (toggle) {
                    entries.push({
                        prop: ['image_info', 'projection'],
                        old_val : PROJECTION.NORMAL,
                        new_val: PROJECTION.INTMAX,
                        type : "string"
                    });
                } else {
                    entries.push({
                        prop: ['image_info', 'projection_opts'],
                        old_val : oldOpts,
                        new_val: Object.assign({}, conf.image_info.projection_opts),
                        type : "object"
                    });
                }
                conf.addHistory(entries);
                this.add_projection_history = false;
            };
        } else if (toggle && this.add_projection_history) {
            entries.push({
                prop: ['image_info', 'projection'],
                old_val : PROJECTION.INTMAX,
                new_val: PROJECTION.NORMAL,
                type : "string"
            });
            conf.addHistory(entries);
            this.add_projection_history = false;
        };
        if (!conf.image_info.projection_opts.synced) {
            this.context.publish(IMAGE_SETTINGS_CHANGE, {
                config_id: conf.id,
                sync_group: conf.sync_group,
                projection: conf.image_info.projection,
                projection_opts: Object.assign({}, conf.image_info.projection_opts)
            });
        }
    }

    /**
     * Arrow Click Handler
     *
     * @memberof DimensionSlider
     */
    onArrowClick(step) {
        if (this.player_info.handle !== null || !this.checkForUnsavedRoiLoss()) {
            return;
        }
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
        this.unregisterObservers();
        this.image_config = null;
    }

    /**
     * Toggles between normal and intmax view
     *
     * @memberof DimensionSlider
     */
    toggleProjection() {
        if (this.getZProjectionDisabled(this.player_info.handle,
                                        this.player_info.forwards)) {
            return;
        }
        if (!this.checkForUnsavedRoiLoss()) {
            return;
        }

        let imgInf = this.image_config.image_info;
        imgInf.projection_opts.start = 0;
        let diff = 0;
        imgInf.projection_opts.end = imgInf.dimensions['max_' + this.dim] - 1;
        diff = imgInf.dimensions[this.dim]-5;
        if (diff > 0) {
            imgInf.projection_opts.start = diff;
        }
        diff =  imgInf.dimensions[this.dim]+5;
        if (diff < imgInf.dimensions['max_' + this.dim] - 1) {
            imgInf.projection_opts.end = diff;
        }
        this.add_projection_history = true;
        imgInf.projection_opts.synced = false;
        imgInf.projection =
            imgInf.projection === PROJECTION.NORMAL ?
                PROJECTION.INTMAX: PROJECTION.NORMAL;
    }

    /**
     * Calculates whether Z-projection should be disabled.
     *
     * Disabled is true while playing Z-stack movie or if
     * the Viewer will be loading tiles
     * Used by template which passes in arguments that are bound,
     * so we update only when needed
     * See http://davismj.me/blog/aurelia-computed-from-patterns/
     *
     * @memberof DimensionSlider
     */
    getZProjectionDisabled(handle, forwards) {
        let dims = this.image_config.image_info.dimensions;
        let tiled = (dims.max_x * dims.max_y) > UNTILED_RETRIEVAL_LIMIT;
        let bytes_per_pixel = Math.ceil(Math.log2(this.image_config.image_info.range[1]) / 8.0);
        let size_c = this.image_config.image_info.channels.length;
        let stack_size = dims.max_x * dims.max_y * dims.max_z * bytes_per_pixel * size_c;
        let proj_limit = this.context.max_projection_bytes;

        return (handle !== null && forwards || tiled || stack_size > proj_limit);
    }

    /**
     * Any change in Z/T or projection will cause ROIs to reload if we are
     * paginating ROIs by Z/T plane.
     * Returns true if we are paginating ROIs by plane AND we have unsaved
     * changes to ROIs.
     */
    checkForUnsavedRoiLoss() {
        if (this.image_config.regions_info.isRoiLoadingPaginatedByPlane() &&
                this.image_config.regions_info.hasBeenModified()) {
            Ui.showModalMessage(
                "You have unsaved ROI changes. Please Save or Undo " +
                "before moving to a new plane.",
                "OK");
            return false;
        } else {
            return true;
        }
    }
}
