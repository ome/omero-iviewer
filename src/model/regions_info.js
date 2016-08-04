import {noView} from 'aurelia-framework';
import {EVENTS, EventSubscriber} from '../events/events';
import Misc from '../utils/misc';

/**
 * @classdesc
 * Holds region information
 *
 * @extends EventSubscriber
 *
 */
@noView
export default class RegionsInfo extends EventSubscriber {
    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof Context
     * @type boolean
     */
    ready = false;
    /**
     * our internal list of shape objects
     * stored in a map and accessible by id
     * @memberof Context
     * @type Map
     */
    data = new Map();
    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof Context
     * @type Map
     */
    sub_list = [
        [EVENTS.IMAGE_CONFIG_UPDATE,
            (params={}) => {
                if (params.config_id !== this.image_info.config_id) return;
                this.handleImageConfigUpdate(params.ready)}]
        ];

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
     * @memberof Context
     */
    bind() {
        this.subscribe();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof Context
     */
    unbind() {
        this.unsubscribe();
        this.data.clear();
        this.image_info = null;
    }

    /**
     * Handles received image config updates: EVENTS.IMAGE_CONFIG_UPDATE
     *
     * @memberof Context
     * @param {boolean} ready flag if the image info is ready
     */
    handleImageConfigUpdate(ready = false) {
        if (!ready) return;

        this.requestData();
    }

    /**
     * Retrieves the regions information needed via ajax and stores it internally
     *
     * @memberof Context
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
                if (typeof response !== 'object' ||
                 typeof response.length !== 'number') return;

                 // traverse results and stuff them into the map
                 response.map((item) => {
                     // shapes have to be arrays as well
                     if (typeof item.shapes === 'object' &&
                      typeof item.shapes.length === 'number') {
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
