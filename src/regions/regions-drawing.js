// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import {Converters} from '../utils/converters';
import { REGIONS_MODE, REGIONS_DRAWING_MODE} from '../utils/constants';
import {
    REGIONS_DRAW_SHAPE, REGIONS_SHAPE_GENERATED,
    REGIONS_GENERATE_SHAPES, REGIONS_CHANGE_MODES, EventSubscriber
} from '../events/events';

/**
 * Represents the regions drawing palette in the right hand panel
 */
@customElement('regions-drawing')
@inject(Context)
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
     * @type {RegionsInfo}
     */
    supported_shapes = [
        "arrow",
        "rectangle",
        "ellipse",
        "point",
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
     * the type of shape that is to be drawn,
     * i.e. a draw interaction is active if non null. value should match
     * one of supported_shapes
     * @memberof RegionsDrawing
     * @type {string|null}
     */
    shape_to_be_drawn = null;

    /**
     * Handles the viewer's event notification after having drawn a shape
     *
     * @memberof RegionsDrawing
     * @param {Object} params the event notification parameters
     */
    onShapeDrawn(params={}) {
        // if the event is for another config, forget it...
        if (params.config_id !== this.regions_info.image_info.config_id) return;

        let generatedShapes = [];
        if (Misc.isArray(params.shapes))
            params.shapes.map(
                (shape) => {
                    let newShape =
                        Converters.makeShapeBackwardsCompatible(shape);
                    if (newShape) {
                        // we also want these flags
                        newShape.is_new = true;
                        newShape.visible = true;
                        newShape.selected = false;
                        newShape.deleted = false;
                        newShape.modified = true;
                        // add to map
                        this.regions_info.data.set(newShape.shape_id, newShape);
                        generatedShapes.push(Object.assign({}, newShape));
                    }
                });

        // add a history entry for the drawn shapes, if we have at least one
        // and no directive to not add a history record
        if (typeof params.add_history !== 'boolean') params.add_history = true;
        if (typeof params.hist_id !== 'number') params.hist_id = -1;
        let len = generatedShapes.length;
        if (len !== 0 && params.add_history) {
            this.regions_info.history.addHistory(
                params.hist_id, this.regions_info.history.action.SHAPES,
                { diffs: generatedShapes, old_vals: false, new_vals: true});
        }

        // we only continue if we have been drawn and intend to propagate
        // (i.e. drawing mode other that z and t viewed)
        // these checks are vital otherwise we risk a chain reaction
        if (typeof params.drawn !== 'boolean') params.drawn = false;
        if (!params.drawn || len === 0) return;

        // collect dimensions for propagation
        let newShape = Object.assign({}, generatedShapes[len-1]);
        let theDims =
            Utils.getDimensionsForPropagation(
                this.regions_info, newShape.theZ, newShape.theT);

        // for grouping propagated shapes within the same roi
        // we need a common roi. if we have one from the params we use it
        // otherwise we get a new one
        let roi_id =
            (typeof params.roi_id === 'number' && params.roi_id < 0) ?
                params.roi_id : this.regions_info.getNewRegionsId();

        // trigger generation if we have something to generate/associate with
        if (theDims.length > 0) {
            this.context.publish(
                REGIONS_GENERATE_SHAPES,
                {config_id : this.regions_info.image_info.config_id,
                    shapes : [newShape],
                    number : theDims.length,
                    random : false, theDims : theDims,
                    hist_id : params.hist_id, roi_id: roi_id,
                    propagated: true});
        }
    }

    /**
     * Either sends a notification to start the viewer's drawing interaction OR
     * to abort an active drawing interaction
     *
     * @memberof RegionsDrawing
     * @param {number} index the index matching an entry in the supported_shapes array
     */
    onDrawShape(index) {
        let new_shape_type = this.supported_shapes[index];
        let abort = false;

        // if the shape to be drawn is already active =>
        // abort the drawing, otherwise choose new shape type
        if (this.shape_to_be_drawn &&
            this.shape_to_be_drawn === new_shape_type) {
            abort = true;
            this.shape_to_be_drawn = null;
        } else this.shape_to_be_drawn = new_shape_type;

        // send drawing notification to ol3 viewer
        this.context.publish(
           REGIONS_DRAW_SHAPE, {
               config_id: this.regions_info.image_info.config_id,
               shape : this.shape_to_be_drawn, abort: abort,
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

         this.shape_to_be_drawn = null;
         // send drawing abort notification to ol3 viewer
         this.context.publish(
            REGIONS_DRAW_SHAPE, {config_id: params.config_id, abort: true});
     }

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
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
    }
}
