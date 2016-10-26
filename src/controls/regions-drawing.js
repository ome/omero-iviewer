// js
import Context from '../app/context';
import {inject, customElement, bindable} from 'aurelia-framework';
import Misc from '../utils/misc';
import { REGIONS_MODE} from '../utils/constants';
import {REGIONS_DRAW_SHAPE, REGIONS_SHAPE_DRAWN,
        EventSubscriber} from '../events/events';

/**
 * Represents the regions drawing palette in the right hand panel
 */
@customElement('regions-drawing')
@inject(Context)
export default class RegionsDrawing extends EventSubscriber {
    /**
     * a reference to the image config
     * @memberof RegionsDrawing
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /**
     * a reference to the image config
     * @memberof RegionsDrawing
     * @type {RegionsInfo}
     */
    supported_shapes = [
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
        [REGIONS_SHAPE_DRAWN,
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

        if (Misc.isArray(params.shapes))
            params.shapes.map(
                (shape) => {
                    let newShape = Object.assign({}, shape);
                    // what we receive is omero marshal compatible json
                    // we need to fill in some webgateway compatible bits
                    newShape.shape_id = shape.oldId;
                    newShape.id =
                        parseInt(
                            newShape.shape_id.substring(
                                newShape.shape_id.indexOf(":") + 1));
                    let typePos = shape['@type'].lastIndexOf("#");
                    if (typePos === -1) return; // type is needed
                    newShape.type =
                        shape['@type'].substring(typePos+1).toLowerCase();
                    if (shape.Text) newShape.textValue = shape.Text;
                    newShape.theT = shape.TheT;
                    newShape.theZ = shape.TheZ;
                    // we also want these flags
                    newShape.visible = true;
                    newShape.selected = false;
                    newShape.deleted = false;
                    newShape.modified = false;
                    this.regions_info.data.set(newShape.shape_id, newShape);
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
