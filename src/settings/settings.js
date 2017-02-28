// js
import Context from '../app/context';
import Misc from '../utils/misc';
import Histogram from './histogram';
import {CHANNEL_SETTINGS_MODE, WEBGATEWAY} from '../utils/constants';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

import {
    IMAGE_SETTINGS_CHANGE, THUMBNAILS_UPDATE,
    EventSubscriber
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
     * a revision count that forces updates of user setting thumbs after save
     * @memberof Settings
     * @type {number}
     */
    revision = null;

    /**
     * all rendering definitions for the image
     * @memberof Settings
     * @type {Array.<Object>}
     */
    rdefs = null;

    /**
     * the histogram instance
     * @memberof Settings
     * @type {Histogram}
     */
     histogram = null;

    /**
     * events we subscribe to
     * @memberof Settings
     * @type {Array.<string,function>}
     */
    sub_list = [[THUMBNAILS_UPDATE,
                    (params={}) => this.revision++]];

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
        this.image_config =
            this.context.getImageConfig(this.config_id);

        // event subscriptions and property observation
        this.subscribe();
        this.registerObserver();

        // fire off ajax request for rendering defs
        this.requestAllRenderingDefs();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Settings
     */
    attached() {
        // create histogram instance (if not tiled)
        if (this.image_config && this.image_config.image_info &&
            !this.image_config.image_info.tiled)
            this.histogram = new Histogram(this.image_config.image_info);
    }

    /**
     * Retrieves all rendering settings for the image
     *
     * @param {function} action a handler to be executed in both success/error case
     * @memberof Settings
     */
    requestAllRenderingDefs(action) {
        if (this.image_config === null || this.image_config.image_info === null)
            return;

        let img_id = this.image_config.image_info.image_id;
        $.ajax({
            url : this.context.server +
                    this.context.getPrefixedURI(WEBGATEWAY) +
                        "/get_image_rdefs_json/" + img_id,
            success : (response) => {
                if (!Misc.isArray(response.rdefs)) return;

                // merge in lut info
                response.rdefs.map((rdef) => {
                    rdef.c.map((chan) => {
                        if (typeof chan.lut === 'string' && chan.lut.length > 0)
                                chan.color = chan.lut;
                    });
                });
                this.rdefs = response.rdefs;
                if (typeof action === 'function') action();
            },
            error : () => {
                if (typeof action === 'function') action();
            }});
    }

    /**
     * Convenience method returning the url for the thumbnail
     * (without the size and rdef param)
     *
     * @memberof Settings
     * @return {string} an (incomplete) url
     */
    getRdefThumbUrl() {
        if (this.image_config === null || this.image_config.image_info === null)
            return;

        let img_id = this.image_config.image_info.image_id;

        return this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
                    "/render_thumbnail/" + img_id;
    }

    /**
     * Shows and hides the histogram
     *
     * @memberof Settings
     */
    toggleHistogram(checked) {
        if (this.histogram) {
            this.histogram.toggleHistogramVisibilty(checked);
        }
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
            new_val: flag ? 'greyscale' : 'color',
            type: 'string'});
    }

    /**
     * Persists the rendering settings
     *
     * @memberof Settings
     */
    saveImageSettings() {
        $('.save-settings').children('button').blur();
        if (Misc.useJsonp(this.context.server)) {
            alert("Saving the rendering settings will not work cross-domain!");
            return;
        }

        let image_info = this.image_config.image_info;
        let url =
            this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
            "/saveImgRDef/" +
            image_info.image_id + '/?m=' + image_info.model[0] +
            "&p=" + image_info.projection +
            "&t=" + (image_info.dimensions.t+1) +
            "&z=" + (image_info.dimensions.z+1) +
            "&q=0.9&ia=0";
        url = this.appendChannelsAndMapsToQueryString(url);

        $.ajax(
            {url : url,
             method: 'POST',
            success : (response) => {
                this.image_config.resetHistory();
                // reissue get rendering requests, then
                // force thumbnail update
                let action =
                    (() => this.context.publish(
                            THUMBNAILS_UPDATE,
                            { config_id : this.config_id,
                              ids: [image_info.image_id]}));
                this.requestAllRenderingDefs(action);
            },
            error : (error) => {}
        });
    }

    /**
     * Tries to persists the rendering settings to all images in the dataset
     *
     * @memberof Settings
     */
    saveImageSettingsToAll() {
        // we only delegate
        this.copy(true);
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
     * @param {boolean} toAll if true settings will be applied to all,
     *                        otherwise only the present one
     * @memberof Settings
     */
    copy(toAll=false) {
        if (toAll && Misc.useJsonp(this.context.server)) {
            alert("Saving to All will not work cross-domain!");
            return;
        }

        let imgInf = this.image_config.image_info;
        let url =
            this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
                    "/copyImgRDef/?";
        if (!toAll)
            url += "imageId=" + imgInf.image_id + "&q=0.9&pixel_range=" +
                    imgInf.range[0] + ":" + imgInf.range[1] +"&";
        url +=  'm=' + imgInf.model[0] + "&p=" + imgInf.projection + "&ia=0";
        url = this.appendChannelsAndMapsToQueryString(url);

        // save to all differs from copy in that it is a POST with data
        // instead of a JSON(P) GET, as well as the success handler
        let params = {
            url : url,
            method: toAll ? 'POST' : 'GET',
            error : (error) => {}
        };

        if (toAll) {
            params.data={
                dataType: 'json',
                toids: imgInf.dataset_id,
                to_type: 'dataset',
                imageId: imgInf.image_id
            };
            params.success =
                (response) => {
                    let thumbIds = [imgInf.image_id];
                    if (typeof response === 'object' && response !== null &&
                        Misc.isArray(response.True))
                        thumbIds = thumbIds.concat(response.True);
                    // reissue get rendering requests, then
                    // force thumbnail update
                    let action =
                        (() => this.context.publish(
                                THUMBNAILS_UPDATE,
                                { config_id : this.config_id, ids: thumbIds}));
                    this.requestAllRenderingDefs(action);
                }
        } else params.success =
            (response) => imgInf.requestImgRDef();
        $.ajax(params);
    }

    /**
     * Appends the channel and map parameters
     *
     * @param {string} url the url to append to
     * @return string the url with the appended parameters
     *
     * @private
     * @memberof Settings
     */
    appendChannelsAndMapsToQueryString(url) {
        if (typeof url !== 'string') return url;

        let imgInf = this.image_config.image_info;
        if (!Misc.isArray(imgInf.channels) || imgInf.channels.length === 0)
            return "";

        url += '&c=';
        let i=0;
        let maps = [];
        imgInf.channels.map(
            (c) => {
                url+= (i !== 0 ? ',' : '') + (!c.active ? '-' : '') + (++i) +
                 "|" + c.window.start + ":" + c.window.end + "$" + c.color;
                 maps.push(
                     {"reverse" : { "enabled" :
                         typeof c.reverseIntensity === 'boolean' &&
                         c.reverseIntensity}
                     });
             });
        return url + "&maps=" + JSON.stringify(maps);
    }

    /**
     * Applies the rendering settings, keeping a history of the old settings
     *
     * @param {Object} rdef the rendering defintion
     * @param {boolean} for_pasting true if rdef supplied it for pasting of settings, false otherwise
     * @memberof Settings
     */
    applyRenderingSettings(rdef, for_pasting=true) {
        if (rdef === null) return;

        if (typeof for_pasting !== 'boolean') for_pasting = true;
        let imgInfo = this.image_config.image_info;
        let history = [];

        // model (color/greyscale)
        let model =
            (for_pasting && typeof rdef.m === 'string' && rdef.m.length > 0) ?
                rdef.m.toLowerCase() :
                    (!for_pasting && typeof rdef.model === 'string' &&
                        rdef.model.length > 0) ?
                            (rdef.model.toLowerCase() === 'greyscale') ?
                                "greyscale" : "color" : null;
        if (model && (model[0] === 'g' || model[0] === 'c')) {
            let oldValue = imgInfo.model;
            imgInfo.model = model[0] === 'g' ? "greyscale" : "color";
            if (oldValue !== imgInfo.model)
               history.push({ // add to history if different
                   prop: ['image_info', 'model'],
                   old_val : oldValue,
                   new_val: imgInfo.model,
                   type: 'string'});
        }

        // copy channel values and add change to history
        let channels = for_pasting ?
            Misc.parseChannelParameters(rdef.c) : rdef.c;
        let mode = CHANNEL_SETTINGS_MODE.MIN_MAX;
        if (channels)
            for (let i=0;i<channels.length;i++) {
                if (typeof imgInfo.channels[i] !== 'object') continue;
                let actChannel = imgInfo.channels[i];
                let copiedChannel = channels[i];
                if (actChannel.active !== copiedChannel.active) {
                   history.push({
                       prop: ['image_info', 'channels', '' + i, 'active'],
                       old_val : actChannel.active,
                       new_val: copiedChannel.active,
                       type: 'boolean'});
                    actChannel.active = copiedChannel.active;
                }
                if (actChannel.window.start !== copiedChannel.start) {
                    history.push({
                        prop: ['image_info', 'channels',
                            '' + i, 'window', 'start'],
                        old_val : actChannel.window.start,
                        new_val: copiedChannel.start,
                        type: 'number'});
                     actChannel.window.start = copiedChannel.start;
                }
                if (actChannel.window.end !== copiedChannel.end) {
                    history.push({
                        prop: ['image_info', 'channels',
                            '' + i, 'window', 'end'],
                        old_val : actChannel.window.end,
                        new_val: copiedChannel.end,
                        type: 'number'});
                     actChannel.window.end = copiedChannel.end;
                }
                let newColor =
                    typeof copiedChannel.lut === 'string' &&
                        copiedChannel.lut.length > 0 ?
                            copiedChannel.lut : copiedChannel.color;
                if (actChannel.color !== newColor) {
                   history.push({
                       prop: ['image_info', 'channels', '' + i, 'color'],
                       old_val : actChannel.color,
                       new_val: newColor,
                       type: 'string'});
                    actChannel.color = copiedChannel.color;
                }
                if (typeof copiedChannel.reverseIntensity === 'undefined')
                    copiedChannel.reverseIntensity = null;
                if (actChannel.reverseIntensity !==
                        copiedChannel.reverseIntensity) {
                            history.push({
                                prop: ['image_info',
                                    'channels', '' + i, 'reverseIntensity'],
                                old_val : actChannel.reverseIntensity,
                                new_val: copiedChannel.reverseIntensity,
                                type: 'boolean'});
                    actChannel.reverseIntensity =
                        copiedChannel.reverseIntensity;
                }
            };
        if (history.length > 0) {
            history.splice(0, 0,
                {   prop: ['image_info','initial_values'],
                    old_val : true,
                    new_val:  true,
                    type : "boolean"});
            this.image_config.addHistory(history);
        }

        this.image_config.changed();
    }

    /**
     * Pastes the rendering settings
     *
     * @memberof Settings
     */
    paste() {
        this.image_config.image_info.requestImgRDef(
            this.applyRenderingSettings.bind(this));
    }

    /**
     * Applies user settings from rdefs[index]
     *
     * @param {number} index the index in the rdefs array
     * @memberof Settings
     */
    applyUserSetting(index) {
        this.applyRenderingSettings(this.rdefs[index], false);
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
        this.unsubscribe();
        if (this.histogram) this.histogram.destroyHistogram();
        this.image_config = null;
    }
}
