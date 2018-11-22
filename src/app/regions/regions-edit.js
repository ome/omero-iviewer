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
import Context from '../context';
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import Ui from '../utils/ui';
import {Converters} from '../utils/converters';
import {
    REGIONS_DRAWING_MODE, PERMISSION_TOOLTIPS, PROJECTION, TABS
} from '../utils/constants';
import {
    IMAGE_DIMENSION_CHANGE, REGIONS_MODIFY_SHAPES, REGIONS_SET_PROPERTY,
    EventSubscriber
} from '../events/events';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spectrum} from 'spectrum-colorpicker';

/**
 * Represents the regions section in the right hand panel
 * @extends {EventSubscriber}
 */
@customElement('regions-edit')
@inject(Context, Element, BindingEngine)
export default class RegionsEdit extends EventSubscriber {
    /**
     * a bound reference to regions_info
     * and its associated change handler
     * @memberof RegionsEdit
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;
    regions_infoChanged(newVal, oldVal) {
        this.waitForRegionsInfoReady();
    }

    /**
     * a list of keys we want to listen for
     * @memberof RegionsEdit
     * @type {Object}
     */
    key_actions = [
        { key: 'A', func: this.selectAllShapes },                 // ctrl - a
        { key: 'C', func: this.copyShapes },                      // ctrl - c
        { key: 'V', func: this.pasteShapes },                     // ctrl - v
        { key: 'Delete', func: this.deleteShapes, ctrl: false},   // DELETE
        { key: 'Del', func: this.deleteShapes, ctrl: false},      // DEL IE
        { key: 'Backspace', func: this.deleteShapes, ctrl: false} // DEL MAC
    ];

    /**
     * events we subscribe to
     * @memberof RegionsEdit
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_DIMENSION_CHANGE, () => this.adjustEditWidgets()]];

    /**
     * @memberof RegionsEdit
     * @type {Object}
     */
    last_selected = null;

    /**
     * the list of property observers
     * @memberof RegionsEdit
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the regions info ready observers
     * @memberof RegionsEdit
     * @type {Object}
     */
    regions_ready_observer = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, element, bindingEngine) {
        super(context.eventbus);
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
        this.waitForRegionsInfoReady();
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
        this.unsubscribe();
    }

    /**
     * Makes sure that all regions info data is there
     *
     * @memberof RegionsEdit
     */
    waitForRegionsInfoReady() {
        if (this.regions_info === null) return;

        let onceReady = () => {
            if (this.regions_info === null) return;
            // register observer
            this.registerObservers();
            // subscribe
            this.subscribe();
            // register key listeners
            Ui.registerKeyHandlers(
                this.context, this.key_actions, TABS.ROIS, this);
            this.adjustEditWidgets()
        };

        // tear down old observers/subscription
        this.unregisterObservers();
        this.unsubscribe();
        if (this.regions_info.ready) {
            onceReady();
            return;
        }

        // we are not yet ready, wait for ready via observer
        if (this.regions_ready_observer === null)
            this.regions_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.regions_info, 'ready').subscribe(
                        (newValue, oldValue) => onceReady());
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RegionsEdit
     */
    attached() {
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
        strokeWidthSpinner.spinner({min: 0, disabled: false});
        strokeWidthSpinner.spinner("value", 1);

        let editComment = $(this.element).find(".shape-edit-comment input");
        editComment.prop("disabled", true);
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
        if (typeof width !== 'number' || isNaN(width) || width < 0) return;

        let strokeWidth = {
            '@type': 'TBD#LengthI',
            'Unit': 'PIXEL',
            'Symbol': 'pixel',
            'Value': width
        };
        this.regions_info.shape_defaults.StrokeWidth =
            Object.assign({}, strokeWidth);
        if (typeof shape !== 'object' || shape === null) return;

        let deltaProps = {type: shape.type};
        deltaProps.StrokeWidth = strokeWidth;

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
            'Unit': 'POINT',
            'Symbol': 'pt',
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
        if (typeof shape !== 'object' || shape === null ||
            typeof comment !== 'string') return;

        let deltaProps = {type: shape.type};
        deltaProps.Text = comment;

        this.modifyShapes(
            deltaProps,
            this.createUpdateHandler(['Text'], [comment]));
    }

    /**
     * Runs checks for an attachment input field and its associated value
     *
     * @param {Element} input the attachment input field element
     * @param {boolean} reset if true we reset to the present attachment
     * @return {number} returns input value or -1 if value was erroneous
     */
    checkAttachmentInput(input, reset=false) {
        let dim = input.attr("dim");
        let dims = this.regions_info.image_info.dimensions;
        let presentValue = dims[dim] + 1;

        // input value check
        let value = input.val().replace(/\s/g, "");
        if (value === "") {
            if (reset) input.val(presentValue);
            return -1;
        }
        value = parseInt(value);
        if (isNaN(value)) {
            if (reset) input.val(presentValue);
            return -1;
        }

        // bounds check
        if (value < 1 || value > dims['max_' + dim]) {
            if (reset) input.val(presentValue);
            return -1;
        }

        // index for user starts with 1, internally we start at 0
        return value-1;
    }

    /**
     * Handles fill/stroke color changes
     *
     * @param {number} value the new attachment value
     * @param {string} dim the dimension we attach to
     * @param {Object} shape the primary shape that the change was invoked on
     * @memberof RegionsEdit
     */
    onAttachmentChange(value, dim = 't', shape = null) {
        if (typeof value !== 'number' || typeof dim !== 'string') return;
        let upperDim = dim.toUpperCase();
        if (typeof shape !== 'object' || shape === null) {
            // we haven't got any selection so this is a (potential) drawing mode
            // adjustment
            let otherDim = dim === 't' ? 'Z' : 'T';
            if (value < 0) {
                this.regions_info.drawing_mode =
                    (this.regions_info.drawing_mode ===
                        REGIONS_DRAWING_MODE['NOT_' + otherDim]) ?
                            REGIONS_DRAWING_MODE.NEITHER_Z_NOR_T :
                            REGIONS_DRAWING_MODE['NOT_' + upperDim];
            } else if (this.regions_info.drawing_mode ===
                            REGIONS_DRAWING_MODE['NOT_' + otherDim] ||
                       this.regions_info.drawing_mode ===
                            REGIONS_DRAWING_MODE.NEITHER_Z_NOR_T) {
                                this.regions_info.drawing_mode =
                                    REGIONS_DRAWING_MODE['NOT_' + otherDim];
            } else this.regions_info.drawing_mode =
                        REGIONS_DRAWING_MODE.PRESENT_Z_AND_T;

            return;
        }
        // selected shape(s) need changing
        let prop = 'The' + upperDim;
        let deltaProps = { type: shape.type };
        deltaProps[prop] = value;

        this.modifyShapes(
            deltaProps, this.createUpdateHandler([prop], [value], true), true);
    }

    /**
     * Notifies the viewer to change the shaape according to the new shape
     * definition
     *
     * @param {Object} shape_definition the object definition incl. attributes
     *                                  to be changed
     * @param {function} callback a callback function on success
     * @param {boolean} modifies_attachment does definition alter z/t attachment
     * @memberof RegionsEdit
     */
    modifyShapes(shape_definition, callback = null, modifies_attachment = false) {
        if (typeof shape_definition !== 'object' ||
                shape_definition === null) return;

        this.context.publish(
           REGIONS_MODIFY_SHAPES, {
               config_id: this.regions_info.image_info.config_id,
               shapes: this.regions_info.selected_shapes,
               modifies_attachment: modifies_attachment,
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
        this.observers.push(
            this.bindingEngine.collectionObserver(
                this.regions_info.selected_shapes)
                    .subscribe(
                        (newValue, oldValue) => this.adjustEditWidgets()));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.regions_info, 'shape_to_be_drawn')
                    .subscribe(
                        (newValue, oldValue) => this.adjustEditWidgets()));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.regions_info.image_info, 'projection')
                    .subscribe(
                        (newValue, oldValue) => this.adjustEditWidgets()));
    }

    /**
     * Unregisters the the observers (property and regions info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof RegionsEdit
     */
    unregisterObservers(property_only = false) {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
        if (property_only) return;
        if (this.regions_ready_observer) {
            this.regions_ready_observer.dispose();
            this.regions_ready_observer = null;
        }
    }

    /**
     * Selects all shapes
     *
     * @memberof RegionsEdit
     */
    selectAllShapes() {
        if (!this.regions_info.ready) return;

        let ids = this.regions_info.getAllShapeIds();
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
            (action) => this.context.removeKeyListener(action.key, TABS.ROIS));
         $(this.element).find(".spectrum-input").spectrum("destroy");
         $(this.element).find(".shape-stroke-width input").spinner("destroy");
    }

    /**
     * Adjusts the edit section for comments after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
    adjustCommentEdit(canDo=false, showDisabled=true) {
        let editComment = $(this.element).find(".shape-edit-comment input");
        editComment.off();
        editComment.val('Comment');
        editComment.attr('title',"");
        if (this.last_selected) {
            editComment.val(
                typeof this.last_selected.Text === 'string' ?
                    this.last_selected.Text : '');
            editComment.on('change keyup',
                (event) => {
                    if (event.type === 'keyup' && event.keyCode !== 13) return;
                    this.onCommentChange(
                        event.target.value, this.last_selected)
                });
            editComment.prop("disabled", showDisabled);
            if (showDisabled)
                editComment.attr('title', PERMISSION_TOOLTIPS.CANNOT_EDIT);
        } else editComment.prop("disabled", true);

        let fontSize =
            this.last_selected ?
                (typeof this.last_selected.FontSize === 'object' &&
                 this.last_selected.FontSize !== null &&
                 typeof this.last_selected.FontSize.Value === 'number' ?
                this.last_selected.FontSize.Value : 10) : 10;
        let fontSizeSpinner = $(this.element).find(".shape-font-size input");
        fontSizeSpinner.off();
        fontSizeSpinner.spinner("value", fontSize);
        fontSizeSpinner.on("change keyup spinstop",
            (event, ui) => {
               if (event.type === 'keyup' && event.keyCode !== 13) return;
               this.onFontSizeChange(
                   parseInt(event.target.value), this.last_selected)
            });
        fontSizeSpinner.spinner(canDo ? "enable" : "disable");
        fontSizeSpinner.attr(
            'title', showDisabled ? PERMISSION_TOOLTIPS.CANNOT_EDIT : "");
    }

    /**
     * Adjusts the dimension attachment edit section after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
    adjustAttachmentEdit(canDo=false, showDisabled=true) {
        let dims = this.regions_info.image_info.dimensions;
        let hasProjection =
            this.regions_info.image_info.projection === PROJECTION.INTMAX;
        let shapeAttachments =
            $(this.element).find(".shape-edit-attachments").children();
        let shapeAttachmentsInput = shapeAttachments.filter("input");
        let shapeAttachmentsLocks = shapeAttachments.filter(
            "[name='shape-edit-attachments-locks']");
        shapeAttachmentsLocks.addClass('disabled-color');
        shapeAttachments.attr("title", "");
        shapeAttachmentsInput.prop("disabled", true);
        let selected = this.regions_info.selected_shapes.length;

        if (dims.max_t > 1 || dims.max_z > 1) {
            shapeAttachmentsInput.off();
            shapeAttachmentsInput.val('');
            shapeAttachmentsLocks.removeClass("dim_locked");
            shapeAttachmentsLocks.addClass("dim_unlocked");
            shapeAttachmentsLocks.off();

            // initialize attachments of last selected shape
            ['t', 'z'].map(
                (d) => {
                    let prop = 'The' + d.toUpperCase();
                    let filter = "[dim='" + d + "']";
                    let hasMoreThanOneEntry = dims['max_' + d] > 1;
                    let zProjection =
                        hasMoreThanOneEntry && d === 'z' && hasProjection;
                    let respectiveAttachementLock =
                        shapeAttachmentsLocks.filter(filter);
                    let previouslyUnattached =
                        d === 'z' ?
                            this.regions_info.drawing_mode ===
                                REGIONS_DRAWING_MODE.NOT_Z ||
                            this.regions_info.drawing_mode ===
                                REGIONS_DRAWING_MODE.NEITHER_Z_NOR_T :
                            respectiveAttachementLock.attr("locked") === "";
                    let unattached = this.last_selected ?
                        this.last_selected[prop] === -1 : previouslyUnattached;
                    respectiveAttachementLock.attr(
                        'locked', unattached || zProjection ? "" : "locked");
                    respectiveAttachementLock.removeClass(
                        unattached ? "dim_locked" : "dim_unlocked");
                    respectiveAttachementLock.addClass(
                        unattached || zProjection ?
                            "dim_unlocked" : "dim_locked");
                    let respectiveDimensionInput =
                        shapeAttachmentsInput.filter(filter);
                    if (zProjection) respectiveDimensionInput.val("");
                    else respectiveDimensionInput.val(
                            unattached ? dims[d] + 1 : this.last_selected ?
                                this.last_selected[prop] + 1 : dims[d] + 1);
                    if (!zProjection && hasMoreThanOneEntry && (!showDisabled ||
                        (this.regions_info.image_info.can_annotate &&
                         this.last_selected === null))) {
                            let title = "Lock " +
                                (selected === 0 ? "new " : "selected ") +
                                (selected === 1 ? "shape " : "shapes ") + "to" +
                                (selected === 0 ? " current " : " ") +
                                d.toUpperCase() + '-index';
                            respectiveAttachementLock.attr('title', title);
                            respectiveAttachementLock.removeClass("disabled-color");
                            if (!unattached)
                                respectiveDimensionInput.prop("disabled", false);
                    }
                    if (showDisabled) {
                        respectiveDimensionInput.attr(
                            "title", PERMISSION_TOOLTIPS.CANNOT_EDIT);
                        respectiveAttachementLock.attr(
                            "title", PERMISSION_TOOLTIPS.CANNOT_EDIT);
                    }
            });

            if (this.regions_info.image_info.can_annotate) {
                // set up various event handlers for attachment changes
                let checkAttachmentInput0 =
                    (event, reset = false) => {
                        if (!this.regions_info.image_info.can_annotate) return;
                        let dim = event.target.getAttribute('dim');
                        if (this.regions_info.image_info.dimensions[
                            'max_' + dim] <= 1) return -1;
                        let respectiveTextInput =
                            shapeAttachmentsInput.filter('[dim="' + dim + '"]');
                        return this.checkAttachmentInput(respectiveTextInput, reset);
                    };
                // reset on blur (if check of input value check fails)
                shapeAttachmentsInput.on('blur',
                    (event) => checkAttachmentInput0(event, true));
                // change attachment value (if input value check succeeds)
                shapeAttachmentsInput.on('change keyup',
                    (event) => {
                        if (event.type === 'keyup' && event.keyCode !== 13) return;
                        let dim = event.target.getAttribute('dim');
                        let value = checkAttachmentInput0(event);
                        if (value >= 0)
                            this.onAttachmentChange(value, dim, this.last_selected);
                    });
                // click handler on locks
                shapeAttachmentsLocks.on('click',
                    (event) => {
                        if (showDisabled) return;
                        let dim = event.target.getAttribute('dim');
                        let zProjection = dim === 'z' && hasProjection;
                        if (this.regions_info.image_info.dimensions[
                            'max_' + dim] <= 1 || zProjection) return;
                        let locked =
                            event.target.getAttribute('locked') === 'locked';
                        if (locked) {
                            this.onAttachmentChange(-1, dim, this.last_selected);
                            event.target.className = 'dim_unlocked';
                        } else {
                            let val = checkAttachmentInput0(event, true);
                            if (val < 0) return;
                            this.onAttachmentChange(
                                val, dim, this.last_selected);
                            event.target.className = 'dim_locked';
                        }
                        event.target.setAttribute(
                            "locked", locked ? "" : "locked");
                        let respectiveTextInput =
                            shapeAttachmentsInput.filter('[dim="' + dim + '"]');
                        respectiveTextInput.prop('disabled', locked);
                    });
            }
        }
    }

    /**
     * Adjusts the stroke style edit section after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
    adjustStrokeEdit(canDo=false, showDisabled=true) {
        let type =
            this.last_selected ? this.last_selected.type.toLowerCase() : null;

        let strokeOptions =
            this.getColorPickerOptions(false, this.last_selected);
        let strokeSpectrum =
            $(this.element).find(".shape-stroke-color .spectrum-input");
        $(".shape-stroke-color").attr('title', '');
        strokeSpectrum.spectrum("enable");
        let strokeColor =
            this.last_selected ?
                this.last_selected.StrokeColor :
                    this.regions_info.shape_defaults.StrokeColor;
        let strokeWidth =
            this.last_selected ?
                (typeof this.last_selected.StrokeWidth === 'object' &&
                 this.last_selected.StrokeWidth !== null &&
                 typeof this.last_selected.StrokeWidth.Value === 'number' ?
                    this.last_selected.StrokeWidth.Value : 1) :
                        this.regions_info.shape_defaults.StrokeWidth.Value;
        if ((type === 'line' || type === 'polyline') && strokeWidth === 0)
            strokeWidth = 1;
        else if (type === 'label') strokeWidth = 0;
        strokeOptions.color = Converters.signedIntegerToRgba(strokeColor);
        strokeSpectrum.spectrum(strokeOptions);

        let strokeWidthSpinner =
            $(this.element).find(".shape-stroke-width input");
        strokeWidthSpinner.off();
        strokeWidthSpinner.attr("title", "");
        strokeWidthSpinner.spinner("enable");
        if (type === 'label') {
            strokeWidthSpinner.spinner("value", 0);
            strokeWidthSpinner.spinner("disable");
        } else {
            strokeWidthSpinner.spinner("value", strokeWidth);
            strokeWidthSpinner.on("change keyup spinstop",
               (event, ui) => {
                   if (event.type === 'keyup' && event.keyCode !== 13) return;
                   this.onStrokeWidthChange(
                       parseInt(event.target.value), this.last_selected)
               });
        }
        this.setDrawColors(strokeOptions.color, false);
        if (showDisabled) {
            strokeSpectrum.spectrum("disable");
            strokeWidthSpinner.spinner("disable");
            strokeWidthSpinner.attr(
                'title', PERMISSION_TOOLTIPS.CANNOT_EDIT);
            $(".shape-stroke-color").attr(
                'title', PERMISSION_TOOLTIPS.CANNOT_EDIT);
        }
    }

    /**
     * Adjusts the arrow style edit section after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
     adjustArrowEdit(canDo=false, showDisabled=true) {
        let type =
            this.last_selected ? this.last_selected.type.toLowerCase() : null;

        let arrowButton = $(this.element).find(".arrow-button button");
        arrowButton.attr(
            'title', showDisabled ? PERMISSION_TOOLTIPS.CANNOT_EDIT : "");
        if (type && type.indexOf('line') >= 0 && !showDisabled) {
            arrowButton.prop('disabled', false);
            $('.marker_start').html(
                typeof this.last_selected['MarkerStart'] === 'string' &&
                    this.last_selected['MarkerStart'] === 'Arrow' ?
                        '&#10003;' : '&nbsp;');
            $('.marker_end').html(
                typeof this.last_selected['MarkerEnd'] === 'string' &&
                    this.last_selected['MarkerEnd'] === 'Arrow' ?
                        '&#10003;' : '&nbsp;');
        } else arrowButton.prop('disabled', true);
    }

    /**
     * Adjusts the fill style edit section after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
     adjustFillEdit(canDo=false, showDisabled=true) {
        let type =
            this.last_selected ? this.last_selected.type.toLowerCase() : null;

        let fillOptions = this.getColorPickerOptions(true, this.last_selected);
        let fillSpectrum =
            $(this.element).find(".shape-fill-color .spectrum-input");
        let fillColor = -256;
        let fillDisabled =
            type === 'line' || type === 'polyline' || type === 'label';
        if (!fillDisabled) {
            fillColor =
                this.last_selected ?
                    this.last_selected.FillColor :
                        this.regions_info.shape_defaults.FillColor;
        }
        fillOptions.color = Converters.signedIntegerToRgba(fillColor);
        fillSpectrum.spectrum(fillOptions);
        $(".shape-fill-color").attr('title', '');
        // set fill (if not disabled)
        if (fillDisabled || showDisabled) {
            if (showDisabled)
                $(".shape-fill-color").attr(
                    'title', PERMISSION_TOOLTIPS.CANNOT_EDIT);
            fillSpectrum.spectrum("disable");
            return;
        }
        this.setDrawColors(fillOptions.color, true);
        fillSpectrum.spectrum("enable");
    }

    /**
     * Adjusts the delete button after selection changes
     *
     * @param {boolean} canDo permission flag for required permission
     * @param {boolean} showDisabled if true we disable (due to permissions)
     * @memberof RegionsEdit
     */
     adjustDeleteButton(canDo=false, showDisabled=true) {
        let deleteButton = $(this.element).find(".shape-delete-button");
        deleteButton.prop(
            'disabled',
            showDisabled || this.regions_info.selected_shapes.length === 0);
        deleteButton.attr(
            'title', showDisabled ? PERMISSION_TOOLTIPS.CANNOT_DELETE : '');
    }

    /**
     * Reacts to shape selections, adjusting the edit widgets accordingly
     *
     * @memberof RegionsEdit
     */
    adjustEditWidgets() {
        this.last_selected = this.regions_info.getLastSelectedShape();
        let canEdit =
            this.regions_info.checkShapeForPermission(
                this.last_selected, "canEdit");
        let canDelete =
            this.regions_info.checkShapeForPermission(
                this.last_selected, "canDelete");
        let showEditDisabled =
                (this.regions_info.selected_shapes.length >= 1 && !canEdit);
        let showDeleteDisabled =
                (this.regions_info.selected_shapes.length >= 1 && !canDelete);

        // break up adjustment into individual sections
        this.adjustCommentEdit(canEdit, showEditDisabled);
        this.adjustAttachmentEdit(canEdit, showEditDisabled);
        this.adjustStrokeEdit(canEdit, showEditDisabled);
        this.adjustArrowEdit(canEdit, showEditDisabled);
        this.adjustFillEdit(canEdit, showEditDisabled);
        this.adjustDeleteButton(canDelete, showDeleteDisabled);
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
            disabled: this.regions_info === null,
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
     * @private
     * @param {Array.<string>} properties the properties that changed
     * @param {Array.<?>} value the values of the properties that changed
     * @param {boolean} modifies_attachment if true dimension attachment changed
     * @return {function} the wrapped standard update handler
     * @memberof RegionsEdit
     */
    createUpdateHandler(properties, values, modifies_attachment = false) {
        let updates = { properties: properties, values: values };
        let history = {
            hist: this.regions_info.history,
            hist_id: this.regions_info.history.getHistoryId()
        };
        return Utils.createUpdateHandler(
                    updates, history,
                    this.adjustEditWidgets.bind(this), modifies_attachment);
    }

    /**
     * Copies shapes
     *
     * @memberof RegionsEdit
     */
    copyShapes() {
        this.regions_info.copyShapes();
    }

    /**
     * Paste Shapes
     *
     * @memberof RegionsEdit
     */
    pasteShapes() {
        this.regions_info.pasteShapes();
    }

    /**
     * Deletes selected shapes (incl. permissions check)
     *
     * @memberof RegionsEdit
     */
    deleteShapes() {
        this.regions_info.deleteShapes();
    }
}
