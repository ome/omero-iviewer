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

// js
import Context from '../context';
import Misc from '../utils/misc';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {CHANNEL_SETTINGS_MODE, WEBGATEWAY} from '../utils/constants';
import {
    IMAGE_SETTINGS_CHANGE, IMAGE_SETTINGS_REFRESH, EventSubscriber
} from '../events/events';

/**
 * Represents the settings section in the right hand panel
 */
@customElement('channel-settings')
@inject(Context, BindingEngine)
export default class ChannelSettings extends EventSubscriber {
    /**
     * a reference to the image config (bound in template)
     * @memberof ChannelSettings
     * @type {ImageConfig}
     */
    @bindable image_config = null;
    image_configChanged(newVal, oldVal) {
        this.waitForImageInfoReady();
    }

    /**
     * events we subscribe to
     * @memberof Ol3Viewer
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_SETTINGS_REFRESH,
        (params={}) => {
            if (typeof params.config_id !== 'number' ||
                params.config_id !== this.image_config.id) return;
            this.waitForImageInfoReady();
        }]];

    /**
     * the present channel settings mode
     * @memberof ChannelSettings
     * @type {number}
     */
    mode = CHANNEL_SETTINGS_MODE.MIN_MAX;

    /**
     * unfortunately necessary to detect transition in special circumstances
     * @memberof ChannelSettings
     * @type {number}
     */
    old_mode = null;

    /**
     * flag to suppress history for mode change
     * is only turned off in the special case of programmatic change
     * to avoid another history entry from happening
     * @memberof ChannelSettings
     * @type {number}
     */
    enable_mode_history = true;

    /**
     * property observers
     * @memberof ChannelSettings
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the image info ready observers
     * @memberof ChannelSettings
     * @type {Object}
     */
    image_info_ready_observer = null;

    /**
     * list of properties that ought to be observed
     * @memberof ChannelSettings
     * @type {Array.<string>}
     */
    observedProperties = [
        {obj: null, prop: 'active'},
        {obj: null, prop: 'color'},
        {obj: null, prop: 'inverted'},
        {obj: null, prop: 'family'},
        {obj: null, prop: 'coefficient'},
        {obj: 'window', prop: 'start'},
        {obj: 'window', prop: 'end'}
    ];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine injected instance of BindingEngine
     */
    constructor(context, bindingEngine) {
        super(context.eventbus);
        this.context = context;
        this.bindingEngine = bindingEngine;
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
        this.waitForImageInfoReady();
    }

    /**
     * Makes sure that all image info data is there
     *
     * @memberof Settings
     */
    waitForImageInfoReady() {
        if (this.image_config === null ||
            this.image_config.image_info === null) return;

        let onceReady = () => {
            if (this.mode !== CHANNEL_SETTINGS_MODE.MIN_MAX) {
                this.enable_mode_history = false;
                this.mode = CHANNEL_SETTINGS_MODE.MIN_MAX;
            }
            // register observers
            this.registerObservers();
        };

        // tear down old observers
        this.unregisterObservers();
        if (this.image_config.image_info.ready) {
            onceReady();
            return;
        }

        // we are not yet ready, wait for ready via observer
        if (this.image_info_ready_observer === null)
            this.image_info_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'ready').subscribe(
                        (newValue, oldValue) => onceReady());
    }

    /**
     * Unregisters the the observers (property and image info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof ChannelSettings
     */
    unregisterObservers(property_only = false) {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
        if (property_only) return;
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
    }

    /**
     * Registers property observers
     *
     * @memberof ChannelSettings
     */
    registerObservers() {
        let image_info = this.image_config.image_info;
        for (let i=0;i<image_info.channels.length;i++)
            for (let p=0;p<this.observedProperties.length;p++) {
                let obsProp = this.observedProperties[p];

                ((index, obsObj, prop) =>
                    this.observers.push(
                        this.bindingEngine.propertyObserver(
                            obsObj ? image_info.channels[index][obsObj] :
                            image_info.channels[index], prop)
                            .subscribe(
                                (newValue, oldValue) =>
                                    // propagate channel changes
                                    this.propagateChannelChanges(index, prop)))
                )(i, obsProp.obj, obsProp.prop);
            }
        // this is for the history snapshot if we have a mode change
        this.observers.push(
            this.bindingEngine.propertyObserver(this, 'mode')
                .subscribe(
                    (newValue, oldValue) =>
                        this.takeHistorySnapshot(newValue, oldValue)));
    }

    /**
     * Takes a snapshot of all the channel history
     *
     * @param {number} newValue the new mode
     * @param {number} oldValue the old mode
     * @memberof ChannelSettings
     */
    takeHistorySnapshot(newValue, oldValue) {
        if (newValue === null) return;
        if (oldValue === null) oldValue = newValue;

         // reset flag
         if (!this.enable_mode_history) {
             this.enable_mode_history = true;
             return;
        }

        let conf = this.image_config;
        let imgInfo = conf.image_info;
        let snapshotRange = (() => {
            // collect changes for history
            let history = [];
            // iterate over channels
            for (let i=0;i<imgInfo.channels.length;i++)
                this.takeChannelSnapshot(newValue, i, history);

                if (this.enable_mode_history && newValue !== oldValue) {
                    // the order of these is essential
                    //this is to force the initial values
                    let modeAdditions = [];
                    modeAdditions.push({
                       prop: ['image_info','initial_values'],
                       old_val : true,
                       new_val:  true,
                       type : "boolean"});
                    modeAdditions.push({
                       scope: this, prop: ['enable_mode_history'],
                       old_val : false,
                       new_val:  false,
                       type : "boolean"});
                    modeAdditions.push({
                       scope: this, prop: ['mode'],
                       old_val : oldValue,
                       new_val:  newValue,
                       type : "number"});
                    history = modeAdditions.concat(history);
                 };
            conf.addHistory(history);
            conf.changed();
        });
        // for imported we do this (potentially) async
        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED)
            imgInfo.requestImportedData(snapshotRange);
        else snapshotRange();
    }

    /**
     * Takes a snapshot of all the channel history
     * @param {number} mode the mode
     * @param {number} index the channel index
     * @param {Array.<Object>} history the history log
     * @memberof ChannelSettings
     */
     takeChannelSnapshot(mode, index, history) {
         let imgInf = this.image_config.image_info;
         let minMaxValues =
             imgInf.getChannelMinMaxValues(mode, index);

         let chan = imgInf.channels[index];
         if (chan.window.start !== minMaxValues.start_val) {
             history.push({
                 prop: ['image_info', 'channels', '' + index, 'window', 'start'],
                 old_val : chan.window.start,
                 new_val: minMaxValues.start_val,
                 type: 'number'});
             chan.window.start = minMaxValues.start_val;
         }
         if (chan.window.end !== minMaxValues.end_val) {
             history.push({
                 prop: ['image_info', 'channels', '' + index, 'window', 'end'],
                 old_val : chan.window.end,
                 new_val: minMaxValues.end_val,
                 type: 'number'});
             chan.window.end = minMaxValues.end_val;
         }
         // we have to also reset channel color, dimensions
         // model and projection
         if (mode === CHANNEL_SETTINGS_MODE.IMPORTED) {
             let impImgData = imgInf.imported_settings;
             // log channel color
             if (chan.color !== impImgData.c[index].color) {
                history.push({
                    prop: ['image_info', 'channels', '' + index, 'color'],
                    old_val : chan.color,
                    new_val: impImgData.c[index].color,
                    type: 'string'});
                chan.color = impImgData.c[index].color;
             }
            // log inverted flag
            // (taking into account that it might not be supported)
            if (typeof impImgData.c[index].inverted === 'undefined')
                impImgData.c[index].inverted = null;
            if (chan.inverted !== impImgData.c[index].inverted) {
                history.push({
                   prop: ['image_info', 'channels', '' + index, 'inverted'],
                   old_val : chan.inverted,
                   new_val: impImgData.c[index].inverted,
                   type: 'boolean'});
                chan.inverted = impImgData.c[index].inverted;
             }
             // remember quantization info
             // (taking into account that it might not be supported)
             if (typeof impImgData.c[index].family === 'string' &&
                 impImgData.c[index].family !== "" &&
                 typeof impImgData.c[index].coefficient === 'number' &&
                 !isNaN(impImgData.c[index].coefficient)) {
                     if (chan.family !== impImgData.c[index].family) {
                         history.push({
                            prop: ['image_info', 'channels', '' + index, 'family'],
                            old_val : chan.family,
                            new_val: impImgData.c[index].family,
                            type: 'string'});
                         chan.family = impImgData.c[index].family;
                      }
                      if (chan.coefficient !== impImgData.c[index].coefficient) {
                          history.push({
                             prop: ['image_info', 'channels', '' + index, 'coefficient'],
                             old_val : chan.coefficient,
                             new_val: impImgData.c[index].coefficient,
                             type: 'number'});
                          chan.coefficient = impImgData.c[index].coefficient;
                       }
             }
             // remember active
             if (chan.active !== impImgData.c[index].active) {
                 history.push({
                     prop: ['image_info', 'channels', '' + index, 'active'],
                     old_val : chan.active,
                     new_val: impImgData.c[index].active,
                     type: 'boolean'});
                 chan.active = impImgData.c[index].active;
             }
             // log z and t
             if (imgInf.dimensions.t !== impImgData.t) {
                 history.push({
                     prop: ['image_info', 'dimensions', 't'],
                     old_val : imgInf.dimensions.t,
                     new_val: impImgData.t,
                     type: 'number'});
                 imgInf.dimensions.t = impImgData.t;
             }
             if (imgInf.dimensions.z !== impImgData.z) {
                 history.push({
                     prop: ['image_info', 'dimensions', 'z'],
                     old_val : imgInf.dimensions.z,
                     new_val: impImgData.z,
                     type: 'number'});
                 imgInf.dimensions.z = impImgData.z;
             }
             // remember model and projection
             if (imgInf.model !== impImgData.m) {
                 history.push({
                     prop: ['image_info', 'model'],
                     old_val : imgInf.model,
                     new_val: impImgData.m,
                     type: 'string'});
                 imgInf.model = impImgData.m;
             }
             if (imgInf.projection !== impImgData.p) {
                 history.push({
                     prop: ['image_info', 'projection'],
                     old_val : imgInf.projection,
                     new_val: impImgData.p,
                     type: 'string'});
                 imgInf.projection = impImgData.p;
             }
         }
     }

     /**
     * Deals with click event on mode buttons (min/max, full range, imported)
     * only ever acts in cases where the observer won't act i.e. if mode has
     * not changed but user wants a reset by clicking again.
     *
     * @param {number|Object} mode the chosen mode
     * @memberof ChannelSettings
     */
     onModeChange(mode) {
        let fullrange = false;
        if (typeof mode === 'object' && mode !== null &&
                typeof mode.mode === 'number' && typeof mode.fullrange) {
            mode = parseInt(mode.mode);
            fullrange = true;
        } else mode = parseInt(mode);
        if (typeof mode !== 'number' || mode < 0 || mode > 2) return;
        this.old_mode = this.mode;
        this.mode = mode;
        if (!fullrange) this.image_config.image_info.initial_values = false;
        if (this.old_mode !== this.mode) return;

        // affect change if mode was clicked more than once
        this.mode = null;
        setTimeout(() => this.mode = mode, 0);
     }

    /**
    * Publish channel active, range & color changes
    *
    * @param {number} index the channel array index
    * @param {string} prop the channel property that changed
    * @memberof ChannelSettings
    */
   propagateChannelChanges(index, prop) {
       let c = this.image_config.image_info.channels[index];

       let params = {
           config_id: this.image_config.id,
           sync_group: this.image_config.sync_group,
           prop: prop,
           ranges:[
               {index: index, start: c.window.start, end: c.window.end,
                color: c.color, active: c.active, inverted: c.inverted}
           ]
       };
       if (typeof c.family === 'string' && c.family !== "" &&
           typeof c.coefficient === 'number' && !isNaN(c.coefficient)) {
               params.ranges[0].family = c.family;
               params.ranges[0].coefficient = c.coefficient;
       }

       this.context.publish(IMAGE_SETTINGS_CHANGE, params);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelSettings
     */
    unbind() {
        this.unsubscribe();
        this.unregisterObservers();
    }
}
