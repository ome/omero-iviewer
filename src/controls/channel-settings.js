// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE, IMAGE_CHANNEL_RANGE_CHANGE,
    EventSubscriber
} from '../events/events';

/**
 * the possible modes of channel settings
 * @type {Object}
 */
export const CHANNEL_SETTINGS_MODE = {
    MIN_MAX : 0,
    FULL_RANGE : 1,
    ORIGINAL : 2
}

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
     * a reference to the image info
     * @memberof ChannelSettings
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * the present channel settings mode
     * @memberof ChannelSettings
     * @type {number}
     */
    mode = null;

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

        // the mode click handler
        $('.channel-mode').children().off("click");
        $('.channel-mode').children().on("click",
            (event) => this.changeChannelMode(event.target.value));

        if (this.image_info === null) return;
        // we select the mode based on the channel range values
        // if they are outside min/max, we need the full range view
        let needsFullRangeMode = false;
        this.image_info.channels.map((c) => {
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
     * Channel mode setter
     *
     * @param {number} mode the channel setting mode
     * @memberof ChannelSettings
     */
    changeChannelMode(mode = CHANNEL_SETTINGS_MODE.ORIGINAL) {
        $('.channel-mode').children().removeClass("active");
        $('.channel-mode').children('[value=' + mode + ']').addClass('active');
        this.mode = parseInt(mode);
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
        if (this.image_info === null ||
            !Misc.isArray(this.image_info.channels)) return;
        this.unregisterObservers();
        for (let i=0;i<this.image_info.channels.length;i++)
            for (let p=0;p<this.observedProperties.length;p++) {
                let obsProp = this.observedProperties[p];

                ((index, obsObj, prop) =>
                    this.observers.push(
                        this.bindingEngine.propertyObserver(
                            obsObj ? this.image_info.channels[index][obsObj] :
                            this.image_info.channels[index], prop)
                            .subscribe(
                                (newValue, oldValue) => {
                                    this.propagateChannelChanges(index);}))
                )(i, obsProp.obj, obsProp.prop);
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
     }

    /**
    * Publish channel active, range & color changes
    *
    * @param {number} index the channel array index
    * @memberof ChannelSettings
    */
   propagateChannelChanges(index) {
       let c = this.image_info.channels[index];

        this.context.publish(
            IMAGE_CHANNEL_RANGE_CHANGE,
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
       if (this.image_info.channels[index].active)
            this.image_info.channels[index].active = false;
        else
            this.image_info.channels[index].active = true;
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
        this.image_info = null;
    }
}
