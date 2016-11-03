// js
import Context from '../app/context';
import {
    REGIONS_SET_PROPERTY, REGIONS_SHOW_COMMENTS} from '../events/events';
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
     * a list of keys we want to listen for
     * @memberof Regions
     * @type {Object}
     */
    key_actions = [
        { key: 68, func: this.deleteShapes},                        // ctrl - d
        { key: 85, func: this.deleteShapes, args: [false, true]},   // ctrl - u
        { key: 83, func: this.saveShapes}                           // ctrl - s
    ];

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
        this.key_actions.map(
            (action) =>
                this.context.addKeyListener(
                    action.key,
                        (event) => {
                            if (!this.context.show_regions ||
                                    !event.ctrlKey) return;
                            action.func.apply(this, action.args);
                        }));
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Regions
     */
    detached() {
        this.key_actions.map(
            (action) => this.context.removeKeyListener(action.key));
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
        if (all || undo) ids = this.regions_info.unsophisticatedShapeFilter();
        else ids = this.regions_info.unsophisticatedShapeFilter(
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
