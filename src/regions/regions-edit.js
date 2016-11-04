// js
import Context from '../app/context';
import {REGIONS_MODE} from '../utils/constants';
import {
    REGIONS_CHANGE_MODES, REGIONS_SET_PROPERTY, REGIONS_PASTE_SHAPES
} from '../events/events';
import {inject, customElement, bindable} from 'aurelia-framework';

/**
 * Represents the regions section in the right hand panel
 */
@customElement('regions-edit')
@inject(Context)
export default class RegionsEdit {
    /**
     *a bound reference to regions_info
     * @memberof RegionsEdit
     * @type {RegionsEdit}
     */
    @bindable regions_info = null;

    /**
     * a list of keys we want to listen for
     * @memberof RegionsEdit
     * @type {Object}
     */
    key_actions = [
        { key: 65, func: this.selectAllShapes},                     // ctrl - a
        { key: 67, func: this.copyShapes},                          // ctrl - c
        { key: 86, func: this.pasteShapes}                          // ctrl - v
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
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RegionsEdit
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
     * Selects all shapes
     *
     * @memberof RegionsEdit
     */
    selectAllShapes() {
        let ids = this.regions_info.unsophisticatedShapeFilter();
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
     * @memberof RegionsEdit
     */
    detached() {
        this.key_actions.map(
            (action) => this.context.removeKeyListener(action.key));
    }

    /**
     * Sets edit mode to either modify or translate
     *
     * @memberof RegionsEdit
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
     * Copy Shapes
     *
     * @memberof RegionsEdit
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
     * @memberof RegionsEdit
     */
    pasteShapes() {
        this.context.publish(
            REGIONS_PASTE_SHAPES,
            {config_id : this.regions_info.image_info.config_id,
                shapes : this.regions_info.copied_shapes});
    }
}
