// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';
import Misc from '../utils/misc';
import {Converters} from '../utils/converters';
import { REGIONS_MODE, REGIONS_DRAWING_MODE} from '../utils/constants';
import {REGIONS_DRAW_SHAPE, REGIONS_SHAPE_GENERATED, REGIONS_GENERATE_SHAPES,
        EventSubscriber} from '../events/events';

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
             (params={}) => this.onShapeDrawn(params)]];

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

        this.shape_to_be_drawn = null;

        let newShape = null;
        if (Misc.isArray(params.shapes))
            params.shapes.map(
                (shape) => {
                    newShape =
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
                    }
                });

        // we only continue if we have been drawn and intend to propagate
        // (i.e. drawing mode other that z and t viewed)
        // these checks are vital otherwise we risk a chain reaction
        if (typeof params.drawn !== 'boolean') params.drawn = false;
        if (!params.drawn || this.regions_info.drawing_mode ===
            REGIONS_DRAWING_MODE.Z_AND_T_VIEWED) return;

        // establish what z/ts we use based on the drawing mode,
        // then form the union minus the present z/t already drawn
        let theDims = [];
        let m = this.regions_info.drawing_mode;
        let useZs = m === REGIONS_DRAWING_MODE.SELECTED_Z_AND_T ?
                this.regions_info.drawing_dims.z : [];
        let useTs = m === REGIONS_DRAWING_MODE.SELECTED_Z_AND_T ?
                this.regions_info.drawing_dims.t : [];
        // for drawing modes where we don't have custom selections
        if (m !== REGIONS_DRAWING_MODE.SELECTED_Z_AND_T) {
            let maxZ = this.regions_info.image_info.dimensions.max_z;
            let maxT = this.regions_info.image_info.dimensions.max_t;
            let allZs = Array.from(Array(maxZ).keys());
            let allTs = Array.from(Array(maxT).keys());
            ['z', 't'].map(
                (d) => {
                    if (d === 'z' &&
                        (m === REGIONS_DRAWING_MODE.ALL_Z ||
                         m === REGIONS_DRAWING_MODE.ALL_Z_AND_T))
                            useZs = allZs;
                    if (d === 't' &&
                        (m === REGIONS_DRAWING_MODE.ALL_T ||
                         m === REGIONS_DRAWING_MODE.ALL_Z_AND_T))
                            useTs = allTs;});
        }
        // last but not least, if we have an empty array in one dimension
        // we will use the present value for that from the new shape already
        // drawn
        // i.e. all z means for present t
        if (useZs.length === 0) useZs.push(newShape.theZ);
        if (useTs.length === 0) useTs.push(newShape.theT);
        // now finally union them ommitting the present z/t of the new shape
        for (let i=0;i<useZs.length;i++)
            for (let j=0;j<useTs.length;j++) {
                let zIndex = useZs[i];
                let tIndex = useTs[j];
                if (zIndex === newShape.theZ && tIndex === newShape.theT)
                    continue;
                theDims.push({"z" : zIndex, "t": tIndex});
            }

        // finally send event to trigger generation if we have something to
        // generate/associate with
        if (theDims.length > 0)
            this.context.publish(
                REGIONS_GENERATE_SHAPES,
                {config_id : this.regions_info.image_info.config_id,
                    shapes : [newShape],
                    number : theDims.length,
                    random : false, theDims : theDims});
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
               shape : this.shape_to_be_drawn, abort: abort});
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
