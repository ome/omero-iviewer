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
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {
    APP_TITLE, CHANNEL_SETTINGS_MODE, INITIAL_TYPES, IVIEWER,
    PROJECTION, REQUEST_PARAMS, WEBGATEWAY
} from '../utils/constants';
import { IMAGE_SETTINGS_REFRESH } from '../events/events';

/**
 * Holds basic image information required for viewing:
 * dimensions, channels, etc.
 */
@noView
export default class ImageInfo {
    /**
     * the image id
     * @memberof ImageInfo
     * @type {number}
     */
    image_id = null;

    /**
     * the associated parent id (dataset or well)
     * @memberof ImageInfo
     * @type {number}
     */
    parent_id = null;

    /**
     * the associated parent type (dataset or well)
     * @memberof ImageInfo
     * @type {number}
     */
    parent_type = INITIAL_TYPES.NONE;

    /**
     * the associated dataset name
     * @memberof ImageInfo
     * @type {string}
     */
    dataset_name = null;

    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof ImageInfo
     * @type {boolean}
     */
    ready = false;

    /**
     * a flag whether we want to refresh the image settings only
     * @memberof ImageInfo
     * @type {boolean}
     */
    refresh = false;

    /**
     * a flag to mark that the backend request failed
     * @memberof ImageInfo
     * @type {boolean}
     */
    error = false;

    /**
     * is the image tiled
     * @memberof ImageInfo
     * @type {boolean}
     */
    tiled = false;

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
     * shorter version of the image name
     * @memberof ImageInfo
     * @type {String}
     */
     short_image_name = ""

    /**
     * the acquisition date in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    acquisition_date = null;

    /**
     * the import date in the json response
     * @memberof ImageInfo
     * @type {string}
     */
    import_date = null;

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
     * the delta t
     * @type {Array.<number>}
     * @memberof ImageInfo
     */
    image_delta_t = [];

    /**
     * the delta t unit. default is seconds
     * @type {string}
     * @memberof ImageInfo
     */
    image_delta_t_unit = "s";

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
     * the available families
     * @memberof ImageInfo
     * @type {Array.<string>}
     */
    families = [];

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
     * the roi count
     * @memberof ImageInfo
     * @type {number}
     */
    roi_count = 0;

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
    projection = PROJECTION.NORMAL;

    /**
     * the projection options (start/end)
     * @memberof ImageInfo
     * @type {Object}
     */
    projection_opts = {
        start: 0,
        end: 0
    }

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
     * @param {number} parent_id an optional parent id
     * @param {number} parent_type an optional parent type (e.g. dataset or well)
     */
    constructor(context, config_id, image_id, parent_id, parent_type) {
        this.context = context;
        this.config_id = config_id;
        this.image_id = image_id;
        if (typeof parent_id === 'number') {
            this.parent_id = parent_id;
            if (typeof parent_type === 'number' &&
                parent_type >= INITIAL_TYPES.NONE &&
                parent_type <= INITIAL_TYPES.WELL)
                    this.parent_type = parent_type;
        }
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
     * Retrieves the data via ajax
     *
     * @param {boolean} refresh if true we don't run a full initialization
     * @memberof ImageInfo
     */
    requestData(refresh) {
        if (typeof refresh !== 'boolean') refresh = false;
        this.ready = false;

        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(IVIEWER) +
                "/image_data/" + this.image_id + '/',
            success : (response) => {
                // read initial request params
                this.initializeImageInfo(response, refresh);

                // check for a parent id (if not well)
                if (this.context.initial_type !== INITIAL_TYPES.WELL &&
                    typeof this.parent_id !== 'number') {
                    if (typeof response.meta === 'object' &&
                            typeof response.meta.datasetId === 'number')
                        this.parent_id = response.meta.datasetId;
                }

                // fetch copied img RDef
                this.requestImgRDef();
                // request regions data if rois tab showing
                let conf = this.context.getImageConfig(this.config_id);
                if (this.context.isRoisTabActive())
                    conf.regions_info.requestData();
            },
            error : (error) => {
                this.ready = false;
                this.error = true;
                if (typeof error.responseText === 'string')
                    console.error(error.responseText);
                // we wanted a new image info => remove old
                if (typeof this.config_id === 'number')
                    this.context.removeImageConfig(this.config_id);
                // show message in case of error
                let errMsg =
                    error.status === 404 ?
                        "Image not found" : "Failed to get image data";
                Ui.showModalMessage(errMsg, 'OK');
            }
        });
    }

    /**
     * Takes the response object and assigns the bits and pieces needed
     * to the members
     *
     * @private
     * @param {Object} response the response object
     * @param {boolean} refresh if true we don't run a full initialization
     * @memberof ImageInfo
     */
    initializeImageInfo(response, refresh = false) {
        // integrate initial settings with respone values
        this.integrateInitialSettings(response, refresh);

        // assign rest of response to class members
        this.range = response.pixel_range;
        this.image_pixels_size = response.pixel_size;
        this.can_annotate = response.perms.canAnnotate;
        if (typeof response.meta.wellId === 'number') {
            this.parent_id = response.meta.wellId;
            this.parent_type = INITIAL_TYPES.WELL;
        }
        if (typeof response.meta.imageAuthor === 'string')
            this.author = response.meta.imageAuthor;
        if (typeof response.meta.imageName === 'string') {
            this.image_name = response.meta.imageName;
            let fullPath = this.image_name.replace("\\", "/");
            let fields = fullPath.split("/");
            if (fields.length > 0)
                this.short_image_name = fields[fields.length-1];
        }
        if (typeof response.meta.pixelsType === 'string')
            this.image_pixels_type = response.meta.pixelsType;
        this.import_date = response.import_date;
        if (typeof response.acquisition_date === 'string')
            this.acquisition_date = response.acquisition_date;
        this.setFormattedDeltaT(response);
        this.roi_count = response.roi_count;
        if (typeof response.meta.datasetName === 'string')
            this.dataset_name = response.meta.datasetName;
        // set available families
        this.families = response.families;
        // set title
        document.title =
            (this.short_image_name !== '' ?
                this.short_image_name : APP_TITLE);

        // If we've viewed this image before, apply cached settings
        this.applyCachedSettings(response);

        // signal that we are ready
        this.ready = true;
        this.tmp_data = response;

        if (refresh) {
            this.context.publish(
                IMAGE_SETTINGS_REFRESH, { config_id : this.config_id});
        }
    }

    /**
     * Gets cached image settings from context and updates our settings
     *
     * @private
     * @memberof ImageInfo
     */
    applyCachedSettings(response) {
        let cached = this.context.getCachedImageSettings(this.image_id);
        let conf = this.context.getImageConfig(this.config_id);
        if (cached !== undefined) {

            let history = [];

            // JSON response object is passed to the ol3-viewer via tmp_data, so we need to update
            if (cached.center) {
                response.center = cached.center;
                response.rotation = cached.rotation;
                response.resolution = cached.resolution;
            }
            if (cached.z !== undefined) {
                history.push({prop: ['image_info', 'dimensions', 'z'],
                              old_val : this.dimensions.z,
                              new_val: cached.z,
                              type : "number"});
                response.rdefs.defaultZ = cached.z;
                this.dimensions.z = cached.z;
            }
            if (cached.t !== undefined) {
                history.push({prop: ['image_info', 'dimensions', 't'],
                              old_val : this.dimensions.t,
                              new_val: cached.t,
                              type : "number"});
                response.rdefs.defaultT = cached.t;
                this.dimensions.t = cached.t;
            }
            if (cached.projection) {
                // Don't need to update response.projection since Z dimension-slider
                // will update the ol3-viewer
                this.projection = cached.projection;
                this.projection_opts = cached.projection_opts;
            }
            if (cached.model) {
                let m = this.sanitizeModel(cached.model);
                if (this.model != m) {
                    history.push({
                        prop: ['image_info', 'model'],
                        old_val : this.model,
                        new_val: m,
                        type: 'string'});
                    this.model = m;
                }
            }
            response.rdefs.model = this.model;

            conf.addHistory(history);

            // Update the channels by 'pasting'
            // This adds to history separately from addHistory() above for all other settings.
            if (cached.channels) {
                // "1|589:2288$00FF00,2|477:2823$FFFF00"
                let c = cached.channels.map((ch, i) => `${ch.active ? '' : '-'}${i + 1}|${ch.window.start}:${ch.window.end}$${ch.color}`).join(',');

                let maps = cached.channels.map(ch => ({inverted: {enabled: ch.inverted},
                                                       quantization: {coefficient: ch.coefficient, family: ch.family}}));

                conf.applyRenderingSettings({c, maps});
            }
        }
    }

    /**
     * Uses inital/handed in settings to override response values
     *
     * @private
     * @param {Object} response the response object
     * @param {boolean} refresh  if true we don't run a full initialization
     * @memberof ImageInfo
     */
    integrateInitialSettings(response, refresh = false) {
        let initialDatasetId =
            parseInt(
                this.context.getInitialRequestParam(REQUEST_PARAMS.DATASET_ID));
        if (typeof initialDatasetId === 'number' &&
                !isNaN(initialDatasetId) && initialDatasetId >= 0) {
            this.parent_id = initialDatasetId;
            this.parent_type = INITIAL_TYPES.DATASET;
        }

        if (typeof response.tiles === 'boolean') this.tiled = response.tiles;
        let initialModel =
            this.context.getInitialRequestParam(REQUEST_PARAMS.MODEL);
        this.model = initialModel !== null ?
            initialModel.toLowerCase() : response.rdefs.model;

        // short circuit for refresh
        if (refresh) {
            this.channels =
                this.initAndMixChannelsWithInitialSettings(
                    response.channels, []);
            return;
        }

        // initialize channels (incl. initial params)
        let initialTime =
            this.context.getInitialRequestParam(REQUEST_PARAMS.TIME);
        let initialPlane =
            this.context.getInitialRequestParam(REQUEST_PARAMS.PLANE);
        let initialProjection =
            this.context.getInitialRequestParam(REQUEST_PARAMS.PROJECTION);
        let initialChannels =
            this.context.getInitialRequestParam(REQUEST_PARAMS.CHANNELS);
        let initialMaps =
            this.context.getInitialRequestParam(REQUEST_PARAMS.MAPS);
        initialChannels =
            Misc.parseChannelParameters(initialChannels, initialMaps);
        this.channels =
            this.initAndMixChannelsWithInitialSettings(
                response.channels, initialChannels);

        // initialize dimensions (incl. initial params)
        this.dimensions = {
            t: initialTime !== null ?
                (parseInt(initialTime)-1) : response.rdefs.defaultT,
            max_t : response.size.t,
            z: initialPlane !== null ?
                (parseInt(initialPlane)-1) : response.rdefs.defaultZ,
            max_z : response.size.z,
            max_x : response.size.width,
            max_y : response.size.height,
        };

        // store projection and model
        initialProjection =
            Misc.parseProjectionParameter(
                initialProjection !== null ?
                    initialProjection.toLowerCase() :
                    response.rdefs.projection);
        this.projection = initialProjection.projection;

        let v_s = 0, diff = 0, v_e = this.dimensions.max_z - 1;
        if (typeof initialProjection.start === 'number' &&
                initialProjection.start >= 0 &&
                initialProjection.start < this.dimensions.max_z) {
            v_s = initialProjection.start;
        } else {
            diff = this.dimensions.z-5;
            if (diff > 0) v_s = diff;
        }

        if (typeof initialProjection.end === 'number' &&
                initialProjection.end >= 0 &&
                initialProjection.end < this.dimensions.max_z) {
                v_e = initialProjection.end;
        } else {
            diff =  this.dimensions.z+5;
            if (diff < this.dimensions.max_z - 1)
                v_e = diff;
        }
        this.projection_opts = {
            start: v_s,
            end: v_e
        };
        if (this.dimensions.max_z > 1 &&
            this.projection_opts.start >= this.projection_opts.end)
                this.projection_opts.start = this.projection_opts.end - 1;

        this.sanityCheckInitialValues();
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
        this.model = this.sanitizeModel(this.model);
    }

    /**
     * Convert between the response.rdefs.model from imgData 'c' or 'g'
     * to 'color' or 'greyscale'
     *
     * @private
     * @memberof ImageInfo
     */
    sanitizeModel(model) {
        let lowerCaseModel = model.toLowerCase()[0];
        let m;
        switch (lowerCaseModel) {
            case 'c': m = 'color'; break;
            case 'g': m = 'greyscale'; break;
            default: m = 'color';
        }
        return m;
    }

    /**
     * Sets image_delta_t member from response
     * after formatting it to hours:minutes:seconds:milliseconds
     *
     * @private
     * @param {Object} response the response object
     * @memberof ImageInfo
     */
    setFormattedDeltaT(response) {
        // avoid further IEEE inaccuracies for remainders
        // by using multiplier and rounding to integer (at ms effectively)
        const precision = 1000;

        let deltaTisAllZeros = true;
        response.delta_t.map((t) => {
            t = Math.round(t * precision);
            let deltaTformatted = "";

            // put minus in front
            let isNegative = t < 0;
            if (isNegative) {
                deltaTformatted += "-";
                t = -t;
            }
            if (t !== 0) deltaTisAllZeros = false;
            // hrs
            let hours = parseInt(t / (3600 * precision));
            deltaTformatted += ("00" + hours).slice(-2) + ":";
            t -= (hours * 3600 * precision);
            // minutes
            let mins =  parseInt(t / (60 * precision));
            deltaTformatted += ("00" + mins).slice(-2) + ":";
            t -= (mins * (60 * precision));
            // seconds
            let secs = parseInt(t / precision);
            deltaTformatted += ("00" + secs).slice(-2) + ".";
            // milliseconds
            let millis = t - (secs * precision);
            deltaTformatted += ("000" + millis).slice(-3);
            this.image_delta_t.push(deltaTformatted);
        });

        // we reset to deltaT to [] if all zeros
        if (deltaTisAllZeros) this.image_delta_t = [];
        // original units
        this.image_delta_t_unit = response.delta_t_unit_symbol;
    }

    /**
     * Retrieves the copied rendering settings
     *
     * @param {function} callback a callback for success
     * @memberof ImageInfo
     */
    requestImgRDef(callback = null) {
        let oldConfigId = this.config_id;
        if (callback === null)
            callback = (rdef, config_id) => {
                if (rdef === null || typeof rdef.c !== 'string' ||
                    config_id !== oldConfigId || !this.ready) return;
                let channels = Misc.parseChannelParameters(rdef.c, rdef.maps);
                // we only allow copy and paste with same number of channels
                // and compatible range
                if (!Misc.isArray(channels) || !Misc.isArray(this.channels) ||
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
                    callback(this.copied_img_rdef, this.config_id);},
            error : () => {
                this.copied_img_rdef = null;
                callback(this.copied_img_rdef, this.config_id);}
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

        // set flag for showing advanced settings,
        // inverted flag and luts (if exists)
        channels.map((c) => {
            c.show_advanced_settings =
                typeof c.family === 'string' && c.family !== 'linear';
            if (typeof c.lut  === 'string' && c.lut.length > 0)
                c.color = c.lut;
            if (typeof c.inverted !== 'boolean')
                c.inverted = null;
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
                if (typeof c.inverted === 'boolean')
                    chan.inverted = c.inverted;
                if (typeof c.family === 'string')
                    chan.family = c.family;
                if (typeof c.coefficient === 'number' &&
                    !isNaN(c.coefficient))
                    chan.coefficient = c.coefficient;
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
    * @param {number} precision a floating point precision
    * @return {Object|null} returns object with the respective min,max properties or null
    * @memberof ChannelRange
    */
    getChannelMinMaxValues(mode = 0, index=0, precision=0) {
        if (typeof mode !== 'number' || mode < 0 || mode > 2 ||
                typeof index !== 'number' || index < 0 ||
                index >= this.channels.length) return null;

        let start_min,start_max,end_min,end_max,start_val,end_val;
        let c = this.channels[index];
        switch(mode) {
            case CHANNEL_SETTINGS_MODE.IMPORTED:
            case CHANNEL_SETTINGS_MODE.MIN_MAX:
                start_min = c.window.min;
                start_max = c.window.end;
                end_min = c.window.start;
                end_max = c.window.max;
                start_val = this.initial_values ?
                    c.window.start : c.window.min;
                end_val = this.initial_values ?
                    c.window.end : c.window.max;
                break;

            case CHANNEL_SETTINGS_MODE.FULL_RANGE:
                start_min = this.range[0];
                start_max = c.window.end;
                end_min = c.window.start;
                end_max = this.range[1];
                start_val = this.range[0];
                end_val = this.range[1];
                break;
        }

        let step_size = 1;
        if (this.image_pixels_type === 'float' ||
            this.image_pixels_type === 'double') {
                step_size = 0.001;
                if (typeof precision !== 'number' ||
                    precision <= 0) precision = 3;
        } else precision = 0;

        return {
            start_min:
                precision === 0 ?
                    start_min : Misc.roundAtDecimal(start_min, precision),
            start_max:
                (precision === 0 ?
                    start_max :
                        Misc.roundAtDecimal(start_max, precision)) - step_size,
            end_min:
                (precision === 0 ?
                    end_min :
                        Misc.roundAtDecimal(end_min, precision)) + step_size,
            end_max:
                precision === 0 ?
                    end_max : Misc.roundAtDecimal(end_max, precision),
            start_val:
                precision === 0 ?
                    start_val : Misc.roundAtDecimal(start_val, precision),
            end_val:
                precision === 0 ?
                    end_val : Misc.roundAtDecimal(end_val, precision),
            step_size: step_size
        }
    }
}
