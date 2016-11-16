// css
require('../css/ol3-viewer.css');

// dependencies
import Context from '../app/context';
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {inject, customElement, bindable} from 'aurelia-framework';
import {ol3} from '../../libs/ol3-viewer-1.0.js';
import {
    IMAGE_CONFIG_UPDATE, IMAGE_VIEWER_RESIZE, IMAGE_VIEWER_SCALEBAR,
    IMAGE_DIMENSION_CHANGE, IMAGE_SETTINGS_CHANGE,
    REGIONS_SET_PROPERTY, REGIONS_PROPERTY_CHANGED,
    VIEWER_IMAGE_SETTINGS, IMAGE_VIEWER_SPLIT_VIEW,
    REGIONS_DRAW_SHAPE, REGIONS_CHANGE_MODES, REGIONS_SHOW_COMMENTS,
    REGIONS_GENERATE_SHAPES, REGIONS_STORED_SHAPES, REGIONS_STORE_SHAPES,
    REGIONS_MODIFY_SHAPES, EventSubscriber }
from '../events/events';


/**
 * The openlayers 3 viewer wrapped for better aurelia integration
 * @extends {EventSubscriber}
 */

@customElement('ol3-viewer')
@inject(Context, Element)
export default class Ol3Viewer extends EventSubscriber {
    /**
     * which image config do we belong to (bound via template)
     * @memberof Ol3Viewer
     * @type {number}
     */
    @bindable config_id=null;

    /**
     * the image config reference to work with
     * @memberof Ol3Viewer
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * events we subscribe to
     * @memberof Ol3Viewer
     * @type {Array.<string,function>}
     */
    sub_list = [
        [IMAGE_CONFIG_UPDATE,
             (params={}) => this.updateViewer(params)],
        [IMAGE_VIEWER_RESIZE,
            (params={}) => this.resizeViewer(params)],
        [IMAGE_VIEWER_SCALEBAR,
            (params={}) => this.showScalebar(params.visible)],
        [IMAGE_DIMENSION_CHANGE,
            (params={}) => this.changeDimension(params)],
        [IMAGE_SETTINGS_CHANGE,
            (params={}) => this.changeImageSettings(params)],
        [REGIONS_PROPERTY_CHANGED,
            (params={}) => this.getRegionsPropertyChange(params)],
        [REGIONS_SET_PROPERTY,
            (params={}) => this.setRegionsProperty(params)],
        [VIEWER_IMAGE_SETTINGS,
            (params={}) => this.getImageSettings(params)],
        [IMAGE_VIEWER_SPLIT_VIEW,
            (params={}) => this.toggleSplitChannels(params)],
        [REGIONS_CHANGE_MODES,
            (params={}) => this.changeRegionsModes(params)],
        [REGIONS_DRAW_SHAPE,
            (params={}) => this.drawShape(params)],
        [REGIONS_GENERATE_SHAPES,
            (params={}) => this.generateShapes(params)],
        [REGIONS_STORE_SHAPES,
            (params={}) => this.storeShapes(params)],
        [REGIONS_STORED_SHAPES,
            (params={}) => this.afterShapeStorage(params)],
        [REGIONS_MODIFY_SHAPES,
            (params={}) => this.modifyShapes(params)],
        [REGIONS_SHOW_COMMENTS,
            (params={}) => this.showComments(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     */
    constructor(context, element) {
        super(context.eventbus)
        this.context = context;
        this.element = element;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Ol3Viewer
     */
    attached() {
        // register resize and collapse handlers
        Ui.registerSidePanelHandlers(this.context.eventbus);

        // instantiate the viewer
        this.viewer =
            new ol3.Viewer(this.image_config.image_info.image_id,
                { eventbus : this.context.eventbus,
                  server : this.context.server,
                  initParams :  this.context.initParams,
                  container: this.container
                });
        // subscribe
        this.subscribe();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Ol3Viewer
     */
    bind() {
        // we 'tag' the element to belong to a certain image config
        this.element.parentNode.id = this.config_id;
        // define the container element
        this.container = 'ol3_viewer_' + this.config_id;
        // we associate the image config with the present config id
        this.image_config = this.context.getImageConfig(this.config_id);
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof Ol3Viewer
     */
    detached() {
        if (this.viewer) this.viewer.destroyViewer();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Ol3Viewer
     */
    unbind() {
        this.unsubscribe();
        this.viewer = null;
        this.image_config = null;
    }

    /**
     * Handles viewer updates as a result of image config changes
     * (event notification)
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    updateViewer(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id) return;

        this.initViewer();
        this.resizeViewer({window_resize: true});
    }

    /**
     * Handles dimension changes which come in the form of an event notification
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    changeDimension(params = {}) {
        // we ignore notifications that don't concern us
        // and need a dim identifier as well an array value
        if (params.config_id !== this.config_id ||
            typeof params.dim !== 'string' ||
            !Misc.isArray(params.value)) return;

        this.viewer.setDimensionIndex.apply(
            this.viewer, [params.dim].concat(params.value));
    }

    /**
     * Handles image model changes (color/grayscale), projection changes
     * and channel range changes (start,end,color)
     * which come in the form of an event notification
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    changeImageSettings(params = {}) {
        // we ignore notifications that don't concern us
        // and don't have the model param
        if (params.config_id !== this.config_id ||
            (typeof params.model !== 'string' &&
                typeof params.projection !== 'string' &&
                !Misc.isArray(params.ranges))) return;

        if (typeof params.model === 'string')
            this.viewer.changeImageModel(params.model);
        if (typeof params.projection === 'string')
            this.viewer.changeImageProjection(params.projection);
        if (Misc.isArray(params.ranges))
            this.viewer.changeChannelRange(params.ranges);
    }

    /**
     * Initializes the viewer to have the actual dimensions and channels
     *
     * @memberof Ol3Viewer
     */
    initViewer()  {
        // should we display the scale bar
        this.showScalebar(this.context.show_scalebar);
        // whould we display regions...
        this.showRegions(this.context.show_regions);

        // only the first request should be affected
        this.context.initParams = {};
    }

    /**
     * In case of a resize we are forced to issue a redraw for the ol3 Viewer
     * which is especially important for the regions layer
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    resizeViewer(params={}) {
        if (this.viewer === null) return;

        // check if we are way to small, then we collapse...
        if (typeof params.window_resize === 'boolean' &&
                params.window_resize)
                Ui.adjustSideBarsOnWindowResize();
        this.viewer.redraw();
    }

    /**
     * Handles regions property changes received from the ol3 viewer,e.g.
     * selection, modification, deletetion
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
     getRegionsPropertyChange(params = {}) {
         // the shapes has to be an array.
         // if the properties and values are an array they have to be in a 1:1
         // relationship to the shapes, otherwise they have to be a simple string
         // or at least not undefined in which case one property/value respectively
         // belongs to multiple shapes
         if (typeof params !== 'object' ||
            !Misc.isArray(params.shapes) || params.shapes.length === 0 ||
            (!Misc.isArray(params.properties) && typeof params.properties !== 'string') ||
            (Misc.isArray(params.properties) && params.properties.length !== params.shapes.length) ||
            (!Misc.isArray(params.values) && typeof params.values === 'undefined') ||
            (Misc.isArray(params.values) && params.values.length !== params.shapes.length)) return;

            // loop over all shapes, trying to set the property
            for (let i in params.shapes) {
                let shape = params.shapes[i];
                let prop = Misc.isArray(params.properties) ?
                                params.properties[i] : params.properties;
                let value = Misc.isArray(params.values) ?
                                params.values[i] : params.values;
                if (prop === 'selected' || prop === 'modified' ||
                        prop === 'deleted')
                    this.image_config.regions_info.setPropertyForShape(
                        shape, prop, value);
                if (typeof params.callback === 'function')
                    params.callback(
                        this.image_config.regions_info.data.get(shape));
            }
     }

    /**
     * Handles regions property changes such as visibility and selection
     * by delegation to sub handlers
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
     setRegionsProperty(params = {}) {
         // at a minimum we need params with the property it concers
         if (typeof params !== 'object' ||
            typeof params.property !== 'string') return

        // delegate to individual handler
        let prop = params.property.toLowerCase();
        if (prop === 'visible')
            this.changeRegionsVisibility(params);
        else if (prop === 'selected')
            this.changeShapeSelection(params);
        else if (prop === 'state')
            this.deleteShapes(params);
     }

     /**
      * Generates shape for both, pasting and propagation
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      generateShapes(params = {}) {
          //we want only notifications that concern us
          // and need at least one shape definition in an array
          if (params.config_id !== this.config_id ||
              !Misc.isArray(params.shapes) || params.shapes.length === 0) return;

          let extent = this.viewer.getSmallestViewExtent();
          if (typeof params.random !== 'boolean') params.random = false;
          if (typeof params.number !== 'number') params.number = 1;
          let theDims =
            Misc.isArray(params.theDims) && params.theDims.length !== 0 ?
                params.theDims : null;

          params.shapes.map(
              (def) => {
                  try {
                      this.viewer.generateShapes(
                          Object.assign({},def),
                          params.number, params.random, extent, theDims);
                  } catch(ignored) {}});
      }

     /**
      * Changes the deleted state of shapes
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      deleteShapes(params = {}) {
          //we want only notifications that concern us
          // and need at least one shape id in the array as well as a value
          // for the action, either delete or undo
          if (params.config_id !== this.config_id ||
              typeof params.value !== 'string' ||
              !Misc.isArray(params.shapes) || params.shapes.length === 0) return;

          if (params.value === 'delete')
             this.viewer.deleteShapes(params.shapes);
          else if (params.value === 'undo')
            this.viewer.deleteShapes(params.shapes, true);
      }

     /**
      * Changes the selected state of shapes
      * by delegation to sub handlers
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      changeShapeSelection(params = {}) {
          //we want only notifications that concern us
          // and need at least one shape id in the array
          if (params.config_id !== this.config_id ||
            !Misc.isArray(params.shapes) || params.shapes.length === 0) return;

        let delay = 0;
        if (params.clear) {
            // switch to plane/time where the shape is
            let viewerT = this.viewer.getDimensionIndex('t');
            let viewerZ = this.viewer.getDimensionIndex('z');
            let shape =
                this.image_config.regions_info.data.get(params.shapes[0]);
            let shapeT = typeof shape.theT === 'number' ? shape.theT : -1;
            if (shapeT !== -1 && shapeT !== viewerT) {
                this.image_config.image_info.dimensions.t = shapeT;
                delay += 25;
            }
            let shapeZ = typeof shape.theZ === 'number' ? shape.theZ : -1;
            if (shapeZ !== -1 && shapeZ !== viewerZ) {
                this.image_config.image_info.dimensions.z = shapeZ;
                delay += 25;
            }
        }

        setTimeout(() =>
            this.viewer.selectShapes(
                params.shapes, params.value,
                params.clear, params.center), delay);
      }

    /**
     * Handles Regions layer and shape visibility following event notification
     * delegating to showRegions for layer visibility
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
    changeRegionsVisibility(params = {}) {
        let broadcast = typeof params.config_id !== 'number';
        // we ignore notifications that don't concern us
        if (!broadcast && params.config_id !== this.config_id) return;

        // delegate to show regions,
        // this is not about individual shapes
        if (!Misc.isArray(params.shapes) || params.shapes.length === 0) {
            this.showRegions(params.value);
            return;
        }

        // this we do only if our image_config has been addressed specifically
        if (!broadcast)
            this.viewer.setRegionsVisibility(params.value, params.shapes);
    }

    /**
     * Queries the present image settings of the viewer
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
    getImageSettings(params = {}) {
        // we ignore notifications that don't concern us
        if (params.config_id !== this.config_id ||
            typeof params.callback !== 'function') return;

        params.callback(this.viewer.captureViewParameters());
        this.viewer.redraw();
    }

    /**
     * Changes the regions modes
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
    changeRegionsModes(params={}) {
        // we don't do this if it does not concern us
        // or we don't have the right params
        if (params.config_id !== this.config_id ||
                typeof params !== 'object' ||
                !Misc.isArray(params.modes)) return;

        this.image_config.regions_info.regions_modes =
            this.viewer.setRegionsModes(params.modes);

    }

    /**
     * Toggles show_regions adding/showing the regions layer or hidding it
     *
     * @param {boolean} flag true if we want to show regions, false otherwise
     * @memberof Ol3Viewer
     */
    showRegions(flag) {
        if (flag) {
            this.viewer.addRegions();
            // in case we are not visible and have no context menu enabled
            this.viewer.setRegionsVisibility(true, []);
            this.changeRegionsModes(
                { modes: this.image_config.regions_info.regions_modes});
        } else this.viewer.setRegionsVisibility(false, []);
    }

    /**
     * Toggles the scalebar status, i.e. shows/hides the scale bar
     *
     * @param {boolean} flag true if we want to show the scalebar, false otherwise
     * @memberof Ol3Viewer
     */
    showScalebar(flag) {
        let delayedCall = function() {
            if (this.viewer) this.viewer.toggleScaleBar(flag);
        }.bind(this);
        setTimeout(delayedCall, 200);
    }

    /**
     * Handles view changes between split and normal view (event notification)
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    toggleSplitChannels(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id ||
                typeof params.split !== 'boolean') return;

        this.viewer.toggleSplitView(params.split);
    }

    /**
     * Handles drawing of shapes via event notification as well as cancellation
     * of a chosen drawing interaction
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    drawShape(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id) return;

        // we want to only abort
        if (typeof params.abort === 'boolean' && params.abort) {
            this.viewer.abortDrawing();
            return;
        }

        // let's draw
        this.viewer.drawShape(params.shape);
    }

    /**
     * Stores shapes
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    storeShapes(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id) return;

        // should we only persist the selected ones
        let selectedOnly =
            typeof params.selected === 'boolean' && params.selected;

        this.viewer.storeRegions(
            selectedOnly, true, '/viewer-ng/persist_rois');
    }

    /**
     * Modifies shape definition
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    modifyShapes(params = {}) {
        // the event doesn't concern us
        // or does not have all the params required
        if (params.config_id !== this.config_id ||
            !Misc.isArray(params.shapes) || params.shapes.length === 0 ||
            typeof params.definition !== 'object' || params.definition === null)
                return;

        this.viewer.modifyRegionsStyle(
            params.definition, params.shapes.slice(),
                typeof params.callback === 'function' ? params.callback : null);
    }

    /**
     * Handling of 'synchronization' after storage
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    afterShapeStorage(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id ||
                typeof params.shapes !== 'object' ||
                params.shapes === null) return;

        // make deep copy to work with
        let ids = Object.assign({}, params.shapes);
        params.shapes = null;
        // we iterate over the ids given and reset states accordingly
        for (let id in ids) {
            let shape = this.image_config.regions_info.data.get(id);
            if (shape) {
                // we reset modifed
                shape.modified = false;
                // new ones are stored under their newly created ids
                if (typeof shape.is_new === 'boolean') {
                    delete shape['is_new'];
                    let newShape = Object.assign({}, shape);
                    newShape.shape_id = ids[id];
                    newShape.id =
                      parseInt(newShape.shape_id.substring(
                                newShape.shape_id.indexOf(":") + 1));
                    this.image_config.regions_info.data.set(
                        newShape.shape_id, newShape);
                    shape.deleted = true; // take out old entry
                }
                // we remove deleted
                if (shape.deleted)
                    this.image_config.regions_info.data.delete(id);
            }
        }
        // reload shapes async
        this.image_config.regions_info.requestData(true);
    }

    /**
     * Shows/hides comments on shapes
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    showComments(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.config_id) return;

        this.viewer.showShapeComments(params.value);
    }
}
