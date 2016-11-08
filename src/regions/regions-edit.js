// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {REGIONS_MODE} from '../utils/constants';
import {
    REGIONS_CHANGE_MODES, REGIONS_SET_PROPERTY,
    REGIONS_PASTE_SHAPES,REGIONS_MODIFY_SHAPES
} from '../events/events';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spectrum} from 'spectrum-colorpicker';

/**
 * Represents the regions section in the right hand panel
 */
@customElement('regions-edit')
@inject(Context, Element, BindingEngine)
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
    constructor(context, element, bindingEngine) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
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


        let strokeOptions = this.getColorPickerOptions(false);
        let strokeSpectrum =
            $(this.element).find(".shape-stroke-color .spectrum-input");
        strokeSpectrum.spectrum(strokeOptions);
        let fillOptions = this.getColorPickerOptions(true);
        let fillSpectrum =
            $(this.element).find(".shape-fill-color .spectrum-input");
        fillSpectrum.spectrum(fillOptions);
        /*
        $(this.element).find(".spectrum-input").spectrum({
             color: 'rgba(255,255,255,0)',
             disabled: true,
             showInput: true,
             showAlpha: true,
             showInitial: true,
             preferredFormat: "rgb",
             containerClassName: 'fill-color-spectrum-container',
             replacerClassName: 'shape-color-replacer',
             appendTo: $(this.element).find('.shape-fill-color'),
             change: (color) => this.onColorChange(
                 color.toRgbString())});
        */
        this.registerObserver();
    }

    /**
     * Creates a callback function that is intended to be called per shape
     * and modify the properties according to the new values
     *
     * @param {Array.<string>} properties the properties to be changed
     * @param {Array.<?>} values the respective values for the properties
     * @return {function} a function which takes a shape as an input or null
     * @memberof RegionsEdit
     */
     createUpdateHandler(properties = [], values = []) {
         // we expect 2 non empty arrays of equal length
         if (!Misc.isArray(properties) || properties.length === 0 ||
                !Misc.isArray(values) || values.length !== properties.length)
            return null;

        let callback = (shape) => {
            if (typeof shape !== 'object' || shape === null) return;

            for (let i=0;i<properties.length;i++) {
                let prop = properties[i];
                if (typeof shape[prop] !== 'undefined') shape[prop] = values[i];
            };
        }

        return callback;
     }

    /**
     * Handles fill/stroke color changes
     *
     * @param {string} color a color in rgba notation
     * @param {boolean} fill the fill color if true, the stroke color otherwise
     * @param {Object} shape the primary shape that the change was invoked on
     * @memberof RegionsEdit
     */
    onColorChange(color, fill=true, shape=null) {
        if (typeof shape !== 'object' || shape === null) return;
        if (typeof fill !== 'boolean') fill = true;

        // we create a deep copy, make the color definition changes
        // and then request the changes
        // once successful we execute the callback to update the actual
        // shape definition
        let deepCopyOfShape = Object.assign({}, shape);
        let properties =
            fill ? ['fillColor', 'fillAlpha'] : ['strokeColor', 'strokeAlpha'];
        let values = Misc.rgbaToHexAndAlpha(color);
        if (!Misc.isArray(values) || values.length !== 2) return;

        for (let i=0;i<properties.length;i++)
            deepCopyOfShape[properties[i]] = values[i];

        this.modifyShapes(
            deepCopyOfShape, this.createUpdateHandler(properties, values));
    }

    /**
     * Notifies the viewer to change the shaape according to the new shape
     * definition
     *
     * @param {Object} shape_definition the object definition incl. attributes
     *                                  to be changed
     * @param {function} callback a callback function on success
     * @memberof RegionsEdit
     */
    modifyShapes(shape_definition, callback = null) {
        if (typeof shape_definition !== 'object' ||
                shape_definition === null) return;

        this.context.publish(
           REGIONS_MODIFY_SHAPES, {
               config_id: this.regions_info.image_info.config_id,
               shapes : this.regions_info.selected_shapes,
               definition: shape_definition,
                callback: callback});
    }

    /**
     * Registers an observer to watch the selected shapes
     * to adjust the fill and line color options
     *
     * @memberof RegionsEdit
     */
    registerObserver() {
        this.unregisterObserver();
        this.observer =
            this.bindingEngine.collectionObserver(
                this.regions_info.selected_shapes)
                    .subscribe(
                        (newValue, oldValue) =>
                            this.adjustFillAndStrokePreview());
    }

    /**
     * Unregisters the selected shapes observer
     *
     * @memberof RegionsEdit
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
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
         $(this.element).find(".spectrum-input").spectrum("destroy");
         this.unregisterObserver();
    }

    /**
     * Sets the colors  for the edit buttons on shape selection
     *
     * @memberof RegionsEdit
     */
    adjustFillAndStrokePreview() {
        let lastId =
            this.regions_info.selected_shapes.length === 0 ?
                -1 :
                this.regions_info.selected_shapes.length-1;
        let lastSelection =
            lastId === -1 ? null :
            this.regions_info.data.get(
                this.regions_info.selected_shapes[lastId]);
        let type =
            lastSelection ? lastSelection.type.toLowerCase() : null;

        // STROKE COLOR
        let strokeOptions =
            this.getColorPickerOptions(false, lastSelection);
        let strokeSpectrum =
            $(this.element).find(".shape-stroke-color .spectrum-input");
        let strokeColor =
            lastSelection ?
                lastSelection.strokeColor : '#FFFFFF';
        let strokeAlpha =
            lastSelection ?
                lastSelection.strokeAlpha : 0;
        strokeOptions.color = Misc.hexColorToRgba(strokeColor, strokeAlpha);
        strokeSpectrum.spectrum(strokeOptions);
        if (lastSelection) strokeSpectrum.spectrum("enable");

        // FILL COLOR
        let fillOptions = this.getColorPickerOptions(true, lastSelection);
        let fillSpectrum =
            $(this.element).find(".shape-fill-color .spectrum-input");

        // set fill (if not disabled)
        let fillDisabled = type === null ||
                type === 'line' || type === 'polyline' || type === 'label';
        if (fillDisabled) {
            fillSpectrum.spectrum(fillOptions);
            return;
        }

        let fillColor =
            lastSelection ?
                lastSelection.fillColor : '#FFFFFF';
        let fillAlpha =
            lastSelection ?
                lastSelection.fillAlpha : 1.0;
        fillOptions.color = Misc.hexColorToRgba(fillColor, fillAlpha);
        fillSpectrum.spectrum(fillOptions);
        fillSpectrum.spectrum("enable");
    }

    /**
     * Gets the appropriate color picker options for the given needs
     *
     * @memberof RegionsEdit
     * @param {boolean} fill true if we want fill color options, otherwise stroke
     * @param {Object} shape the last selection to be used for the change handler
     * @private
     */
    getColorPickerOptions(fill=true, shape=null) {
        let options =  {
            disabled: true,
            color: 'rgba(255,255,255,0)',
            showInput: true,
            showAlpha: true,
            showInitial: true,
            preferredFormat: "rgb",
            containerClassName: 'color-spectrum-container',
            replacerClassName:
                fill ? 'shape-fill-color-replacer' :
                        'shape-stroke-color-replacer',
            appendTo: fill ?
                $(this.element).find('.shape-fill-color') :
                $(this.element).find('.shape-stroke-color')
        };
        if (shape)
            options.change =
                (color) => this.onColorChange(color.toRgbString(), fill, shape);

        return options;
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
