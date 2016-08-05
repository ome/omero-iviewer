import {noView} from 'aurelia-framework';
import {EVENTS} from '../events/events';
import Misc from '../utils/misc';

/**
 * @classdesc
 *
 * Holds basic image information required for viewing:
 * dimensions, channels, etc.
 */
@noView
export default class ImageInfo {
    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof ImageInfo
     * @type {boolean}
     */
    ready = false;
    /**
     * dimensions are initialized to defaults
     * @memberof ImageInfo
     * @type {Object}
     */
    dimensions = {t: 0, max_t : 1,z: 0, max_z : 1};
    /**
     * @memberof ImageInfo
     * @type {Array.<Object>}
     */
    channels = null;
    /**
     * the associated dataset id
     * @memberof ImageInfo
     * @type {number}
     */
    dataset_id = null;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} config_id the config id we belong to
     * @param {number} image_id the image id to be queried
     */
    constructor(context, config_id, image_id) {
        this.context = context;
        this.config_id = config_id;
        this.image_id = image_id;
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method bind for initialization purposes
     *
     * @memberof ImageInfo
     */
    bind() {
        this.requestData();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof ImageInfo
     */
    unbind() {
        this.dimensions = {t: 0, max_t : 1,z: 0, max_z : 1};
        this.channels = null;
        this.context = null;
    }

    /**
     * Return flag whether we ought to show regions or not
     *
     * @memberof ImageInfo
     * @return {boolean} show the regions or not
     */
    showRegions() {
        return this.context.getImageConfig(this.config_id).show_regions;
    }

    /**
     * Retrieves the data via ajax
     *
     * @memberof ImageInfo
     */
    requestData() {
        let dataType = "json";
        if (Misc.useJsonp(this.context.server)) dataType += "p";

        let url = this.context.server + "/webgateway/imgData/" + this.image_id + '/';

        $.ajax(
            {url : url,
            dataType : dataType,
            cache : false,
            success : (response) => {
                // remember any associated dataset id
                if (typeof response.meta === 'object' &&
                        typeof response.meta.datasetId === 'number')
                    this.dataset_id = response.meta.datasetId;

                // store channels and dimensions
                this.channels = response.channels;
                this.dimensions = {
                    t: 0, max_t : response.size.t,
                    z: 0, max_z : response.size.z
                };

                // signal that we are ready and
                // send out an image config update event
                this.ready = true;
                this.context.publish(
                    EVENTS.IMAGE_CONFIG_UPDATE,
                        {config_id: this.config_id,
                        dataset_id: this.dataset_id,
                        ready: this.ready});
            },
            error : (error) => {
                this.ready = false;
                // send out an image config update event
                // with a no ready flag to (potentially react to)
                this.context.publish(EVENTS.IMAGE_CONFIG_UPDATE,
                    {config_id: this.config_id,
                    dataset_id: this.dataset_id,
                    ready: this.ready});
            }
        });
    }

    getActiveChannels() {
        if (this.channels === null) return null;

        let activeChannels = [];
        for (let i=0;i<this.channels.length;i++)
            if (this.channels[i].active) activeChannels.push(i);

        return activeChannels;
    }
}
