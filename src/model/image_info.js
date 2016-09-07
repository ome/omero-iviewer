import {noView} from 'aurelia-framework';
import {IMAGE_CONFIG_UPDATE} from '../events/events';
import Misc from '../utils/misc';
import {REQUEST_PARAMS} from '../utils/misc'

/**
 * Holds basic image information required for viewing:
 * dimensions, channels, etc.
 */
@noView
export default class ImageInfo {
    /**
     * the associated dataset id
     * @memberof ImageConfig
     * @type {number}
     */
    dataset_id = null;

    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof ImageInfo
     * @type {boolean}
     */
    ready = false;

    /**
     * a flag that signals whether we a pixe_size and hence a scalebar
     * @memberof ImageInfo
     * @type {boolean}
     */
    has_scalebar = false;

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
     * projection defaults to 'normal'
     * @memberof ImageInfo
     * @type {string}
     */
    projection = "normal";

    /**
     * model defaults to 'color'
     * @memberof ImageInfo
     * @type {string}
     */
    model = "color";

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
        return this.context.show_regions;
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
                else this.dataset_id = null;

                // we might have some requested defaults
                let initialTime =
                    this.context.getInitialRequestParam(REQUEST_PARAMS.TIME);
                let initialPlane =
                    this.context.getInitialRequestParam(REQUEST_PARAMS.PLANE);
                let initialProjection =
                    this.context.getInitialRequestParam(REQUEST_PARAMS.PROJECTION);
                let initialModel =
                    this.context.getInitialRequestParam(REQUEST_PARAMS.MODEL);
                let initialChannels =
                    this.context.getInitialRequestParam(REQUEST_PARAMS.CHANNELS);
                initialChannels = Misc.parseChannelParameters(initialChannels);

                // store channels, pixel_range and dimensions
                this.channels =
                    this.mixChannelsWithInitialSettings(
                        response.channels, initialChannels);
                this.range = response.pixel_range;
                this.dimensions = {
                    t: initialTime !== null ?
                        parseInt(initialTime) : response.rdefs.defaultT,
                    max_t : response.size.t,
                    z: initialPlane !== null ?
                        parseInt(initialPlane) : response.rdefs.defaultZ,
                    max_z : response.size.z
                };
                // do we have a scalebar
                if (typeof response.pixel_size === 'object' &&
                    typeof response.pixel_size.x === 'number')
                    this.has_scalebar = true;

                // store projection and model
                this.projection =
                    initialProjection !== null ?
                        initialProjection.toLowerCase() : response.rdefs.projection;
                this.model = initialModel !== null ?
                    initialModel.toLowerCase() : response.rdefs.model;

                // signal that we are ready and
                // send out an image config update event
                this.ready = true;
                if (this.context)
                    this.context.publish(
                        IMAGE_CONFIG_UPDATE,
                            {config_id: this.config_id,
                                dataset_id: this.dataset_id,
                            ready: this.ready});
            },
            error : (error) => {
                this.ready = false;
                // send out an image config update event
                // with a no ready flag to (potentially react to)
                this.context.publish(
                    IMAGE_CONFIG_UPDATE,
                        {config_id: this.config_id,
                         dataset_id: null,
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

    /**
     * If there are initial settings they are integrated into the channel
     * response
     *
     * @memberof ImageInfo
     * @param {Array.<Object>} an array of existing channels (from response)
     * @param {Array.<Object>} an array of initial settings per channel
     * @return {Array.<Object>} an array of mixed-in channel objects
     */
    mixChannelsWithInitialSettings(channels, initialChannels) {
        if (!Misc.isArray(channels) || !Misc.isArray(initialChannels))
            return channels;

        initialChannels.map((c) => {
            if (typeof channels[c.index] === 'object') {
                let chan = channels[c.index];
                chan.active = c.active;
                chan.window.start = c.start;
                chan.window.end = c.end;
                chan.color = c.color;
            }
        });

        return channels;
    }
}
