// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {
    REGIONS_SET_PROPERTY, REGIONS_STORE_SHAPES,REGIONS_SHOW_COMMENTS
} from '../events/events';
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
     * a reference to the image info
     * @memberof Regions
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * a reference to the regions info
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
        { key: 83, func: this.saveShapes},                          // ctrl - s
        { key: 89, func: this.redoHistory},                         // ctrl - y
        { key: 90, func: this.undoHistory}                          // ctrl - z
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
        if (img_conf && img_conf.regions_info) {
            this.image_info = img_conf.image_info;
            this.regions_info = img_conf.regions_info;
        }
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
                            let command =
                                Misc.isApple() ? 'metaKey' : 'ctrlKey';
                            if (!this.context.isRoisTabActive() ||
                                    !event[command]) return;
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
        if (Misc.useJsonp(this.context.server)) {
            alert("Saving the regions will not work cross-domain!");
            return;
        }

        this.context.publish(
            REGIONS_STORE_SHAPES,
            {config_id : this.regions_info.image_info.config_id,
                selected: false});
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
     * Undoes the last region modification
     *
     * @memberof Regions
     */
    undoHistory() {
        this.regions_info.history.undoHistory();
    }

    /**
     * Redoes a previous region modification
     *
     * @memberof Regions
     */
    redoHistory() {
        this.regions_info.history.redoHistory();
    }
}
