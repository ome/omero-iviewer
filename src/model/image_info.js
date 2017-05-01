//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

import {noView} from 'aurelia-framework';
import {IMAGE_CONFIG_UPDATE} from '../events/events';
import Misc from '../utils/misc';
import {
    REQUEST_PARAMS, WEBGATEWAY, CHANNEL_SETTINGS_MODE
} from '../utils/constants'

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
     * is the image tiled
     * @memberof ImageInfo
     * @type {boolean}
     */
    tiled = false;

    /**
     * a flag that signals whether the histogram is enabled or not
     * this will be set accordingly by the histogram but due to its
     * more global nature we want the flag here.
     * @memberof ImageInfo
     * @type {boolean}
     */
    has_histogram = false;

    /**
     * the imageAuthor in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    author = null;

    /**
     * the imageName in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    image_name = null;

    /**
     * the acquisition date in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    image_timestamp = null;

    /**
     * the pixels type in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    image_pixels_type = null;

    /** 
     * the pixels size, defaul in macrons
     * @memberof ImageInfo
     */ 
    image_pixels_size = null;

    /**
     * a flag for whether we are allowed to save the settings
     * @memberof ImageInfo
     * @type {boolean}
     */
    can_annotate = false;

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
     * @param {number} dataset_id an optional dataset_id
     */
    constructor(context, config_id, image_id, dataset_id) {
        this.context = context;
        this.config_id = config_id;
        this.image_id = image_id;
        if (typeof dataset_id === 'number') this.dataset_id = dataset_id;
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
        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
                "/imgData/" + this.image_id + '/',
            success : (response) => {
                // read initial request params
                this.initializeImageInfo(response);

                // check for a dataset id
                if (typeof this.dataset_id !== 'number') {
                    if (typeof response.meta === 'object' &&
                            typeof response.meta.datasetId === 'number')
                        this.dataset_id = response.meta.datasetId;
                }

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
                             image_id: this.image_id,
                             dataset_id: this.dataset_id,
                             ready: this.ready
                            });
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
        let initialDatasetId =
            parseInt(
                this.context.getInitialRequestParam(REQUEST_PARAMS.DATASET_ID));
        if (typeof initialDatasetId === 'number' &&
                !isNaN(initialDatasetId) && initialDatasetId >= 0)
            this.dataset_id = initialDatasetId;
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
        let initialMaps =
            this.context.getInitialRequestParam(REQUEST_PARAMS.MAPS);
        initialChannels =
            Misc.parseChannelParameters(initialChannels, initialMaps);

        // store channels, pixel_range and dimensions
        if (typeof response.tiles === 'boolean') this.tiled = response.tiles;
        this.channels =
            this.initAndMixChannelsWithInitialSettings(
                response.channels, initialChannels);
        this.range = response.pixel_range;
        this.dimensions = {
            t: initialTime !== null ?
                (parseInt(initialTime)-1) : response.rdefs.defaultT,
            max_t : response.size.t,
            z: initialPlane !== null ?
                (parseInt(initialPlane)-1) : response.rdefs.defaultZ,
            max_z : response.size.z
        };

        // store projection and model
        this.projection =
            initialProjection !== null ?
                initialProjection.toLowerCase() : response.rdefs.projection;
        this.model = initialModel !== null ?
            initialModel.toLowerCase() : response.rdefs.model;

        // set can annotate and author information
        this.can_annotate = response.perms.canAnnotate;
        if (typeof response.meta.imageAuthor === 'string')
            this.author = response.meta.imageAuthor;
        if (typeof response.meta.imageName === 'string')
            this.image_name = response.meta.imageName;
        if (typeof response.meta.pixelsType === 'string')
            this.image_pixels_type = response.meta.pixelsType;
        this.image_timestamp = response.meta.imageTimestamp;
        this.image_pixels_size = response.pixel_size;
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
        if (lowerCaseProjection !== 'normal' &&
                lowerCaseProjection !== 'intmax' &&
                lowerCaseProjection !== 'split')
            this.projection = 'normal';
    }

    /**
     * Retrieves the copied rendering settings
     *
     * @param {function} callback a callback for success
     * @memberof ImageInfo
     */
    requestImgRDef(callback = null) {
        if (callback === null)
            callback = (rdef) => {
                if (rdef === null || typeof rdef.c !== 'string') return;
                let channels = Misc.parseChannelParameters(rdef.c, rdef.maps);
                // we only allow copy and paste with same number of channels
                // and compatible range
                if (!Misc.isArray(channels) ||
                        channels.length != this.channels.length ||
                        rdef.pixel_range != this.range.join(":"))
                            this.copied_img_rdef = null;
            }
        $.ajax({
            url : this.context.server +
                  this.context.getPrefixedURI(WEBGATEWAY) + "/getImgRDef/",
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    typeof response.rdef !== 'object' ||
                    response.rdef === null)
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

        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
                "/imgData/" + this.image_id + '/?getDefaults=true',
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
     * Performs some more initialization (lut) AND
     * if there are initial settings they are integrated into the channel
     * response
     *
     * @memberof ImageInfo
     * @param {Array.<Object>} channels the existing channels (response)
     * @param {Array.<Object>} initialChannels initial channel settings (request)
     * @return {Array.<Object>} an array of mixed-in channel objects
     */
    initAndMixChannelsWithInitialSettings(channels, initialChannels) {
        if (!Misc.isArray(channels)) return channels;

        // apply lut if exists
        channels.map((c) => {
            if (typeof c.lut  === 'string' && c.lut.length > 0)
                c.color = c.lut;
            if (typeof c.reverseIntensity !== 'boolean')
                c.reverseIntensity = null;
        });

        // mix in initial channel settings if exist
        if (!Misc.isArray(initialChannels)) return channels;
        initialChannels.map((c) => {
            if (typeof channels[c.index] === 'object') {
                let chan = channels[c.index];
                chan.active = c.active;
                chan.window.start = c.start;
                chan.window.end = c.end;
                chan.color = c.color;
                if (typeof c.reverseIntensity === 'boolean')
                    chan.reverseIntensity = c.reverseIntensity;
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
            case CHANNEL_SETTINGS_MODE.IMPORTED:
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
                start_val = this.range[0];
                end_val = this.range[1];
                break;
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
}
