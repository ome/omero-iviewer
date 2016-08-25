// css
require('../css/ol3-viewer.css');

// dependencies
import Context from '../app/context';
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {inject, customElement, bindable} from 'aurelia-framework';
import {ol3} from '../../libs/ome-viewer-1.0.js';
import {
    IMAGE_CONFIG_UPDATE, IMAGE_VIEWER_RESIZE, IMAGE_VIEWER_SCALEBAR,
    IMAGE_DIMENSION_CHANGE, IMAGE_MODEL_CHANGE, IMAGE_CHANNEL_RANGE_CHANGE,
    IMAGE_REGIONS_VISIBILITY,
    EventSubscriber
} from '../events/events';


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
        [IMAGE_MODEL_CHANGE,
            (params={}) => this.changeModelProjectionOrRange(params)],
        [IMAGE_CHANNEL_RANGE_CHANGE,
            (params={}) => this.changeModelProjectionOrRange(params)],
        [IMAGE_REGIONS_VISIBILITY,
            (params={}) => this.changeRegionsVisibility(params)]];

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

        // instantiate the viewer
        this.viewer =
            new ol3.Viewer(this.image_config.image_info.image_id,
                { eventbus : this.context.eventbus,
                  server : this.context.server,
                  container: this.container
                });

        // subscribe
        this.subscribe();
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
        if (this.viewer) this.viewer.destroyViewer();
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
        this.viewer.redraw();
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
    changeModelProjectionOrRange(params = {}) {
        // we ignore notifications that don't concern us
        // and don't have the model param
        if (params.config_id !== this.config_id ||
            (typeof params.model !== 'string' &&
                typeof params.projection !== 'string' &&
                !Misc.isArray(params.ranges))) return;

        if (typeof params.model === 'string')
            this.viewer.changeImageModel(params.model);
        else if (typeof params.projection === 'string')
            this.viewer.changeImageProjection(params.projection);
        else if (Misc.isArray(params.ranges))
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

        // init viewer with 'new' dimension settings
        let presentZ = this.viewer.getDimensionIndex('z');
        let presentT = this.viewer.getDimensionIndex('t');
        let newZ = this.image_config.image_info.dimensions.z;
        let newT = this.image_config.image_info.dimensions.t;

        if (presentZ !== newZ)
            this.viewer.setDimensionIndex.apply(
                this.viewer, ['z'].concat([newZ]));

        if (presentT !== newT)
            this.viewer.setDimensionIndex.apply(
                this.viewer, ['t'].concat([newT]))

        // init viewer with 'new' channel settings
        let presentChannels = this.viewer.getDimensionIndex('c');
        let newCs = this.image_config.image_info.getActiveChannels();
        if (!Misc.isArray(presentChannels) || !Misc.isArray(newCs)) return;

        // there is a difference for sure
        if (presentChannels.length !== newCs.length) {
            this.viewer.setDimensionIndex.apply(
                this.viewer, ['c'].concat(newCs))
            return;
        }

        for (let nc in newCs) {
            let newCisOldC = false;
            for (let oc in presentChannels)
                if (newCs[nc] === presentChannels[oc]) {
                    newCisOldC = true;
                    break;
                }
            if (!newCisOldC) {
                this.viewer.setDimensionIndex.apply(
                    this.viewer, ['c'].concat(newCs))
                return;
            }
        }
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

        this.viewer.redraw();
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
            this.showRegions(params.visible);
            return;
        }

        // this we do only if our image_config has been addressed specifically
        if (!broadcast)
            this.viewer.setRegionsVisibility(params.visible, params.shapes);
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
            this.viewer.setRegionsModes([ol3.REGIONS_MODE.SELECT]);
            //this.viewer.enableRegionsContextMenu(true);
        } else {
            this.viewer.setRegionsVisibility(false, []);
            this.viewer.setRegionsModes([ol3.REGIONS_MODE.DEFAULT]);
            //this.viewer.enableRegionsContextMenu(false);
        }
    }

    /**
     * Toggles the scalebar status, i.e. shows/hides the scale bar
     *
     * @param {boolean} flag true if we want to show the scalebar, false otherwise
     * @memberof Ol3Viewer
     */
    showScalebar(flag) {
        let delayedCall = function() {
            this.viewer.toggleScaleBar(flag);
        }.bind(this);
        setTimeout(delayedCall, 200);
    }
}
