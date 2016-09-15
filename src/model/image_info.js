import {noView} from 'aurelia-framework';
import {IMAGE_CONFIG_UPDATE} from '../events/events';
import Misc from '../utils/misc';
import {REQUEST_PARAMS, CHANNEL_SETTINGS_MODE} from '../utils/constants'

/**
 * Holds basic image information required for viewing:
 * dimensions, channels, etc.
 */
@noView
export default class ImageInfo {
    /**
     * the associated dataset id
     * @memberof ImageInfo
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
     * a flag for whether we are allowed to save the settings
     * @memberof ImageInfo
     * @type {boolean}
     */
    can_save_settings = false;

    /**
     *  rendering settings as imported
     * @memberof ImageInfo
     * @type {Object}
     */
    imported_settings = null;

    /**
     *  copied rendering settings
     * @memberof ImageInfo
     * @type {Object}
     */
    copied_img_rdef = null;

    /**
     * a flag to remind us if these are the initial binding values
     * which we need because the existing display rules are different then
     * @memberof ImageInfo
     * @type {boolean}
     */
    initial_values = true;

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
     * @memberof ImageInfo
     * @type {Array.<number>}
     */
    range = null;

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
        this.imported_settings = null;
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

                // delegate to break up code
                this.initializeImageInfo(response);

                // fire off the request for the imported data,
                // can't hurt to have handy when we need it
                this.requestImportedData();
                // fetch copied img RDef
                this.requestImgRDef();

                // notify everyone that we are ready
                if (this.context)
                    this.context.publish(
                        IMAGE_CONFIG_UPDATE,
                            {config_id: this.config_id,
                                dataset_id: this.dataset_id,
                            ready: this.ready});
            },
            error : (error) => {
                this.ready = false;
                // we wanted a new image info => remove old
                if (typeof this.config_id === 'number')
                    this.context.removeImageConfig(this.config_id);
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

    /**
     * Takes the response object and assigns the bits and pieces needed
     * to the members
     *
     * @private
     * @param {Object} response the response object
     * @memberof ImageInfo
     */
    initializeImageInfo(response) {
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

        // can Annotate means we are allowed to store
        this.can_save_settings = response.perms.canAnnotate;

        this.sanityCheckInitialValues();

        // signal that we are ready and
        // send out an image config update event
        this.ready = true;
    }

    /**
     * Performs some basic checks for model, dimensions and projection
     * and corrects to reasonable defaults
     *
     * @private
     * @memberof ImageInfo
     */
    sanityCheckInitialValues() {
        if (this.dimensions.t < 0) this.dimensions.t = 0;
        if (this.dimensions.t >= this.dimensions.max_t)
            this.dimensions.t = this.dimensions.max_t-1;
        if (this.dimensions.z < 0) this.dimensions.z = 0;
        if (this.dimensions.z >= this.dimensions.max_z)
            this.dimensions.z = this.dimensions.max_z-1;
        let lowerCaseModel = this.model.toLowerCase()[0];
        switch (lowerCaseModel) {
            case 'c': this.model = 'color'; break;
            case 'g': this.model = 'greyscale'; break;
            default: this.model = 'color';
        }
        let lowerCaseProjection = this.projection.toLowerCase();
        if (lowerCaseProjection !== 'normal' && lowerCaseProjection !== 'intmax')
            this.projection = 'normal';
    }

    /**
     * Retrieves the copied rendering settings
     *
     * @param {function} callback a callback for success
     * @memberof ImageInfo
     */
    requestImgRDef(callback = null) {
        $.ajax({url : this.context.server + "/webgateway/getImgRDef/",
            dataType : Misc.useJsonp(this.context.server) ? 'jsonp' : 'json',
            cache : false,
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    typeof response.rdef !== 'object' ||
                    typeof response.rdef.imageId !== 'number' ||
                    response.rdef.imageId !== this.image_id)
                        this.copied_img_rdef = null;
                else this.copied_img_rdef = response.rdef;
                if (typeof callback === 'function')
                    callback(this.copied_img_rdef);},
            error : () => {
                this.copied_img_rdef = null;
                callback(this.copied_img_rdef);}
        });
    }

    /**
     * Retrieves the original image data as imported via ajax
     *
     * @param {function} callback a callback for success
     * @memberof ImageInfo
     */
    requestImportedData(callback = null) {
        if (this.imported_settings) {
            if (typeof callback === 'function') callback();
            return;
        }

        let dataType = "json";
        if (Misc.useJsonp(this.context.server)) dataType += "p";

        let url = this.context.server + "/webgateway/imgData/" +
         this.image_id + '/?getDefaults=true';

        $.ajax(
            {url : url,
            dataType : dataType,
            cache : false,
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    !Misc.isArray(response.channels) ||
                    typeof response.rdefs !== 'object' ||
                    response.rdefs === null ||
                    typeof response.rdefs.projection !== 'string' ||
                    typeof response.rdefs.model !== 'string') return;

                this.imported_settings = {
                    c : response.channels,
                    t: typeof response.rdefs.defaultT === 'number' ?
                        response.rdefs.defaultT : 0,
                    z: typeof response.rdefs.defaultZ === 'number' ?
                        response.rdefs.defaultZ : 0,
                    p: response.rdefs.projection,
                    m: response.rdefs.model
                }
                if (typeof callback === 'function') callback();
            }
        });
    }

    /**
     * Collects active channels
     *
     * @return {Array.<Object>} the active channel objects in an array
     * @memberof ImageInfo
     */
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

   /**
    * Helper to determine min and max values for start and end based on channel
    * settings mode
    *
    * @param {number} mode the channel setting mode
    * @param {number} index the channel index
    * @return {Object|null} returns object with the respective min,max properties or null
    * @memberof ChannelRange
    */
    getChannelMinMaxValues(mode = 0, index=0) {
        if (typeof mode !== 'number' || mode < 0 || mode > 2 ||
                typeof index !== 'number' || index < 0 ||
                index >= this.channels.length) return null;

        let start_min,start_max,end_min,end_max,start_val,end_val;
        let c = this.channels[index];
        switch(mode) {
            case CHANNEL_SETTINGS_MODE.MIN_MAX:
                start_min = c.window.min;
                start_max = c.window.end-1;
                end_min = c.window.start+1;
                end_max = c.window.max;
                start_val = this.initial_values ?
                    c.window.start : c.window.min;
                end_val = this.initial_values ?
                    c.window.end : c.window.max;
                break;

            case CHANNEL_SETTINGS_MODE.FULL_RANGE:
                start_min = this.range[0];
                start_max = c.window.end-1;
                end_min = c.window.start+1;
                end_max = this.range[1];
                start_val = this.initial_values ?
                     c.window.start : this.range[0];
                end_val =
                    this.initial_values ?
                         c.window.end : this.range[1];
                break;

            case CHANNEL_SETTINGS_MODE.IMPORTED:
            default:
               let ch =
                   this.context.getSelectedImageConfig().image_info.imported_settings.c;
                start_min = ch[index].window.min;
                start_max = ch[index].window.end-1;
                end_min = ch[index].window.start+1;
                end_max = ch[index].window.max;
                start_val = ch[index].window.start;
                end_val = ch[index].window.end;
        }

        return {
            start_min: start_min,
            start_max: start_max,
            end_min: end_min,
            end_max: end_max,
            start_val: start_val,
            end_val: end_val
        }
    }

    /**
     * Helper to determine if the present channel data might need the full range
     * mode to be displayed, i.e. start/end are outsided of min/max
     *
     * @return {Object|null} returns object with the respective min,max properties or null
     * @memberof ChannelRange
     */
    needsFullRange() {
        let ret = false;

        this.channels.map((c) => {
            if (c.window.start < c.window.min || c.window.end > c.window.max)
                ret = true;});

        return ret;
    }
}
