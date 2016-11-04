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
     * a helper array to avoid data iteration. holds ids of selsected shapes
     * @memberof RegionsInfo
     * @type {Array.<string>}
     */
    selected_shapes = [];

    /**
     * the json of the copied shapes
     * (which uses also local storage -if supported)
     * @memberof RegionsInfo
     * @type {Array.<objects>}
     */
    copied_shapes = null;

    /**
     * the presently used regions modes
     * @memberof RegionsInfo
     * @type {Array.<number>}
     */
    regions_modes = [REGIONS_MODE.SELECT, REGIONS_MODE.TRANSLATE];

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

        // try to restore localstorage copied shapes
        try {
            this.copied_shapes =
                JSON.parse(
                    window.localStorage.getItem("viewer-ng.copied_shapes"));
        } catch(ignored) {}
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
     * @param {string} id a shape id in format roi:shape-id
     * @param {string} property a property on the shape
     * @param {Object|Array|boolean|string|number} value the new value
     */
    setPropertyForShape(id, property, value) {
        // we need an id and a proper property name, as well as a value
        if (this.data === null || // no regions map is no good either
                typeof id !== 'string' ||
                typeof property !== 'string' ||
                typeof value === 'undefined') return;

        // if we do not find a matching shape for the id => bye
        let shape = this.data.get(id);
        if (typeof shape !== 'object') return;

        // if the shape shape has a property of that given name
        // set its new value
        if (typeof shape[property] !== 'undefined') shape[property] = value;
        // modify the selected set for actions that influence it
        if (property === 'selected' && value) this.selected_shapes.push(id);
        else if ((property === 'selected' && !value) ||
                    (property === 'deleted' && value)) {
            let i = this.selected_shapes.indexOf(id);
            if (i !== -1) this.selected_shapes.splice(i, 1);
        }
        // for deleted shapes that were new, we remove them instantly
        if (property === 'deleted' && value &&
                typeof shape.is_new !== 'undefined') this.data.delete(id);
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

    /**
     * A very simple filtering based on properties and their
     * supposed, corresponding values using an implicit logical AND to chain them
     * If a pre-selected id list is supplied
     * only shapes within that list are considered
     * If no params are given all ids are returned
     *
     * @memberof RegionsInfo
     * @param {Array.<string>} properties an array of property names
     * @param {number|string|Array|boolean|Object} values the values to filter for
     * @param {Array.<ids>|null} an optional array of ids of the form: roi:shape-id
     * @return {Array.<ids>} an array of ids for shapes that satisfy the filter
     */
    unsophisticatedShapeFilter(properties=[], values=[], ids=null) {
        let ret = [];
        if (!Misc.isArray(properties) || !Misc.isArray(values) ||
                properties.length !== values.length) return ret;

        let filter = (value) => {
            for (let i=0;i<properties.length;i++) {
                if (typeof value[properties[i]] === 'undefined') continue;
                if (value[properties[i]] !== values[i]) return false;
            }
            return true;
        };

        let hasIdsForFilter = Misc.isArray(ids);
        // iterate over all shapes
        this.data.forEach(
            (value, key) => {
                if (hasIdsForFilter && ids.indexOf(key) !== -1 && filter(value))
                    ret.push(key);
                else if (!hasIdsForFilter && filter(value)) ret.push(key);
        });

        return ret;
    }

}
