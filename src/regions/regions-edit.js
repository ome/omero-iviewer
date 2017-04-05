// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import {Converters} from '../utils/converters';
import {REGIONS_MODE} from '../utils/constants';
import {
    REGIONS_COPY_SHAPES, REGIONS_GENERATE_SHAPES,
    REGIONS_MODIFY_SHAPES, REGIONS_SET_PROPERTY
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
     * @memberof RegionsEdit
     * @type {Object}
     */
    last_selected = null;

    /**
     * the list of observers
     * @memberof RegionsEdit
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, element, bindingEngine) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof RegionsEdit
     */
    bind() {
        this.registerObservers();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RegionsEdit
     */
    unbind() {
        this.unregisterObservers();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RegionsEdit
     */
    attached() {
        // register key listeners
        this.key_actions.map(
            (action) =>
                this.context.addKeyListener(
                    action.key,
                        (event) => {
                            if (!this.context.show_regions ||
                                    !event.ctrlKey) return;
                            action.func.apply(this, action.args);
                        }));

        // set up ui widgets such as color pickers and spinners
        let strokeOptions = this.getColorPickerOptions(false);
        let strokeSpectrum =
            $(this.element).find(".shape-stroke-color .spectrum-input");
        strokeSpectrum.spectrum(strokeOptions);
        let fillOptions = this.getColorPickerOptions(true);
        let fillSpectrum =
            $(this.element).find(".shape-fill-color .spectrum-input");
        fillSpectrum.spectrum(fillOptions);

        let strokeWidthSpinner =
            $(this.element).find(".shape-stroke-width input");
        strokeWidthSpinner.spinner({
            min: 0, disabled: true});
        strokeWidthSpinner.spinner("value", 1);

        let editComment = $(this.element).find(".shape-edit-comment input");
        editComment.prop("disabled", true);
        editComment.addClass("disabled-color");
        let fontSizeSpinner =
            $(this.element).find(".shape-font-size input");
        fontSizeSpinner.spinner({min: 1, disabled: true});
        fontSizeSpinner.spinner("value", 10);
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

         let deltaProps = {type: shape.type};
         let property = fill ? 'FillColor' : 'StrokeColor';
         let value = Converters.rgbaToSignedInteger(color);
         if (typeof value !== 'number') return;

         deltaProps[property] = value;

         this.modifyShapes(
             deltaProps, this.createUpdateHandler([property], [value]));

        this.setDrawColors(color, fill);
     }

     /**
      * Sets default fill/stroke color for drawing
      *
      * @param {string} color a color in rgba notation
      * @param {boolean} fill the fill color if true, the stroke color otherwise
      * @memberof RegionsEdit
      */
     setDrawColors(color, fill=true) {
         if (typeof fill !== 'boolean') fill = true;

         let value = Converters.rgbaToSignedInteger(color);
         if (typeof value !== 'number') return;

         this.regions_info.shape_defaults[fill ? 'FillColor' : 'StrokeColor'] =
            value;
     }

    /**
     * Handles stroke width changes
     *
     * @param {number} width the new stroke width
     * @param {Object} shape the primary shape that the change was invoked on
     * @memberof RegionsEdit
     */
    onStrokeWidthChange(width = 10,shape=null) {
        if (typeof shape !== 'object' || shape === null) return;
        if (typeof width !== 'number' || isNaN(width) || width < 0) return;

        let deltaProps = {type: shape.type};
        deltaProps.StrokeWidth = {
            '@type': 'TBD#LengthI',
            'Unit': 'PIXEL',
            'Symbol': 'pixel',
            'Value': width
        };

        this.modifyShapes(
            deltaProps, this.createUpdateHandler(
                ['StrokeWidth'], [Object.assign({}, deltaProps.StrokeWidth)]));
    }

    /**
     * Handles font size changes
     *
     * @param {number} size the new font size
     * @param {Object} shape the primary shape that the change was invoked on
     * @memberof RegionsEdit
     */
    onFontSizeChange(size = 10,shape=null) {
        if (typeof shape !== 'object' || shape === null) return;
        if (typeof size !== 'number' || isNaN(size) || size < 1) return;

        let deltaProps = {type: shape.type};
        deltaProps.FontStyle =
            typeof shape.FontStyle === 'string' ? shape.FontStyle : 'normal';
        deltaProps.FontFamily =
            typeof shape.FontFamily === 'string' ?
                shape.FontFamily : 'sans-serif';
        deltaProps.FontSize = {
            '@type': 'TBD#LengthI',
            'Unit': 'PIXEL',
            'Symbol': 'pixel',
            'Value': size
        };

        this.modifyShapes(
            deltaProps, this.createUpdateHandler(
                ['FontSize', 'FontStyle', 'FontFamily'],
                [Object.assign({}, deltaProps.FontSize),
                 deltaProps.FontStyle, deltaProps.FontFamily]));
    }

    /**
     * Handles comment changes
     *
     * @param {string} comment the new  text  value
     * @param {Object} shape the primary shape that the change was invoked on
     * @memberof RegionsEdit
     */
    onCommentChange(comment = '',shape=null) {
        if (typeof shape !== 'object' || shape === null) return;
        if (typeof comment !== 'string') return;

        let deltaProps = {type: shape.type};
        deltaProps.Text = comment;

        this.modifyShapes(
            deltaProps,
            this.createUpdateHandler(['Text'], [comment]));
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
     * Registers observers to watch the selected shapes and whether we
     * are presently drawing for the purpose of adjusting
     * the fill and line color options
     *
     * @memberof RegionsEdit
     */
    registerObservers() {
        this.unregisterObservers();

        let createObservers = () => {
            this.observers.push(
                this.bindingEngine.collectionObserver(
                    this.regions_info.selected_shapes)
                        .subscribe(
                            (newValue, oldValue) => {
                                if (this.regions_info.shape_to_be_drawn === null &&
                                    this.regions_info.selected_shapes.length === 0)
                                        this.regions_info.shape_defaults = {};
                                this.adjustEditWidgets();
                            }));
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.regions_info, 'shape_to_be_drawn')
                        .subscribe(
                            (newValue, oldValue) => {
                                if (oldValue !== null && newValue === null)
                                    this.regions_info.shape_defaults = {};
                                this.adjustEditWidgets();
                            }));
        };
        if (this.regions_info === null) {
            this.observers.push(
                this.bindingEngine.propertyObserver(this, 'regions_info')
                    .subscribe((newValue, oldValue) => {
                        if (oldValue === null && newValue) {
                            this.unregisterObservers();
                            createObservers();
                    }}));
        } else createObservers();
    }

    /**
     * Unregisters all observers
     *
     * @memberof RegionsEdit
     */
    unregisterObservers() {
        this.observers.map((o) => {
            if (o) o.dispose();
        });
        this.observers = [];
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
         $(this.element).find(".shape-stroke-width input").spinner("destroy");
    }

    /**
     * Sets the last selected shape
     *
     * @private
     * @memberof RegionsEdit
     */
    setLastSelected() {
        let lastId =
            this.regions_info.selected_shapes.length === 0 ?
                -1 :
                this.regions_info.selected_shapes.length-1;
        this.last_selected =
            lastId === -1 ? null :
            this.regions_info.getShape(
                this.regions_info.selected_shapes[lastId]);
    }

    /**
     * Reacts to shape selections, adjusting the edit widgets accordingly
     *
     * @memberof RegionsEdit
     */
    adjustEditWidgets() {
        this.setLastSelected();
        let type =
            this.last_selected ? this.last_selected.type.toLowerCase() : null;

        // COMMENT
        let editComment = $(this.element).find(".shape-edit-comment input");
        editComment.off('input');
        editComment.val('Comment');
        if (this.last_selected) {
            editComment.prop("disabled", false);
            editComment.removeClass("disabled-color");
            editComment.val(
                typeof this.last_selected.Text === 'string' ?
                    this.last_selected.Text : '');
            editComment.on('input',
                (event) =>
                    this.onCommentChange(event.target.value, this.last_selected));
        } else {
            editComment.prop("disabled", true);
            editComment.addClass("disabled-color");
        }
        let fontSize =
            this.last_selected ?
                (typeof this.last_selected.FontSize === 'object' &&
                 this.last_selected.FontSize !== null &&
                 typeof this.last_selected.FontSize.Value === 'number' ?
                this.last_selected.FontSize.Value : 10) : 10;
        let fontSizeSpinner = $(this.element).find(".shape-font-size input");
        fontSizeSpinner.off("input spinstop");
        fontSizeSpinner.spinner("value", fontSize);
        if (this.last_selected) {
            fontSizeSpinner.spinner("enable");
            fontSizeSpinner.on("input spinstop",
               (event, ui) => this.onFontSizeChange(
                   parseInt(event.target.value), this.last_selected));
        } else fontSizeSpinner.spinner("disable");

        // STROKE COLOR & WIDTH
        let strokeOptions =
            this.getColorPickerOptions(false, this.last_selected);
        let strokeSpectrum =
            $(this.element).find(".shape-stroke-color .spectrum-input");
        let strokeWidthSpinner =
            $(this.element).find(".shape-stroke-width input");
        let strokeColor =
            this.last_selected ?
                this.last_selected.StrokeColor :
                typeof this.regions_info.shape_defaults.StrokeColor === 'number' ?
                    this.regions_info.shape_defaults.StrokeColor : 10092517;
        let strokeWidth =
            this.last_selected ?
                (typeof this.last_selected.StrokeWidth === 'object' &&
                 this.last_selected.StrokeWidth !== null &&
                 typeof this.last_selected.StrokeWidth.Value === 'number' ?
                    this.last_selected.StrokeWidth.Value : 1) : 1;
        if ((type === 'line' || type === 'polyline') && strokeWidth === 0)
            strokeWidth = 1;
        strokeOptions.color = Converters.signedIntegerToRgba(strokeColor);
        strokeSpectrum.spectrum(strokeOptions);
        // STROKE width
        strokeWidthSpinner.off("input spinstop");
        strokeWidthSpinner.spinner("value", strokeWidth);
        if (this.regions_info.shape_to_be_drawn === null)
            strokeSpectrum.spectrum("enable");
        if (this.last_selected) {
            strokeWidthSpinner.spinner("enable");
            strokeWidthSpinner.on("input spinstop",
               (event, ui) => this.onStrokeWidthChange(
                   parseInt(event.target.value), this.last_selected));
        } else strokeWidthSpinner.spinner("disable");
        this.setDrawColors(strokeOptions.color, false);

        // ARROW
        let arrowButton = $(this.element).find(".arrow-button button");
        if (type && type.indexOf('line') >= 0) {
            arrowButton.prop('disabled', false);
            arrowButton.removeClass('disabled-color');
            $('.marker_start').html(
                typeof this.last_selected['MarkerStart'] === 'string' &&
                    this.last_selected['MarkerStart'] === 'Arrow' ?
                        '&#10003;' : '&nbsp;');
            $('.marker_end').html(
                typeof this.last_selected['MarkerEnd'] === 'string' &&
                    this.last_selected['MarkerEnd'] === 'Arrow' ?
                        '&#10003;' : '&nbsp;');
        } else {
            arrowButton.prop('disabled', true);
            arrowButton.addClass('disabled-color');
        }

        // FILL COLOR
        let fillOptions = this.getColorPickerOptions(true, this.last_selected);
        let fillSpectrum =
            $(this.element).find(".shape-fill-color .spectrum-input");
        let fillColor =
            this.last_selected ?
                this.last_selected.FillColor :
                typeof this.regions_info.shape_defaults.FillColor === 'number' ?
                    this.regions_info.shape_defaults.FillColor : -129;
        fillOptions.color = Converters.signedIntegerToRgba(fillColor);
        fillSpectrum.spectrum(fillOptions);
        // set fill (if not disabled)
        let fillDisabled =
            this.regions_info.shape_to_be_drawn !== null ||
                type === 'line' || type === 'polyline' || type === 'label';
        if (fillDisabled) {
            fillSpectrum.spectrum("disable");
            return;
        }
        this.setDrawColors(fillOptions.color, true);
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
            disabled: this.regions_info.shape_to_be_drawn !== null,
            color: fill ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 153, 255, 0.7)',
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
        else options.change =
            (color) => this.setDrawColors(color.toRgbString(), fill);

        return options;
    }

    /**
     * Toggles if line has an arrow
     *
     * @param {boolean} head if true we append arrow at head, otherwise tail
     * @memberof RegionsEdit
     */
    toggleArrow(head=true) {
        if (this.last_selected === null) return;

        if (typeof head !== 'boolean') head = true;

        let deltaProps = {type: 'polyline'};
        let property = head ? 'MarkerEnd' : 'MarkerStart';
        let hasArrowMarker =
            typeof this.last_selected[property] === 'string' &&
                this.last_selected[property] === 'Arrow';

        let value = hasArrowMarker ? "" : "Arrow";
        deltaProps[property] = value;

        this.modifyShapes(
            deltaProps, this.createUpdateHandler([property], [value]));
    }

    /**
     * Creates a more custom update handler than the standard one
     *
     * @return {function} the wrapped standard update handler
     * @memberof RegionsEdit
     */
    createUpdateHandler(properties, values) {
        let func =
            Utils.createUpdateHandler(
                properties,values,
                this.regions_info.history,
                this.regions_info.history.getHistoryId(),
                this.adjustEditWidgets.bind(this));
        return func;
    }

    /**
     * Copy Shapes
     *
     * @memberof RegionsEdit
     */
    copyShapes() {
        this.context.publish(
            REGIONS_COPY_SHAPES,
            {config_id : this.regions_info.image_info.config_id});
   }

    /**
     * Paste Shapes
     *
     * @memberof RegionsEdit
     */
    pasteShapes() {
        let hist_id = this.regions_info.history.getHistoryId();
        this.context.publish(
            REGIONS_GENERATE_SHAPES,
            {config_id : this.regions_info.image_info.config_id,
                shapes : this.regions_info.copied_shapes,
                number : 1, random : true, hist_id : hist_id
            });
    }
}
