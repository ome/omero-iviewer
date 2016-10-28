// js
import Context from '../app/context';
import {REGIONS_MODE} from '../utils/constants';
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
     * Deletes selected/all shapes
     *
     * @memberof Regions
     */
    deleteShapes(all=false, undo=false) {
        if (typeof all !== 'boolean') all = false;
        if (typeof undo !== 'boolean') undo = false;
        let ids = [];

        // if we don't want all we only take the selected and not yet deleted
        this.regions_info.data.forEach(
            (value, key) => {
                if (all || undo) ids.push(key);
                else if (value.selected && !value.deleted)
                    ids.push(key);});

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
