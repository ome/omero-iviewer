// js
import Context from '../app/context';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import {Converters} from '../utils/converters';
import {REGIONS_DRAWING_MODE} from '../utils/constants';
import {
    REGIONS_DRAW_SHAPE, REGIONS_SHAPE_GENERATED,
    REGIONS_GENERATE_SHAPES, REGIONS_CHANGE_MODES, EventSubscriber
} from '../events/events';

/**
 * Represents the regions drawing palette in the right hand panel
 */
@customElement('regions-drawing')
@inject(Context, BindingEngine)
export default class RegionsDrawing extends EventSubscriber {
    /**
     * a bound reference to regions_info
     * @memberof RegionsDrawing
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * a list of supported shapes for iteration
     * @memberof RegionsDrawing
     * @type {Array.<string>}
     */
    supported_shapes = [
        "rectangle",
        "ellipse",
        "point",
        "arrow",
        "line",
        "polygon",
        "label"
    ];

    /**
     * events we subscribe to
     * @memberof RegionsDrawing
     * @type {Array.<string,function>}
     */
    sub_list = [
        [REGIONS_SHAPE_GENERATED,
            (params={}) => this.onShapeDrawn(params)],
        [REGIONS_CHANGE_MODES,
            (params={}) => this.onModeChange(params)]];

    /**
     * the list of observers
     * @memberof RegionsDrawing
     * @type {Array.<Object>}
     */
    observers = [];

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
     * Registers observers to react to drawing mode & shape_defaults changes
     *
     * @memberof RegionsDrawing
     */
    registerObservers() {
        let createObservers = () => {
            this.unregisterObservers();
            let action = () => {
                let idx =
                    this.supported_shapes.indexOf(
                        this.regions_info.shape_to_be_drawn);
                if (idx < 0) return;
                this.onDrawShape(idx);
            };
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.regions_info, "drawing_mode")
                        .subscribe((newValue, oldValue) => action()));
            for (let p in this.regions_info.shape_defaults)
                this.observers.push(
                    this.bindingEngine.propertyObserver(
                        this.regions_info.shape_defaults, p)
                            .subscribe((newValue, oldValue) => action()));
        };

        if (this.regions_info === null) {
            this.observers.push(
                this.bindingEngine.propertyObserver(this, 'regions_info')
                    .subscribe((newValue, oldValue) => {
                        if (oldValue === null && newValue) createObservers();
                }));
        } else createObservers();
    }

    /**
     * Unregisters observers
     *
     * @memberof RegionsDrawing
     */
    unregisterObservers() {
        this.observers.map((o) => o.dispose());
        this.observers = [];
    }

    /**
     * Handles the viewer's event notification after having drawn a shape
     *
     * @memberof RegionsDrawing
     * @param {Object} params the event notification parameters
     */
    onShapeDrawn(params={}) {
        // if the event is for another config, forget it...
        if (params.config_id !== this.regions_info.image_info.config_id) return;

        // set default for param drawn
        if (typeof params.drawn !== 'boolean') params.drawn = false;
        let add = typeof params.add !== 'boolean' || params.add;

        // the roi we belong to
        let roi_id = params.drawn ? params.roi_id : null;

        let generatedShapes = [];
        if (Misc.isArray(params.shapes) && params.shapes.length > 0) {
            // when entering after drawing we'll have a roi_id in the params
            // which is not the case if we propagate
            if (roi_id === null) {
                let ids =
                    Converters.extractRoiAndShapeId(params.shapes[0].oldId);
                roi_id = ids.roi_id;
            }
            // check whether we need a new shapes map:
            // this is the case for newly drawn shapes but not propagated ones
            let shapes = this.regions_info.data.get(roi_id);
            if (typeof shapes !== 'undefined' && shapes.shapes instanceof Map)
                shapes = shapes.shapes;
            else {
                shapes = new Map();
                this.regions_info.data.set(roi_id, {
                    shapes: shapes, show: true, deleted: 0
                });
            }
            // add to regions data
            params.shapes.map(
                (shape) => {
                    let newShape =
                        Converters.amendShapeDefinition(shape);
                    if (newShape) {
                        // we also want these flags
                        newShape.is_new = true;
                        newShape.visible = true;
                        newShape.selected = false;
                        newShape.deleted = false;
                        newShape.modified = true;
                        // add to map (if flag is true)
                        if (add) shapes.set(newShape['@id'], newShape);
                        generatedShapes.push(Object.assign({}, newShape));
                    }
                });
        }

        // add a history entry for the drawn shapes, if we have at least one
        // and no directive to not add a history record
        if (typeof params.add_history !== 'boolean') params.add_history = true;
        if (typeof params.hist_id !== 'number') params.hist_id = -1;
        let len = generatedShapes.length;
        if (len !== 0 && add && params.add_history) {
            this.regions_info.history.addHistory(
                params.hist_id, this.regions_info.history.action.SHAPES,
                { diffs: generatedShapes, old_vals: false, new_vals: true});
        }

        // we only continue if we have been drawn and intend to propagate
        if (params.drawn)
            this.onDrawShape(
                this.supported_shapes.indexOf(
                    this.regions_info.shape_to_be_drawn), true);
        if (!params.drawn || len === 0) return;

        // collect dimensions for propagation
        let newShape = Object.assign({}, generatedShapes[len-1]);
        let theDims =
            Utils.getDimensionsForPropagation(
                this.regions_info, newShape.TheZ, newShape.TheT);
        if (theDims.length === 0) return;

        // for grouping propagated shapes within the same roi
        // we need a common roi. if we have one from the params we use it
        // otherwise we get a new one
        roi_id =
            (typeof params.roi_id === 'number' && params.roi_id < 0) ?
                params.roi_id : this.regions_info.getNewRegionsId();

        // trigger generation
        this.context.publish(
            REGIONS_GENERATE_SHAPES,
            {
                config_id : this.regions_info.image_info.config_id,
                shapes : [newShape],
                number : theDims.length,
                random : false, theDims : theDims,
                hist_id : params.hist_id, roi_id: roi_id
            });
    }

    /**
     * Either sends a notification to start the viewer's drawing interaction OR
     * to abort an active drawing interaction
     *
     * @memberof RegionsDrawing
     * @param {number} index the index matching an entry in the supported_shapes array
     */
    onDrawShape(index) {
        // combined abort (index = -1) and bounds check
        let abort = false;
        if (index < 0 || index >= this.supported_shapes.length) {
            abort = true;
            this.regions_info.shape_to_be_drawn = null;
        } else {
            this.regions_info.shape_to_be_drawn = this.supported_shapes[index];
        }

        // define shape to be drawn including any pre-set defaults (e.g. colors)
        let def =  {type: this.regions_info.shape_to_be_drawn};
        for (let s in this.regions_info.shape_defaults)
            def[s] = this.regions_info.shape_defaults[s];

        // send drawing notification to ol3 viewer
        this.context.publish(
           REGIONS_DRAW_SHAPE, {
               config_id: this.regions_info.image_info.config_id,
               shape : def, abort: abort,
               hist_id: this.regions_info.history.getHistoryId(),
               roi_id: this.regions_info.getNewRegionsId()});
    }

    /**
     * If we had a mode change (translate/modify)
     * we have to abort the draw mode
     *
     * @memberof RegionsDrawing
     * @param {Object} params the event notification parameters
     */
     onModeChange(params={}) {
         // if the event is for another config, forget it...
         if (params.config_id !== this.regions_info.image_info.config_id) return;

         this.regions_info.shape_to_be_drawn = null;
         // send drawing abort notification to ol3 viewer
         this.context.publish(
            REGIONS_DRAW_SHAPE, {config_id: params.config_id, abort: true});
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof RegionsDrawing
     */
    bind() {
        this.subscribe();
        this.registerObservers();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RegionsDrawing
     */
    unbind() {
        this.unsubscribe();
        this.unregisterObservers();
    }
}
