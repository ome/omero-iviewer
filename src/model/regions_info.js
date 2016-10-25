import {noView} from 'aurelia-framework';
import {
    IMAGE_CONFIG_UPDATE, EventSubscriber} from '../events/events';
import Misc from '../utils/misc';
import {REGIONS_MODE} from '../utils/constants';

/**
 * Holds region information
 *
 * @extends {EventSubscriber}
 *
 */
@noView
export default class RegionsInfo extends EventSubscriber {
    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof RegionsInfo
     * @type {boolean}
     */
    ready = false;

    /**
     * our internal list of shape objects
     * stored in a map and accessible by id
     * @memberof RegionsInfo
     * @type {Map}
     */
    data = null;

    /**
     * the presently used regions modes
     * @memberof RegionsInfo
     * @type {Array.<number>}
     */
    present_modes = [REGIONS_MODE.SELECT];

    /**
     * the previously used regions modes
     * @memberof RegionsInfo
     * @type {Array.<number>}
     */
    previous_modes = null;

    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof RegionsInfo
     * @type {Map}
     */
    sub_list = [
        [IMAGE_CONFIG_UPDATE,
            (params={}) => this.handleImageConfigUpdate(params)]];

    /**
     * @constructor
     * @param {ImageInfo} image_info the associated image
     */
    constructor(image_info) {
        super(image_info.context.eventbus);
        this.image_info = image_info;
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method bind for initialization purposes
     *
     * @memberof RegionsInfo
     */
    bind() {
        this.subscribe();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof RegionsInfo
     */
    unbind() {
        this.unsubscribe();
        if (this.data instanceof Map) this.data.clear();
        this.image_info = null;
    }

    /**
     * Reverts to previous regions mode
     *
     * @memberof RegionsInfo
     */
    changeRegionsModes(modes = []) {
        if (!Misc.isArray(modes)) return;
        if (modes.length === 0) modes = [REGIONS_MODE.DEFAULT];

        // store present modes
        this.previous_modes = this.present_modes.slice(0);
        this.present_modes = [];
        modes.map((m) => {
            if (typeof m === 'number' && m >=0 && m <= 4)
                this.present_modes.push(m);
        });
    }

    /**
     * Reverts to previous regions mode
     *
     * @memberof RegionsInfo
     */
    revertRegionsModes() {
        if (!Misc.isArray(this.previous_modes)) return;
        if (this.previous_modes.length === 0)
            this.previous_modes.push(REGIONS_MODE.DEFAULT);

        // go back to previous, swapping with present
        let tmpModes = this.present_modes.slice(0);
        this.present_modes = this.previous_modes.slice(0);
        this.previous_modes = tmpModes;
    }

    /**
     * Handles received image config updates (IMAGE_CONFIG_UPDATE)
     *
     * @memberof RegionsInfo
     * @param {Object} params the event notification parameters
     */
    handleImageConfigUpdate(params = {}) {
        // we ignore notifications that don't concern us
        if (params.config_id !== this.image_info.config_id ||
            !params.ready) return;

        this.requestData(true);
    }

    /**
     * Sets a property for shape(s) according to the new value
     *
     * @memberof RegionsInfo
     * @param {Array.<number>} shapes an array with ids
     * @param {string} property a property on the shape
     * @param {Object|Array|boolean|string|number} value the new value
     */
    setPropertyForShape(shapes, property, value) {
        // we need a non empty array of ids and a proper property name
        // as well as a value that is not undefined
        if (this.data === null || // no regions map is no good either
                !Misc.isArray(shapes) || shapes.length === 0 ||
                typeof property !== 'string' ||
                typeof value === 'undefined') return;

        for (let i in shapes) {
            let s = this.data.get(shapes[i]);
            if (typeof s !== 'object') continue; // couldn't find shape with id
            // the property has to exist
            if (typeof s[property] === 'undefined') continue;
            s[property] = value;
        }
    }

    /**
     * Retrieves the regions information needed via ajax and stores it internally
     *
     * @memberof RegionsInfo
     * @param {boolean} forceUpdate if true we always request up-to-date data
     */
    requestData(forceUpdate = false) {
        if ((this.ready || !this.image_info.showRegions()) &&
                !forceUpdate) return;

        // assmeble url
        let url = this.image_info.context.server + "/webgateway/get_rois_json/" +
         this.image_info.image_id + '/';
        let dataType = "json";
        if (Misc.useJsonp(this.image_info.context.server)) dataType += "p";

        $.ajax(
            {url : url,
            dataType : dataType,
            cache : false,
            success : (response) => {
                // we want an array
                if (!Misc.isArray(response)) return;

                this.data = new Map();
                // traverse results and stuff them into the map
                response.map((item) => {
                     // shapes have to be arrays as well
                     if (Misc.isArray(item.shapes)) {
                          // set shape properties and store the object
                          item.shapes.map((shape) => {
                              let newShape = Object.assign({}, shape);
                              newShape.shape_id = "" + item.id + ":" + shape.id;
                              // we add some flags we are going to need
                              newShape.visible = true;
                              newShape.selected = false;
                              newShape.deleted = false;
                              newShape.modified = false;
                              this.data.set(newShape.shape_id, newShape);
                          });
                      }});
                this.ready = true;
                }, error : (error) => this.ready = false
        });
    }
}
