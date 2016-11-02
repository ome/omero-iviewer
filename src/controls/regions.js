// js
import Context from '../app/context';
import {REGIONS_MODE} from '../utils/constants';
import Misc from '../utils/misc';
import {
    REGIONS_CHANGE_MODES, REGIONS_SET_PROPERTY,
    REGIONS_SHOW_COMMENTS} from '../events/events';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions section in the right hand panel
 */
@customElement('regions')
@inject(Context)
export default class Regions {
    /**
     * which image config do we belong to (bound in template)
     * @memberof Regions
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image config
     * @memberof Regions
     * @type {RegionsInfo}
     */
    regions_info = null;

    /**
     * a key
     * @memberof Regions
     * @type {Object}
     */
    key_handlers = {
        65 : { func: this.selectAllShapes},                     // ctrl - a
        67 : { func: this.copyShapes},                          // ctrl - c
        68 : { func: this.deleteShapes},                        // ctrl - d
        80 : { func: this.pasteShapes},                         // ctrl - p
        83 : { func: this.saveShapes},                          // ctrl - s
        85 : { func: this.deleteShapes, args: [false, true]}    // ctrl - u
    };

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Regions
     */
    bind() {
        let img_conf = this.context.getImageConfig(this.config_id);
        if (img_conf && img_conf.regions_info)
            this.regions_info = img_conf.regions_info;

    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Regions
     */
    attached() {
        window.onkeydown = (event) => {
            if (!this.context.show_regions || !event.ctrlKey) return;

            try {
                let keyHandler = this.key_handlers[event.keyCode];
                keyHandler.func.apply(this, keyHandler.args);
                return false;
            } catch(whatever) {}
        };
    }

    /**
     * Selects all shapes
     *
     * @memberof Regions
     */
    selectAllShapes() {
        let ids = this.unsophisticatedShapeFilter();
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property: 'selected',
               shapes : ids, clear: true,
               value : true, center : false});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Regions
     */
    detached() {
        window.onkeydown = null;
    }

    /**
     * Sets edit mode to either modify or translate
     *
     * @memberof Regions
     */
    setEditMode(modify=false) {
        let mode = [REGIONS_MODE.TRANSLATE];
        if (typeof modify === 'boolean' && modify) mode = [REGIONS_MODE.MODIFY];

        this.context.publish(
            REGIONS_CHANGE_MODES, {
                config_id : this.regions_info.image_info.config_id,
                modes : mode});
    }

    /**
     * Saves all modified, deleted and new shapes
     *
     * @memberof Regions
     */
    saveShapes() {
        alert("not implemented yet");
    }

    /**
     * Copy Shapes
     *
     * @memberof Regions
     */
    copyShapes() {
        // nothing selected
        if (this.regions_info.selected_shapes.length === 0) return;

        this.regions_info.copied_shapes = []; // empty first
        // loop over the selected and find the json for the shape,
        //then store it this.regions_info.copied_shapes and
        // in the localStorage (if supported)
        this.regions_info.selected_shapes.map(
            (id) => this.regions_info.copied_shapes.push(
                Object.assign({}, this.regions_info.data.get(id))));

        if (typeof window.localStorage)
            window.localStorage.setItem(
                "viewer-ng.copied_shapes",
                JSON.stringify(this.regions_info.copied_shapes));
    }

    /**
     * Paste Shapes
     *
     * @memberof Regions
     */
    pasteShapes() {
        this.regions_info.copied_shapes.map((def) => console.info(def));
        alert("not implemented yet");
    }

    unsophisticatedShapeFilter(properties=[], values=[], ids=null) {
        let ret = [];
        if (!Misc.isArray(properties) || !Misc.isArray(values) ||
                properties.length !== values.length) return ret;

        let filter = (value) => {
            for (let i=0;i<properties.length;i++) {
                if (typeof value[properties[i]] === 'undefined') continue;
                if (value[properties[i]] !== values[i]) return false;
            }
            return true;
        };

        let hasIdsForFilter = Misc.isArray(ids);
        // iterate over all shapes
        this.regions_info.data.forEach(
            (value, key) => {
                if (hasIdsForFilter && ids.indexOf(key) !== -1 && filter(value))
                    ret.push(key);
                else if (!hasIdsForFilter && filter(value)) ret.push(key);
        });

        return ret;
    }

    /**
     * Deletes selected/all shapes
     *
     * @memberof Regions
     */
    deleteShapes(all=false, undo=false) {
        if (typeof all !== 'boolean') all = false;
        if (typeof undo !== 'boolean') undo = false;
        let ids = [];

        // if we don't want all we only take the selected and not yet deleted
        if (all || undo) ids = this.unsophisticatedShapeFilter();
        else ids = this.unsophisticatedShapeFilter(
                        ["deleted"], [false],
                        this.regions_info.selected_shapes);

        if (ids.length === 0) return;

        this.context.publish(
            REGIONS_SET_PROPERTY,
        {config_id : this.regions_info.image_info.config_id,
            property: 'state', shapes : ids, value: undo ? 'undo' : 'delete'});
    }

    /**
     * Show/Hide Text Labels
     *
     * @param {boolean} flag show comments if true, otherwise false
     * @memberof Regions
     */
    showComments(flag = false) {
        this.context.publish(
            REGIONS_SHOW_COMMENTS,
        {config_id : this.regions_info.image_info.config_id, value: flag});
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Regions
     */
    unbind() {
        this.regions_info = null;
    }
}
