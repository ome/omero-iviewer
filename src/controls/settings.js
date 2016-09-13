// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE, IMAGE_SETTINGS_CHANGE, EventSubscriber
} from '../events/events';

/**
 * Represents the settings section in the right hand panel
 * @extends {EventSubscriber}
 */

@customElement('settings')
@inject(Context, BindingEngine)
export default class Settings extends EventSubscriber {
    /**
     * which image config do we belong to (bound in template)
     * @memberof Settings
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image config
     * @memberof Settings
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * events we subscribe to
     * @memberof Settings
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
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
     * @memberof Settings
     */
    bind() {
        this.subscribe();
        this.registerObserver();
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof Settings
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         // if the event is for another config, forget it...
         if (params.config_id !== this.config_id) return;

         // change image config and update image info
         this.config_id = params.config_id;
         if (this.context.getImageConfig(params.config_id) === null) return;
         this.image_config =
             this.context.getImageConfig(params.config_id);
        this.bind();
     }

    /**
    * Shows and hides the histogram
    *
    * @memberof Settings
    */
    toggleHistogram() {
        alert("Not implemented yet!");
    }

    /**
    * on model change handler
    *
    * @memberof Settings
    */
    onModelChange(flag) {
        // add history record
        this.image_config.addHistory({
            prop: ['image_info', 'model'],
            old_val : !flag ? 'greyscale' : 'color',
            new_val: flag ? 'greyscale' : 'color'});
    }

    /**
    * Persists the rendering settings
    *
    * @memberof Settings
    */
    saveImageSettings() {
        $('.save-settings').children('button').blur();
        if (Misc.useJsonp(this.context.server)) {
            alert("Saving the rendering settings will not work for cross-domain!");
            return;
        }

        let image_info = this.image_config.image_info;
        let url =
            this.context.server + "/webgateway/saveImgRDef/" +
            image_info.image_id + '/?m=' + image_info.model[0] +
            "&p=" + image_info.projection +
            "&t=" + (image_info.dimensions.t+1) +
            "&z=" + (image_info.dimensions.z+1) +
            "&q=0.9&ia=0&c=";
        let i=0;
        image_info.channels.map(
            (c) =>
                url+= (i !== 0 ? ',' : '') + (!c.active ? '-' : '') + (++i) +
                 "|" + c.window.start + ":" + c.window.end + "$" + c.color
        );
        url += "&_token="
        $.ajax(
            {url : url,
             method: 'POST',
            success : (response) => this.image_config.resetHistory(),
            error : (error) => {}
        });
    }

    /**
    * Undoes the last change
    *
    * @memberof Settings
    */
    undo() {
        if (this.image_config) {
            this.image_config.undoHistory();
            this.image_config.changed();
        }
    }

    /**
    * Redoes the last change
    *
    * @memberof Settings
    */
    redo() {
        if (this.image_config) {
            this.image_config.redoHistory();
            this.image_config.changed();
        }
    }

    /**
    * Copies the rendering settings
    *
    * @memberof Settings
    */
    copy() {
        alert("not implemented yet");
    }

    /**
    * Pastes the rendering settings
    *
    * @memberof Settings
    */
    paste() {
        alert("not implemented yet");
    }

    /**
     * Registers the model(color/greyscale) property listener for model change
     *
     * @memberof Settings
     */
    registerObserver() {
        if (this.image_config === null ||
            this.image_config.image_info === null) return;
        this.unregisterObserver();
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info, 'model')
                    .subscribe(
                        (newValue, oldValue) =>
                            this.context.publish(
                                IMAGE_SETTINGS_CHANGE,
                                { config_id: this.config_id, model: newValue}));
    }

    /**
     * Unregisters the model(color/greyscale) property listener for model change
     *
     * @memberof Settings
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Settings
     */
    unbind() {
        this.unregisterObserver();
        this.unsubscribe()
        this.image_config = null;
    }
}
