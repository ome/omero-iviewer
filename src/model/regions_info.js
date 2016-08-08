import {noView} from 'aurelia-framework';
import {IMAGE_CONFIG_UPDATE, EventSubscriber} from '../events/events';
import Misc from '../utils/misc';

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
     * @type boolean
     */
    ready = false;
    /**
     * our internal list of shape objects
     * stored in a map and accessible by id
     * @memberof RegionsInfo
     * @type Map
     */
    data = new Map();
    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof RegionsInfo
     * @type Map
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
        this.data.clear();
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

        this.requestData();
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

                 // traverse results and stuff them into the map
                 response.map((item) => {
                     // shapes have to be arrays as well
                     if (Misc.isArray(item.shapes)) {
                          // set shape properties and store the object
                          item.shapes.map((shape) => {
                              shape.shape_id = "" + item.id + ":" + shape.id;
                              this.data.set(
                                  shape.shape_id, Object.assign({}, shape));
                          });
                      }});
                }, error : (error) => this.ready = false
        });
    }
}
