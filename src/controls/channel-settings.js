// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {CHANNEL_SETTINGS_MODE} from '../model/image_info';
import {
    IMAGE_CONFIG_UPDATE, IMAGE_SETTINGS_CHANGE, EventSubscriber
} from '../events/events';

/**
 * Represents the settings section in the right hand panel
 * @extends {EventSubscriber}
 */
@customElement('channel-settings')
@inject(Context, BindingEngine)
export default class ChannelSettings extends EventSubscriber {
    /**
     * which image config do we belong to (bound in template)
     * @memberof ChannelSettings
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image config
     * @memberof ChannelSettings
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * the present channel settings mode
     * @memberof ChannelSettings
     * @type {number}
     */
    mode = null;

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
     * @type {Array.<object>}
     */
    observers = [];

    /**
     * list of properties that ought to be observed
     * @memberof ChannelSettings
     * @type {Array.<string>}
     */
    observedProperties = [
        {obj: null, prop: 'active'},
        {obj: null, prop: 'color'},
        {obj: 'window', prop: 'start'},
        {obj: 'window', prop: 'end'}
    ];

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
        this.registerObservers();

        if (this.image_config === null ||
                this.image_config.image_info === null) return;
        // we select the mode based on the channel range values
        // if they are outside min/max, we need the full range view
        let needsFullRangeMode = false;
        this.image_config.image_info.channels.map((c) => {
            if (c.window.start < c.window.min ||
                    c.window.end > c.window.max)
                needsFullRangeMode = true;
        });
        if (needsFullRangeMode)
            this.mode = CHANNEL_SETTINGS_MODE.FULL_RANGE;
        else
            this.mode = CHANNEL_SETTINGS_MODE.MIN_MAX;
    }

    /**
     * Unregisters the property observers for model change
     *
     * @memberof ChannelSettings
     */
    unregisterObservers() {
        this.observers.map((o) => o.dispose());
        this.observers = [];
    }

    /**
     * Registers property observers
     *
     * @memberof ChannelSettings
     */
    registerObservers() {
        if (this.image_config === null ||
            this.image_config.image_info === null ||
            !Misc.isArray(this.image_config.image_info.channels)) return;
        this.unregisterObservers();
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
                                    this.propagateChannelChanges(index)))
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

        // collect changes for history
        let history = [];
        if (this.enable_mode_history && newValue !== oldValue) {
            // the order of these is essential
            //this is to force the initial values
            history.push({
               prop: ['image_info','initial_values'],
               old_val : true,
               new_val:  true,
               type : "boolean"});
            history.push({
               scope: this, prop: ['enable_mode_history'],
               old_val : false,
               new_val:  false,
               type : "boolean"});
            history.push({
               scope: this, prop: ['mode'],
               old_val : oldValue,
               new_val:  newValue,
               type : "number"});
         };
         // reset flag
         if (!this.enable_mode_history) {
             this.enable_mode_history = true;
             return;
        }

        let conf = this.image_config;
        let imgInfo = conf.image_info;
        let snapshotRange = (() => {
            // iterate over channels
            for (let i=0;i<imgInfo.channels.length;i++)
                this.takeChannelSnapshot(newValue, i, history);
            conf.addHistory(history);
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
         if (chan.window.start !== minMaxValues.start_val)
             history.push({
                 prop: ['image_info', 'channels', '' + index, 'window', 'start'],
                 old_val : chan.window.start,
                 new_val: minMaxValues.start_val,
                 type: 'number'});
         if (chan.window.end !== minMaxValues.end_val)
             history.push({
                 prop: ['image_info', 'channels', '' + index, 'window', 'end'],
                 old_val : chan.window.end,
                 new_val: minMaxValues.end_val,
                 type: 'number'});
         // we have to also reset channel color, dimensions
         // model and projection
         if (mode === CHANNEL_SETTINGS_MODE.IMPORTED) {
             let impImgData = imgInf.imported_settings;
             // log channel color
             if (chan.color !== impImgData.c[index].color)
                history.push({
                    prop: ['image_info', 'channels', '' + index, 'color'],
                    old_val : chan.color,
                    new_val: impImgData.c[index].color,
                    type: 'string'});
             // remember active
             if (chan.active !== impImgData.c[index].active)
                 history.push({
                     prop: ['image_info', 'channels', '' + index, 'active'],
                     old_val : chan.active,
                     new_val: impImgData.c[index].active,
                     type: 'boolean'});
             // log z and t
             if (imgInf.dimensions.t !== impImgData.t)
                 history.push({
                     prop: ['image_info', 'dimensions', 't'],
                     old_val : imgInf.dimensions.t,
                     new_val: impImgData.t,
                     type: 'number'});
             if (imgInf.dimensions.z !== impImgData.z)
                 history.push({
                     prop: ['image_info', 'dimensions', 'z'],
                     old_val : imgInf.dimensions.z,
                     new_val: impImgData.z,
                     type: 'number'});
             // remember model and projection
             if (imgInf.model !== impImgData.m)
                 history.push({
                     prop: ['image_info', 'model'],
                     old_val : imgInf.model,
                     new_val: impImgData.m,
                     type: 'string'});
             if (imgInf.projection !== impImgData.p)
                 history.push({
                     prop: ['image_info', 'projection'],
                     old_val : imgInf.projection,
                     new_val: impImgData.p,
                     type: 'string'});
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
         if (this.context.getImageConfig(params.config_id) === null) return;
         this.image_config = this.context.getImageConfig(params.config_id);
         this.bind();
     }

     /**
     * Deals with click event on mode buttons (min/max, full range, imported)
     * only ever acts in cases where the observer won't act i.e. if mode has
     * not changed but user wants a reset by clicking again.
     *
     * @param {number} mode the chosen mode
     * @memberof ChannelSettings
     */
     onModeChange(mode) {
        mode = parseInt(mode);
        if (typeof mode !== 'number' || mode < 0 || mode > 2) return;
        this.old_mode = this.mode;
        this.mode = mode;
        this.image_config.image_info.initial_values = false;
        if (this.old_mode !== this.mode) return;

        // affect change if mode was clicked more than once
        this.mode = null;
        setTimeout(() => this.mode = mode, 0);
     }

    /**
    * Publish channel active, range & color changes
    *
    * @param {number} index the channel array index
    * @memberof ChannelSettings
    */
   propagateChannelChanges(index) {
       let c = this.image_config.image_info.channels[index];

        this.context.publish(
            IMAGE_SETTINGS_CHANGE,
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
       if (this.image_config.image_info.channels[index].active)
            this.image_config.image_info.channels[index].active = false;
        else
            this.image_config.image_info.channels[index].active = true;
        // add history record
        this.image_config.addHistory({
            prop: ['image_info', 'channels', '' + index, 'active'],
            old_val : !this.image_config.image_info.channels[index].active,
            new_val: this.image_config.image_info.channels[index].active,
            type: 'boolean'});
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
        this.unregisterObservers();
        this.image_config = null;
    }
}
