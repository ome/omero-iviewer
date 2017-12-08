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
import Context from '../app/context';
import Misc from '../utils/misc';
import Histogram from './histogram';
import Ui from '../utils/ui';
import {
    CHANNEL_SETTINGS_MODE, IMAGE_CONFIG_RELOAD, TABS, WEBGATEWAY
} from '../utils/constants';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

import {
    IMAGE_INTENSITY_QUERYING, IMAGE_SETTINGS_CHANGE, THUMBNAILS_UPDATE,
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
     * a reference to the image config (bound in template)
     * @memberof Settings
     * @type {ImageConfig}
     */
    @bindable image_config = null;
    image_configChanged(newVal, oldVal) {
        this.waitForImageInfoReady();
    }

    /**
     * a list of keys we want to listen for
     * @memberof Settings
     * @type {Object}
     */
    key_actions = [
        { key: 83, func: this.saveImageSettings},            // ctrl - s
        { key: 89, func: this.redo},                         // ctrl - y
        { key: 90, func: this.undo},                         // ctrl - z
        { key: 67, func: this.copy},                         // ctrl - v
        { key: 86, func: this.paste}                         // ctrl - y
    ];

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
      * the property observer
      * @memberof Settings
      * @type {Object}
      */
     observer = null;

     /**
      * the image info ready observers
      * @memberof Settings
      * @type {Object}
      */
     image_info_ready_observer = null;

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
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
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
            // register observer
            this.registerObserver();
            // event subscriptions
            this.subscribe();
            // fire off ajax request for rendering defs
            this.requestAllRenderingDefs();
            // instantiate histogram
            if (this.histogram) this.histogram.destroyHistogram();
            this.histogram = new Histogram(this.image_config.image_info);
            if (this.image_config.show_histogram)
                this.histogram.toggleHistogramVisibilty(true);
        };

        // tear down old observers/subscription
        this.unregisterObservers();
        this.unsubscribe();
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
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Settings
     */
    attached() {
        Ui.registerKeyHandlers(
            this.context, this.key_actions, TABS.SETTINGS, this);
    }

    /**
     * Retrieves all rendering settings for the image
     *
     * @param {function} action a handler to be executed in both success/error case
     * @memberof Settings
     */
    requestAllRenderingDefs(action) {
        if (!this.image_config.image_info.ready) return;

        let img_id = this.image_config.image_info.image_id;
        $.ajax({
            url : this.context.server +
                    this.context.getPrefixedURI(WEBGATEWAY) +
                        "/get_image_rdefs_json/" + img_id + '/',
            success : (response) => {
                if (!Misc.isArray(response.rdefs) ||
                    img_id !== this.image_config.image_info.image_id) return;

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
     * @param {Object} event the mouse event object
     * @memberof Settings
     */
    toggleHistogram(event) {
        event.stopPropagation();
        event.preventDefault();

        if (this.histogram) {
            this.image_config.show_histogram =
                this.histogram.toggleHistogramVisibilty(event.target.checked);
        }
        return false;
    }

    /**
     * on model change handler
     *
     * @memberof Settings
     */
    onModelChange(flag) {
        let history = [];

        if (flag) {
            // for change to grayscale:
            // we take the first one that's active, then disable all others after
            // if none is active, the first one will be made active
            let channels = this.image_config.image_info.channels;
            let firstActive = -1;

            // little helper f updating active flag and history
            let f = (c, i, a) => {
                c.active = a;
                history.push({
                    prop: ['image_info', 'channels', '' + i, 'active'],
                    old_val : !a,
                    new_val: a,
                    type: 'boolean'});
            }

            for (let i=0;i<channels.length;i++) {
                let c = channels[i];
                if (firstActive < 0 && c.active) firstActive = i;
                if (i > firstActive && c.active) f(c, i, false);

            };
            if (firstActive < 0) f(channels[0], 0, true);
        }

        // add history for model info
        history.push({
                prop: ['image_info', 'model'],
                old_val : !flag ? 'greyscale' : 'color',
                new_val: flag ? 'greyscale' : 'color',
                type: 'string'});
        this.image_config.addHistory(history);
    }

    /**
     * Persists the rendering settings
     *
     * @memberof Settings
     */
    saveImageSettings() {
        if (!this.image_config.image_info.ready ||
            !this.image_config.image_info.can_annotate ||
            this.image_config.history.length === 0 ||
            this.image_config.historyPointer < 0) return;

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
        url = Misc.appendChannelsAndMapsToQueryString(image_info.channels, url);

        $.ajax(
            {url : url,
             method: 'POST',
            success : (response) => {
                this.image_config.resetHistory();
                // reissue get rendering requests, then
                // force thumbnail update
                let action =
                    (() => {
                        this.context.publish(
                            THUMBNAILS_UPDATE,
                            { config_id : this.image_config.id,
                              ids: [image_info.image_id]});
                        if (this.context.useMDI)
                            this.context.reloadImageConfigForGivenImage(
                                image_info.image_id,
                                IMAGE_CONFIG_RELOAD.IMAGE,
                                this.image_config.id);
                });
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
        if (!this.image_config.image_info.ready) return;

        // we delegate (after confirming choice)
        let desc = "Do you want to apply the settings to all Images ";
        if (typeof this.image_config.image_info.dataset_id === 'number')
            desc += "in Dataset " + this.image_config.image_info.dataset_id + "?";
        else desc += "in the Dataset?"

        Ui.showConfirmationDialog(
            "Save Image Settings", desc, () => this.copy(true))
    }

    /**
     * Undoes the last change
     *
     * @memberof Settings
     */
    undo() {
        if (this.image_config.image_info.ready) {
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
        if (this.image_config.image_info.ready) {
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
        if (!this.image_config.image_info.ready) return;

        if (toAll && Misc.useJsonp(this.context.server)) {
            Ui.showModalMessage("Saving to All will not work cross-domain!", 'OK');
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
        url = Misc.appendChannelsAndMapsToQueryString(imgInf.channels, url);

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
                toids: imgInf.parent_id,
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
                        (() => {
                            this.context.publish(
                                THUMBNAILS_UPDATE,
                                { config_id : imgInf.config_id, ids: thumbIds});
                            if (this.context.useMDI)
                                this.context.reloadImageConfigsGivenParent(
                                    imgInf.parent_id,
                                    imgInf.parent_type,
                                    imgInf.config_id);
                    });
                    this.requestAllRenderingDefs(action);
                }
        } else params.success =
            (response) => imgInf.requestImgRDef();
        $.ajax(params);
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
            Misc.parseChannelParameters(rdef.c, rdef.maps) : rdef.c;
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
                if (typeof copiedChannel.inverted === 'undefined')
                    copiedChannel.inverted = null;
                if (actChannel.inverted !==
                        copiedChannel.inverted) {
                            history.push({
                                prop: ['image_info',
                                    'channels', '' + i, 'inverted'],
                                old_val : actChannel.inverted,
                                new_val: copiedChannel.inverted,
                                type: 'boolean'});
                    actChannel.inverted =
                        copiedChannel.inverted;
                }
                if (typeof copiedChannel['family'] === 'string' &&
                    copiedChannel['family'] !== "" &&
                    typeof copiedChannel['coefficient'] === 'number' &&
                    !isNaN(copiedChannel['coefficient'])) {
                        history.push({
                            prop: ['image_info', 'channels', '' + i, 'family'],
                            old_val : actChannel.family,
                            new_val: copiedChannel.family,
                            type: 'string'});
                         actChannel.family = copiedChannel.family;
                        history.push({
                            prop: ['image_info', 'channels', '' + i, 'coefficient'],
                            old_val : actChannel.coefficient,
                            new_val: copiedChannel.coefficient,
                            type: 'string'});
                         actChannel.coefficient = copiedChannel.coefficient;
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
        if (!this.image_config.image_info.ready ||
            this.image_config.image_info.copied_img_rdef === null) return;

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
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info, 'model')
                    .subscribe(
                        (newValue, oldValue) =>
                            this.context.publish(
                                IMAGE_SETTINGS_CHANGE,
                                { config_id: this.image_config.id,
                                  sync_group: this.image_config.sync_group,
                                  model: newValue}));
    }

    /**
     * Toggles interpolation for image
     *
     * @param {Object} event the event object
     * @memberof Settings
     */
    toggleInterpolation(event) {
        event.preventDefault();
        event.stopPropagation();

        this.context.interpolate = event.target.checked;
        this.context.publish(
            IMAGE_SETTINGS_CHANGE, {interpolate: this.context.interpolate});

        return false;
    }

    /**
     * Toggles intensity querying for image
     *
     * @param {Object} event the event object
     * @memberof Settings
     */
    togglePixelIntensity(event) {
        if (this.image_config === null) return;

        event.preventDefault();
        event.stopPropagation();

        this.context.publish(
            IMAGE_INTENSITY_QUERYING,
            {config_id: this.image_config.id, flag: event.target.checked});

        return false;
    }

    /**
     * Unregisters the the observers (property and image info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof Settings
     */
    unregisterObservers(property_only = false) {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
        if (property_only) return;
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Settings
     */
    detached() {
        this.key_actions.map(
            (action) =>
                this.context.removeKeyListener(action.key, TABS.SETTINGS));
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Settings
     */
    unbind() {
        if (this.histogram) this.histogram.destroyHistogram();
        this.unregisterObservers();
        this.unsubscribe();
    }
}
