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
import {EventAggregator} from 'aurelia-event-aggregator';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import OpenWith from '../utils/openwith';
import ImageConfig from '../model/image_config';
import ImageInfo from '../model/image_info';
import RegionsInfo from '../model/regions_info';
import {
    IMAGE_SETTINGS_REFRESH,
    IMAGE_VIEWER_CONTROLS_VISIBILITY,
    THUMBNAILS_UPDATE,
    REGIONS_STORE_SHAPES,
    REGIONS_STORED_SHAPES
} from '../events/events';
import {
    APP_NAME, IMAGE_CONFIG_RELOAD, IVIEWER, INITIAL_TYPES,
    LUTS_PNG_URL, PLUGIN_NAME, PLUGIN_PREFIX, REQUEST_PARAMS, SYNC_LOCK,
    TABS, URI_PREFIX, WEB_API_BASE, WEBCLIENT, WEBGATEWAY
} from '../utils/constants';

/**
 * Provides all the information to the application that it shares
 * among its components, in particular it holds ImageConfig instances
 * which represent the data object/model.
 *
 * The individual ImageConfig instances are not 1:1 related to an image so that
 * a kind of multiple document interface is possible, or said differently:
 * the same image can be opened/viewer/interacted with multiple times and
 * potentially independently.
 *
 * The flag that defines if nore than one image can be opened/viewed/interacted with
 * is useMDI.
 */
@noView
export default class Context {
    /**
     * the version number
     * (set via initial params)
     *
     * @memberof Context
     * @type {string}
     */
    version = "0.0.0";

    /**
     * are we running within the wepback dev server
     *
     * @memberof Context
     * @type {boolean}
     */
    is_dev_server = false;

    /**
     * the aurelia event aggregator
     *
     * @memberof Context
     * @type {EventAggregator}
     */
    eventbus = null;


    /**
     * The groups for syncing/linking actions
     *
     * @memberof Context
     * @type {Map}
     */
    sync_groups = new Map();

    /**
     * Flag to disable event notification
     *
     * @memberof Context
     * @type {boolean}
     */
    prevent_event_notification = false;

    /**
     * server information (if not localhost)
     *
     * @memberof Context
     * @type {string}
     */
    server = null;

    /**
     * a list of potentially prefixes resources
     *
     * @type {Map}
     */
    prefixed_uris = new Map();

    /**
     * a map for a more convenient key based lookup of an ImageConfig instance
     *
     * @memberof Context
     * @type {Map}
     */
    image_configs = new Map();

    /**
     * a map for unsaved image settings
     *
     * @memberof Context
     * @type {Map}
     */
    cached_image_settings = {};

    /**
     * the initial type the viewer was opened with
     *
     * @memberof Context
     * @type {number}
     */
    initial_type = INITIAL_TYPES.NONE;

    /**
     * the initial id(s) corresponding to the initial type
     *
     * @memberof Context
     * @type {number}
     */
    initial_ids = [];

    /**
     * the key of the presently selected/active ImageConfig
     * this setting gains only importance if useMDI is set to true
     * so that multiple images can be open but only one is active/interacted with

     * @memberof Context
     * @type {number}
     */
    selected_config = null;

    /**
     * Are we allowed to open/view/interact with more than one image
     *
     * @memberof Context
     * @type {boolean}
     */
    useMDI = false;

    /**
     * the global value indicating the selected tab
     *
     * @memberof Context
     * @type {String}
     */
     selected_tab = TABS.SETTINGS;

     /**
      * should interpolation should be used for image rendering?
      * @type {boolean}
      */
     interpolate = true;

     /**
      * application wide keyhandlers.
      * see addKeyListener/removeKeyListener
      * entries in the map are of the following format
      * e.g.: key: 'A', value: {func: this.selectAllShapes, args: [true]}
      *
      * @memberof Context
      * @type {Map}
      */
     key_listeners = new Map();

     /**
      * the lookup tables
      *
      * @memberof Context
      * @type {Map}
      */
     luts = new Map();

     /**
      * max active channels - default is loaded from iviewer_settings
      *
      * @memberof Context
      * @type {number}
      */
     max_active_channels = 10;

     /**
      * the lookup png
      *
      * @memberof Context
      * @type {Object}
      */
     luts_png = {
         image: null,
         url: '',
         height: 0
     }

    /**
     * @constructor
     * @param {EventAggregator} eventbus the aurelia event aggregator
     * @param {object} params an object containing the initial request params
     */
    constructor(eventbus = null, params={}) {
        // event aggregator is mandatory
        if (typeof eventbus instanceof EventAggregator)
            throw "Invalid EventAggregator given!"

        this.eventbus = eventbus;
        this.initParams = params;

        // add sync groups & locks
        let locks = {};
        locks[SYNC_LOCK.ZT.CHAR] = true;
        locks[SYNC_LOCK.VIEW.CHAR] = true;
        locks[SYNC_LOCK.CHANNELS.CHAR] = false;
        [1,2,3].map((i) => this.sync_groups.set(
            "group" + i, {sync_locks: Object.assign({}, locks), members: []}));

        // process inital request params and assign members
        this.processInitialParameters();
        this.readPrefixedURIs();

        // set global ajax request properties
        $.ajaxSetup({
            cache: false,
            dataType : Misc.useJsonp(this.server) ? "jsonp" : "json",
            beforeSend: (xhr, settings) => {
                if (!Misc.useJsonp(this.server) &&
                    !(/^(GET|HEAD|OPTIONS|TRACE)$/.test(settings.type)))
                    xhr.setRequestHeader("X-CSRFToken",
                        Misc.getCookie('csrftoken'));
            }
        });

        // set up luts
        this.setUpLuts();

        // load max active channels
        this.loadMaxActiveChannels();

        // initialize Open_with
        OpenWith.initOpenWith();

        // open what we received as inital parameter
        this.openWithInitialParams();

        // set up key listener
        this.establishKeyDownListener();

        // url navigation
        if (this.hasHTML5HistoryFeatures()) {
            window.onpopstate = (e) => {
                if (e.state === null) {
                    window.history.go(0);
                    return;
                }
                let openImageConfig = true;
                if (this.useMDI) {
                    let imageConfigsForImage =
                        this.getImageConfigsForGivenImage(e.state.image_id);
                    if (imageConfigsForImage.length === 0) openImageConfig = true;
                    else {
                        let hasConfId = false;
                        for (let i in imageConfigsForImage) {
                            if (imageConfigsForImage[i].id === e.state.config_id) {
                                hasConfId = true;
                                break;
                            }
                        }
                        openImageConfig = false;
                        this.selectConfig(
                            hasConfId ?
                                e.state.config_id : imageConfigsForImage[0].id);
                    }
                }
                if (openImageConfig)
                    this.addImageConfig(e.state.image_id, INITIAL_TYPES.IMAGES, e.state.parent_id);
            };
        }
    }

    /**
     * Checks for history features introduced with HTML5
     *
     * @memberof Context
     */
    hasHTML5HistoryFeatures() {
        return window.history &&
            typeof window.history.pushState === 'function' &&
            typeof window.onpopstate !== 'undefined';
    }

    /**
     * Sets up the luts by requesting json and png
     *
     * @memberof Context
     */
    setUpLuts() {
        $.ajax(
            {url : this.server + this.getPrefixedURI(WEBGATEWAY) + "/luts/",
            success : (response) => {
                // Check first whether omero-web can provides LUT dynamically
                // and set URL accordingly
                let is_dynamic_lut = Boolean(response.png_luts_new);
                if (is_dynamic_lut) {
                    this.luts_png.url =
                        this.server + this.getPrefixedURI(WEBGATEWAY, false) + "/luts_png/";
                } else {
                    this.luts_png.url =
                        this.server + this.getPrefixedURI(WEBGATEWAY, true) + LUTS_PNG_URL;
                }

                // determine the luts png height
                let lutsPng = new Image();
                lutsPng.onload = (e) => {
                    this.luts_png.height = e.target.naturalHeight;
                    this.luts_png.image = lutsPng;
                    for (let [id, conf] of this.image_configs) conf.changed();
                }
                lutsPng.src = this.luts_png.url;

                if (is_dynamic_lut) {
                    // If it's dynamic, uses the new list instead
                    response.png_luts = response.png_luts_new
                }

                response.luts.forEach(
                    (l) => {
                        let mapValue =
                            Object.assign({
                                nice_name :
                                    l.name.replace(/.lut/g, "").replace(/_/g, " "),
                                index : is_dynamic_lut ? l.png_index_new : l.png_index
                            }, l);
                        this.luts.set(mapValue.name, mapValue);
                    });
                for (let [id, conf] of this.image_configs) conf.changed();
            }
        });
    }

    loadMaxActiveChannels() {
        // query microservice endpoint...
        let url = this.server + "/omero_ms_image_region/";
        fetch(url, {method: "OPTIONS"})
        .then(r => r.json())
        .then(data => {
            if (Number.isInteger(data.options?.maxActiveChannels)) {
                this.max_active_channels = data.options.maxActiveChannels;
                // in case the images loaded already (this query took longer than
                // expected), let's update them...
                for (let [id, conf] of this.image_configs) {
                    conf.image_info.applyMaxActiveChannels(this.max_active_channels);
                }
            }
        }).catch(() => {
            console.log("failed to load omero_ms_image_region info");
        });
    }

    /**
     * Depending on what received as the inital parameters
     * (image(s), dataset, etc) we continue to create and add
     * an initial image config (or not) and do whatevere is necessary
     * to bootstrap the initial type
     *
     * @memberof Context
     */
    openWithInitialParams() {
        // do we have any image ids or roi ids?
        let initial_ids;
        let initial_type;   // INITIAL_TYPES int
        if (this.initParams[REQUEST_PARAMS.IMAGES]) {
            initial_ids = this.initParams[REQUEST_PARAMS.IMAGES];
            initial_type = INITIAL_TYPES.IMAGES;
        } else if (this.initParams[REQUEST_PARAMS.ROI]) {
            // also support ?roi=1
            initial_ids = this.initParams[REQUEST_PARAMS.ROI];
            initial_type = INITIAL_TYPES.ROIS;
        } else if (this.initParams[REQUEST_PARAMS.SHAPE]) {
            initial_ids = this.initParams[REQUEST_PARAMS.SHAPE];
            initial_type = INITIAL_TYPES.SHAPES;
        }
        if (initial_ids) {
            this.initial_ids = initial_ids.split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id))

            if (this.initial_ids.length > 0)
                this.initial_type = initial_type;
        }

        // do we have a dataset id?
        let initial_dataset_id =
            parseInt(this.getInitialRequestParam(REQUEST_PARAMS.DATASET_ID));
        if (typeof initial_dataset_id !== 'number' || isNaN(initial_dataset_id))
            initial_dataset_id = null;
        // do we have a well id?
        let initial_well_id =
            parseInt(this.getInitialRequestParam(REQUEST_PARAMS.WELL_ID));
        if (typeof initial_well_id !== 'number' || isNaN(initial_well_id))
            initial_well_id = null;

        // add image config if we have image ids OR roi id OR shape id
        if ([INITIAL_TYPES.IMAGES, INITIAL_TYPES.ROIS, INITIAL_TYPES.SHAPES].indexOf(this.initial_type) > -1) {
            let parent_id = initial_dataset_id || initial_well_id;
            let parent_type;
            if (parent_id) {
                if (initial_dataset_id !== null) {
                    parent_type = INITIAL_TYPES.DATASET;
                } else {
                    parent_type = INITIAL_TYPES.WELL
                }
            }
            this.addImageConfig(this.initial_ids[0], this.initial_type, parent_id, parent_type);
        } else {
            // we could either have a well or just a dataset
            if (initial_well_id) { // well takes precedence
                this.initial_type = INITIAL_TYPES.WELL;
                this.initial_ids.push(initial_well_id);
            } else if (initial_dataset_id) {
                this.initial_type = INITIAL_TYPES.DATASET;
                this.initial_ids.push(initial_dataset_id);
            }
        }
    }

    /**
     * Queries whether a lut by the given name is in our map
     *
     * @param {string} name the lut name
     * @return {boolean} true if the lut was found, false otherwise
     * @memberof Context
     */
    hasLookupTableEntry(name) {
        if (typeof name !== 'string') return false;

        let lut = this.luts.get(name);
        return typeof lut === 'object';
    }

    /**
     * Processes intial/handed in parameters,
     * conducting checks and setting defaults
     *
     * @memberof Context
     */
    processInitialParameters() {
        let server = this.initParams[REQUEST_PARAMS.HOST];
        if (typeof server !== 'string' || server.length === 0) server = "";
        else {
            // check for localhost and if we need to prefix for requests
            let isLocal =
                server.indexOf("localhost") >=0 ||
                server.indexOf("127.0.0.1") >=0 ;
            let minLen = "http://".length;
            let pos =
                server.indexOf("localhost") >= minLen ?
                    server.indexOf("localhost") : server.indexOf("127.0.0.1");
            if (isLocal && pos < minLen)  // we need to add the http
                server = "http://" + server;
        }
        this.server = server;
        delete this.initParams[REQUEST_PARAMS.HOST];

        let interpolate =
            typeof this.initParams[REQUEST_PARAMS.INTERPOLATE] === 'string' ?
                this.initParams[REQUEST_PARAMS.INTERPOLATE].toLowerCase() : 'true';
        this.interpolate = (interpolate === 'true');
        this.version = this.getInitialRequestParam(REQUEST_PARAMS.VERSION);
        this.roi_page_size = this.initParams[REQUEST_PARAMS.ROI_PAGE_SIZE] || 500;
        this.max_projection_bytes = parseInt(this.initParams[REQUEST_PARAMS.MAX_PROJECTION_BYTES], 10)
                                    || (1024 * 1024 * 256);
        this.max_projection_bytes = parseInt(this.initParams[REQUEST_PARAMS.MAX_PROJECTION_BYTES], 10) || (1024 * 1024 * 256);
        this.max_active_channels = parseInt(this.initParams[REQUEST_PARAMS.MAX_ACTIVE_CHANNELS], 10) || 10;
        let userPalette = `${this.initParams[REQUEST_PARAMS.ROI_COLOR_PALETTE]}`
        if (userPalette) {
            let arr = userPalette.match(/\[[^\[\]]*\]/g)
            if (arr) {
                this.roi_color_palette = []; let i = 0
                arr.forEach(arr => {this.roi_color_palette[i] = arr.match(/[A-Za-z#][A-Za-z0-9]*(\([^A-Za-z]*\))?/g); i++})
            }
        }
        this.show_palette_only = (this.initParams[REQUEST_PARAMS.SHOW_PALETTE_ONLY] != 'False') || false
        this.enable_mirror = (this.initParams[REQUEST_PARAMS.ENABLE_MIRROR] != 'False') || false
        // nodedescriptors can be empty string or "None" (undefined)
        let nds = this.initParams[REQUEST_PARAMS.NODEDESCRIPTORS];
        // initially hide left and right panels?
        if (this.initParams[REQUEST_PARAMS.FULL_PAGE] == 'true') {
            this.collapse_left = true;
            this.collapse_right = true;
        } else {
            if (this.initParams[REQUEST_PARAMS.COLLAPSE_LEFT] == 'true') {
                this.collapse_left = true;
            }
            if (this.initParams[REQUEST_PARAMS.COLLAPSE_RIGHT] == 'true') {
                this.collapse_right = true;
            }
        }
        this.nodedescriptors = nds == 'None' ? undefined : nds
    }

    /**
     * Reads the list of uris that we need
     *
     * @memberof Context
     */
    readPrefixedURIs() {
        let prefix =
            typeof this.initParams[URI_PREFIX] === 'string' ?
                Misc.prepareURI(this.initParams[URI_PREFIX]) : "";
        this.prefixed_uris.set(URI_PREFIX, prefix);
        this.prefixed_uris.set(IVIEWER, prefix + "/" + APP_NAME);
        this.prefixed_uris.set(PLUGIN_PREFIX, prefix + "/" + PLUGIN_NAME);
        [WEB_API_BASE, WEBGATEWAY, WEBCLIENT].map(
            (key) =>
                this.prefixed_uris.set(
                    key, typeof this.initParams[key] === 'string' ?
                            this.initParams[key] : '/' + key.toLowerCase()));
    }

    /**
     * Reads the list of uris that we need
     *
     * @param {string} resource name
     * @param {boolean} for_static_resources if true we include static in the uri
     * @return {string\null} the (potentially prefixed) uri for the resource or null
     */
    getPrefixedURI(resource, for_static_resources) {
        if (typeof for_static_resources !== 'boolean')
            for_static_resources = false;

        let uri = Misc.prepareURI(this.prefixed_uris.get(resource, ""));
        if (uri === "") return uri; // no need to go on if we are empty

        if (for_static_resources) {
            let prefix =
                Misc.prepareURI(this.prefixed_uris.get(URI_PREFIX, ""));
            if (prefix !== "") {
                uri = prefix + '/static' + uri.replace(prefix, '');
            } else uri = "/static" + uri;
        }
        return uri;
    }

    /**
     * Creates an app wide key down listener
     * that will listen for key presses registered via addKeyListener
     *
     * @memberof Context
     */
    establishKeyDownListener() {
        // we do this only once
        if (window.onkeydown === null)
            window.onkeydown = (event) => {
                let command = Misc.isApple() ? 'metaKey' : 'ctrlKey';
                let keyHandlers =
                    this.key_listeners.get(event.key.toUpperCase());
                if (typeof keyHandlers === 'undefined' ||
                    event.target.nodeName.toUpperCase() === 'INPUT') return;

                // we allow the browser's default action and event
                // bubbling unless one handler returns false
                let allowDefaultAndPropagation = true;
                try {
                    for (let a in keyHandlers) {
                        let action = keyHandlers[a];
                        if (action['ctrl'] && !event[command]) continue;
                        if (!((action['action'])(event)))
                            allowDefaultAndPropagation = false;
                    }
                } catch(ignored) {}
                if (!allowDefaultAndPropagation) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            };
    }

    /**
     * Registers an app wide key handler for individual keys for onkeydown
     * Multiple actions for one key are posssible under the prerequisite
     * that a respective group be used for distinguishing
     *
     * @memberof Context
     * @param {string} key the key value to listen for
     * @param {function} action a function
     * @param {string} group a grouping, default: 'global'
     * @param {boolean} ctrl is a command/ctrl combination
     */
    addKeyListener(key, action, group = 'global', ctrl = true) {
        // some basic checks as to validity of key and key_handler_def
        // we need a numeric key and a function at a minimum
        if (typeof key !== 'string' || typeof action !== 'function') return;

        // we allow multiple actions for same key but different groups,
        // i.e. undo/redo, copy/paste, save for settings/rois
        key = key.toUpperCase();
        let keyActions = this.key_listeners.get(key);
        let new_key_action = {
            'ctrl': ctrl,
            'action': action
        };
        if (keyActions) keyActions[group] = new_key_action;
        else {
            let new_list = {};
            new_list[group] = new_key_action;
            this.key_listeners.set(key, new_list)
        };
    }

    /**
     * Unregisters a keydown handler for a particular key (with group)
     *
     * @param {string} key the key value associated with the listener
     * @param {string} group a grouping, default: 'global'
     * @memberof Context
     */
    removeKeyListener(key, group='global') {
        if (typeof key !== 'string') return;
        key = key.toUpperCase();
        let keyActions = this.key_listeners.get(key);
        if (keyActions) {
            delete keyActions[group];
            let noHandlersLeft = true;
            for(let k in keyActions)
                if (typeof keyActions[k]['action'] === 'function') {
                    noHandlersLeft = false;
                    break;
                }
            if (noHandlersLeft) this.key_listeners.delete(key);
        }
    }

    /**
     * Makes a browser history entry for back/forth navigation
     *
     * @memberof Context
     * @param {number} image_id the image id
     */
    rememberImageConfigChange(image_id) {
        if (!this.hasHTML5HistoryFeatures() ||
            this.getSelectedImageConfig() === null) return;

        let newPath = window.location.pathname;
        let parent_id = null;
        let selConf = this.getSelectedImageConfig();
        if (selConf === null) return;

        let parentType =
            this.initial_type === INITIAL_TYPES.IMAGES ?
                selConf.image_info.parent_type : this.initial_type;
        let parentTypeString =
            parentType === INITIAL_TYPES.WELL ? "well" : "dataset";

        // default viewer url
        if (newPath.indexOf("webclient/img_detail") !== -1) {
            let old_image_id =
                selConf && selConf.image_info ?
                    selConf.image_info.image_id: null;
            if (old_image_id) {
                newPath = newPath.replace(old_image_id, image_id);
                parent_id =
                    this.initial_type === INITIAL_TYPES.IMAGES ?
                        (typeof selConf.image_info.parent_id === 'number' ?
                            selConf.image_info.parent_id : null) :
                        this.initial_ids[0];
                if (parent_id)
                    newPath += "?" + parentTypeString + "=" + parent_id;
            }
        } else {
            // 'standard' url
            if (this.initial_type === INITIAL_TYPES.IMAGES || this.initial_type === INITIAL_TYPES.ROIS
                    || this.initial_type === INITIAL_TYPES.SHAPES) {
                if (this.initial_ids.length > 1)
                    // e.g. ?images=1,2 - Don't update URL
                    newPath += window.location.search;
                else {
                    // e.g. ?images=1 - update to ?images=2&dataset=1
                    parent_id = selConf.image_info.parent_id;
                    newPath +=
                        '?images=' + image_id + '&' + parentTypeString + "=" + parent_id;
                }
            } else {
                // e.g. ?dataset=1 - Don't update URL
                parent_id = this.initial_ids[0];
                newPath += "?" + parentTypeString + "=" + parent_id;
            }
            if (this.is_dev_server) {
                newPath += (newPath.indexOf('?') === -1) ? '?' : '&';
                newPath += 'haveMadeCrossOriginLogin_';
            }
        }

        // add history entry
        window.history.pushState(
            {image_id: image_id,
             parent_id: parent_id,
             parent_type: parentTypeString,
             config_id: selConf.id
            }, "", newPath);
    }

    /**
     * Creates and adds an ImageConfig instance by handing it an id of an image
     * stored on the server, as well as making it the selected/active image config.
     *
     * @param {number} obj_id the image or roi id
     * @param {number} obj_type e.g. INITIAL_TYPES.IMAGES or ROIS
     * @param {number} parent_id an optional parent id
     * @param {number} parent_type an optional parent type  (e.g. dataset or well)
     */
    addImageConfig(obj_id, obj_type, parent_id, parent_type) {
        if (typeof obj_id !== 'number' || obj_id < 0) return;

        // we do not keep the other configs around unless we are in MDI mode.
        if (!this.useMDI) {
            for (let [id, conf] of this.image_configs)
                this.removeImageConfig(id,conf)
        } else {
            for (let [id, conf] of this.image_configs) {
                if (conf.show_controls)
                    this.publish(
                        IMAGE_VIEWER_CONTROLS_VISIBILITY,
                        {config_id: this.selected_config, flag: false});
            };
        }

        let image_config =
            new ImageConfig(this, obj_id, obj_type, parent_id, parent_type);
        // store the image config in the map and make it the selected one
        this.image_configs.set(image_config.id, image_config);
        this.selectConfig(image_config.id);
        // Call bind() to initialize image data loading
        image_config.bind();
    }

    /**
     * Get the parent e.g. {type:'dataset', id:123} for example used to
     * load additional thumbnails.
     */
    getParentTypeAndId() {
        let image_config = this.getSelectedImageConfig();
        // Dataset ID or Well ID or Image ID
        let parent_id = null;
        if (this.initial_type === INITIAL_TYPES.DATASET ||
            this.initial_type === INITIAL_TYPES.WELL) {
                parent_id = this.initial_ids[0];
        } else if (this.initial_type === INITIAL_TYPES.IMAGES &&
            this.initial_ids.length === 1 &&
            image_config !== null &&
            typeof image_config.image_info.parent_id === 'number'){
                parent_id = image_config.image_info.parent_id;
        }
        let parent_type = INITIAL_TYPES.NONE;
        if (parent_id) {
            parent_type = this.initial_type === INITIAL_TYPES.IMAGES ?
                    image_config.image_info.parent_type : this.initial_type;
        }
        return {type: parent_type, id: parent_id};
    }

    /**
     * Click Handler for single/double clicks to converge on:
     * Opens images in single and multi viewer mode
     *
     * @memberof ThumbnailSlider
     * @param {number} obj_id the image or roi id for the clicked thumbnail
     * @param {boolean} is_double_click true if triggered by a double click
     */
    onClicks(obj_id, is_double_click = false, replace_image_config) {
        let image_config = this.getSelectedImageConfig();
        let navigateToNewImage = () => {
            this.rememberImageConfigChange(obj_id);
            // Dataset ID or Well ID or Image ID
            let parent = this.getParentTypeAndId();
            let parent_id = parent.id;
            let parent_type = parent.type;
            // single click in mdi will need to 'replace' image config
            if (this.useMDI && !is_double_click && !replace_image_config) {
                replace_image_config = image_config;
            }
            let initial_type = INITIAL_TYPES.IMAGES;
            if (replace_image_config) {
                let oldPosition = Object.assign({}, replace_image_config.position);
                let oldSize = Object.assign({}, replace_image_config.size);
                this.removeImageConfig(replace_image_config, true);
                this.addImageConfig(obj_id, initial_type, parent_id, parent_type);
                // Get the newly created image config
                let selImgConf = this.getSelectedImageConfig();
                if (selImgConf !== null) {
                    selImgConf.position = oldPosition;
                    selImgConf.size = oldSize;
                }
            } else {
                this.addImageConfig(obj_id, initial_type, parent_id, parent_type);
            }
        };

        let modifiedConfs = this.useMDI ?
            this.findConfigsWithModifiedRegionsForGivenImage(
                obj_id) : [];
        let selImgConf = this.getSelectedImageConfig();
        let hasSameImageSelected =
            selImgConf && selImgConf.image_info.image_id === obj_id;
        // show dialogs for modified rois
        if (image_config &&
            image_config.regions_info &&
            (image_config.regions_info.hasBeenModified() ||
             modifiedConfs.length > 0) &&
             (!is_double_click || (is_double_click && !hasSameImageSelected)) &&
            !Misc.useJsonp(this.server) &&
            image_config.regions_info.image_info.can_annotate) {
                let modalText =
                    !this.useMDI ||
                    image_config.regions_info.hasBeenModified() ?
                        'You have new/deleted/modified ROI(s).<br>' +
                        'Do you want to save your changes?' :
                        'You have changed ROI(s) on an image ' +
                        'that\'s been opened multiple times.<br>' +
                        'Do you want to save now to avoid ' +
                        'inconsistence (and a potential loss ' +
                        'of some of your changes)?';
                let saveHandler =
                    !this.useMDI ||
                    (!is_double_click &&
                     image_config.regions_info.hasBeenModified()) ?
                        () => {
                            let tmpSub =
                                this.eventbus.subscribe(
                                    REGIONS_STORED_SHAPES,
                                    (params={}) => {
                                        tmpSub.dispose();
                                        if (params.omit_client_update)
                                            navigateToNewImage();
                                });
                            setTimeout(()=>
                                this.publish(
                                    REGIONS_STORE_SHAPES,
                                    {config_id : image_config.id,
                                     omit_client_update: true}), 20);
                        } :
                        () => {
                            this.publish(
                                REGIONS_STORE_SHAPES,
                                {config_id :
                                    image_config.regions_info.hasBeenModified() ?
                                    image_config.id : modifiedConfs[0],
                                 omit_client_update: false});
                            navigateToNewImage();
                        };
                UI.showConfirmationDialog(
                    'Save ROIs?', modalText,
                    saveHandler, () => navigateToNewImage());
        } else navigateToNewImage();
    }

    /**
     * Removes an image config from the internal map.
     * We can hand it either the id or a reference to itself
     *
     * @memberof Context
     * @param {ImageConfig|number} image_config_or_id id or ImageConfig
     * @param {boolean} stay_in_mdi if true we stay in mdi regardless
     */
    removeImageConfig(image_config_or_id, stay_in_mdi = false) {
        let conf = null;
        if (image_config_or_id instanceof ImageConfig)
            conf = image_config_or_id;
        else if (typeof image_config_or_id === "number")
            conf = this.image_configs.get(image_config_or_id);

        // neither reference nor valid id
        if (!(conf instanceof ImageConfig)) return;

        // take out of map
        this.image_configs.delete(conf.id);

        // deselect if we were selected
        let selId = this.getSelectedImageConfig();
        if ((selId && selId === conf.id) ||
            selId === null) this.selected_config = null;
        // if in mdi, select another open config
        let confSize = this.image_configs.size;
        if (this.useMDI) {
            // remove from sync group
            conf.toggleSyncGroup(null);
            // choose next selected image config
            if (confSize > 0) {
                this.selected_config = this.image_configs.keys().next().value;
                if (!stay_in_mdi && confSize === 1) {
                    this.publish(
                        IMAGE_VIEWER_CONTROLS_VISIBILITY,
                        {config_id: this.selected_config, flag: true});
                    this.useMDI = false;
                }
            }
        }

        // call unbind and wipe reference
        conf.unbind();
        conf = null;
    }

    /**
     * Selects an image config
     *
     * @memberof Context
     * @param {number} id the ImageConfig id
     */
    selectConfig(id=null) {
        if (typeof id === 'number' && id > 0 &&
            (this.image_configs.get(id) instanceof ImageConfig) &&
            this.selected_config !== id) {
          this.selected_config = id;
        }
        // NB: return true so that the event bubbles.
        // see https://github.com/ome/omero-iviewer/issues/274
        return true;
    }

    /**
     * Retrieves an image config given an id. This method will look up existing
     * ImageConfigs in the map and, therefore, not reissue a backend request,
     * unless explicitly told so.
     *
     * @memberof Context
     * @param {number} id the ImageConfig id
     * @param {boolean} forceRequest if true an ajax request is forced to update the data
     * @return {ImageConfig} the image config object or null
     */
    getImageConfig(id, forceRequest=false) {
        if (typeof id !== 'number' || id < 0)
            return null;

        // check if we exit
        let image_config = this.image_configs.get(id);
        if (!(image_config instanceof ImageConfig) || image_config === null)
            return null;

        // we are told to request the data from the backend
        if (image_config && forceRequest) image_config.image_info.requestData();

        return image_config;
    }

    /**
     * Returns the active ImageConfig.
     * Unless we operate in MDI mode calling this method is superfluous.
     *
     * @memberof Context
     * @return {ImageConfig|null} returns an ImageConfig or null
     */
    getSelectedImageConfig() {
        if (typeof this.selected_config !== 'number') return null;

        return this.getImageConfig(this.selected_config);
    }

    /**
     * Retrieves any image configs that occupy a given x, y position,
     * based on the position and size of each image viewer
     *
     * @memberof Context
     * @param {x} x coordinate
     * @param {y} y coordinate
     * @return {list} of ImageConfig objects
     */
    getImageConfigsAtPosition(x, y) {
        let configs = [];
        for (let [id, conf] of this.image_configs) {
            if (conf.position === null) continue;
            let left = parseInt(conf.position.left);
            let top = parseInt(conf.position.top);
            let width = parseInt(conf.size.width);
            let height = parseInt(conf.size.height);
            if (left < x && (left + width) > x &&
                top < y && (top + height) > y) {
                configs.push(conf);
            }
        }
        return configs;
    }

    /**
     * Sets a cache of image settings.
     * Settings object contains 'channels' (same as imgData JSON)
     * 'projection', 'model', 'time', 'plane'
     *
     * @memberof Context
     * @param {number} image_id the Image ID
     * @param {Object} settings new settings
     */
    setCachedImageSettings(image_id, settings) {
        const old = this.cached_image_settings[image_id] || {};
        this.cached_image_settings[image_id] = Object.assign({}, old, settings);
    }

    /**
     * Retrieves last viewed (unsaved) settings for an image by ID.
     * Object returned contains 'channels' (same as imgData JSON)
     * 'projection', 'model', 'time', 'plane'
     *
     * @memberof Context
     * @param {number} image_id the Image ID
     * @return {Object} similar to imgData JSON
     */
    getCachedImageSettings(image_id) {
        if (this.cached_image_settings[image_id]) {
            return this.cached_image_settings[image_id];
        }
    }

    /**
     * Clears cache of image settings, specified by ID.
     * If imageIds is not defined, this clears ALL cached images settings.
     *
     * @param {Array.<number>} imageIds the IDs of Images to clear from cache
     * @memberof Context
     */
    clearCachedImageSettings(imageIds) {
        if (Misc.isArray(imageIds)) {
            imageIds.forEach(image_id => {
                if (this.cached_image_settings[image_id]) {
                    delete this.cached_image_settings[image_id];
                }
            });
        } else {
            this.cached_image_settings = {};
        }
    }

    /**
     * Convenience or short hand way of publishing via the internal eventbus.
     * It will just delegate whatever you hand it as arguments
     *
     * @memberof Context
     */
    publish() {
        if (this.prevent_event_notification) return;
        this.eventbus.publish.apply(this.eventbus, arguments);
    }

    /**
     * Retrieves initial request parameter by key
     *
     * @param {string} key the key
     * @return {string|null} returns the value associated with the key or null
     * @memberof Context
     */
    getInitialRequestParam(key) {
        if (typeof key !== 'string' ||
            typeof this.initParams !== 'object') return null;

        key = key.toUpperCase();
        if (typeof this.initParams[key] === 'undefined' ||
            typeof this.initParams[key] === null) return null;

        return this.initParams[key];
    }

    /**
     * Returns whether the rois tab is active/selected
     *
     * @return {boolean} true if rois tab is active/selected, false otherwise
     * @memberof Context
     */
    isRoisTabActive() {
        return this.selected_tab === TABS.ROIS;
    }

    /**
     * Resets initial parameters
     *
     * @memberof Context
     */
    resetInitParams() {
        let omeroServerVersion =
            this.getInitialRequestParam(REQUEST_PARAMS.OMERO_VERSION);
        // empty all handed in params
        this.initParams = {};
        // keep omero server information
        this.initParams[REQUEST_PARAMS.OMERO_VERSION] = omeroServerVersion;
        // we do need our uri prefixes again
        this.prefixed_uris.forEach((value, key) => this.initParams[key] = value);
    }

    /**
     * Returns version information
     *
     * @return {string} the version
     * @memberof Context
     */
    getVersion() {
        return 'v' + this.getInitialRequestParam(REQUEST_PARAMS.VERSION);
    }

    /**
     * Returns a list of the image configs that contain the same image
     *
     * @param {number} image_id the image id
     * @param {number} exclude_config this config will be excluded
     * @return {Array.<ImageConfig>} the image configs that refer to the same image
     * @memberof Context
     */
    getImageConfigsForGivenImage(image_id, exclude_config = -1) {
        if (typeof image_id !== 'number' || isNaN(image_id)) return [];
        if (typeof exclude_config !== 'number' || isNaN(exclude_config))
            exclude_config = -1;

        let ret = [];
        for (let [id, conf] of this.image_configs) {
            if (id === exclude_config ||
                !(conf.image_info instanceof ImageInfo) ||
                conf.image_info.image_id !== image_id) continue;
            ret.push(conf);
        }
        return ret;
    }

    /**
     * Returns all configs that relate to the given image id
     * and have modified regions data
     *
     * @param {number} image_id the image id
     * @return {Array.<number>} a list of config ids or an empty one
     * @memberof Context
     */
    findConfigsWithModifiedRegionsForGivenImage(image_id) {
        return this.findModifiedImageConfigsForGivenImage(image_id, true);
    }

    /**
     * Returns all configs that relate to the given image id
     * and have modified image settings
     *
     * @param {number} image_id the image id
     * @return {Array.<number>} a list of config ids or an empty one
     * @memberof Context
     */
    findConfigsWithModifiedImageSettingsForGivenImage(image_id) {
        return this.findModifiedImageConfigsForGivenImage(image_id);
    }

    /**
     * Returns all configs that relate to the given image id
     * and have modified image settings or regions
     *
     * @param {number} image_id the image id
     * @param {boolean} has_modified_regions
     *                  true if we are checking for modified regions.
     *                  if false we are checking for modified image settings
     * @return {Array.<number>} a list of config ids or an empty one
     * @private
     * @memberof Context
     */
    findModifiedImageConfigsForGivenImage(image_id, has_modified_regions=false) {
        let ret = [];
        let sameImageConfs = this.getImageConfigsForGivenImage(image_id);
        for (let c in sameImageConfs) {
            let conf = sameImageConfs[c];
            if ((has_modified_regions &&
                conf.regions_info && conf.regions_info.hasBeenModified()) ||
                (!has_modified_regions && conf.image_info.can_annotate &&
                    conf.canUndo())) {
                        ret.push(conf.id);
            }
        }
        return ret;
    }

    /**
     * Reload image info for all image configs that have the same parent
     *
     * @param {number} parent_id the parent id
     * @param {number} parent_type the parent type, e.g. INITIAL_TYPES.DATASET
     * @param {number} exclude_config if given this config will be excluded
     * @memberof Context
     */
    reloadImageConfigsGivenParent(parent_id, parent_type, exclude_config = -1) {
        if (typeof exclude_config !== 'number' || isNaN(exclude_config))
            exclude_config = -1;

        for (let [id, conf] of this.image_configs) {
            if (id === exclude_config ||
                !(conf.image_info instanceof ImageInfo) ||
                conf.image_info.parent_type !== parent_type ||
                conf.image_info.parent_id !== parent_id) continue;

            this.reloadImageConfig(conf, IMAGE_CONFIG_RELOAD.IMAGE);
        }
    }

    /**
     * Reload image/regions for a given image id
     *
     * @param {number} image_id the image id
     * @param {number} what the number designating what should be reloaded
     * @param {number} exclude_config if given this config will be excluded
     * @param {Array|Object} data data that should be used for reload
     * @memberof Context
     */
    reloadImageConfigForGivenImage(image_id, what, exclude_config = -1, data = null) {
        let sameImageConfs =
            this.getImageConfigsForGivenImage(image_id, exclude_config);
        for (let c in sameImageConfs)
            this.reloadImageConfig(sameImageConfs[c], what, data);
    }

    /**
     * Reload image/regions for given image config
     *
     * @param {ImageConfig|number} image_config the image config or its id
     * @param {number} what the number designating what should be reloaded
     * @param {Array|Object} data data that should be used for reload/sync
     * @memberof Context
     * @private
     */
    reloadImageConfig(image_config, what, data=null) {
        if (typeof image_config === 'undefined' || image_config === null ||
            typeof what !== 'number' || isNaN(what) ||
            (what !== IMAGE_CONFIG_RELOAD.IMAGE &&
             what !== IMAGE_CONFIG_RELOAD.REGIONS)) return;

        let conf = null;
        if (image_config instanceof ImageConfig)
            conf = image_config;
        else if (typeof image_config === 'number')
            conf = this.getImageConfig(image_config);
        if (conf === null || !(conf.image_info instanceof ImageInfo) ||
            (what === IMAGE_CONFIG_RELOAD.REGIONS &&
                (!(conf.regions_info instanceof RegionsInfo) ||
                 !conf.regions_info.ready))) return;

        switch (what) {
            case IMAGE_CONFIG_RELOAD.IMAGE:
                conf.image_info.refresh = true;
                conf.resetHistory();
                conf.image_info.requestData(true);
                break;
            case IMAGE_CONFIG_RELOAD.REGIONS:
                if (Misc.isArray(data)) conf.regions_info.setData(data);
                else conf.regions_info.requestData(true);
                break;
        }
    }

    /**
     * Saves all image settings that can and need to be saved.
     * If there are any image settings that could not be saved
     * because they have been edited in multiple windows a corresponding
     * list is returned.
     *
     * @return {Array.<string>} a list of images that couldn't be saved
     * @memberof Context
     */
    saveAllImageSettings() {
        let multipleEdits = [];
        let thumbNailsToUpdate = [];
        let counter = 0;

        for (let [id, conf] of this.image_configs) {
            // preliminary checks
            if (!conf.image_info.ready || !conf.image_info.can_annotate ||
                !conf.canUndo()) continue;
            let imgId = conf.image_info.image_id;
            let sameImageModified =
                this.findConfigsWithModifiedImageSettingsForGivenImage(imgId);
            // check if same image was edited in more than one config
            if (sameImageModified.length > 1) {
                if (multipleEdits.indexOf(conf.image_info.image_name) === -1)
                    multipleEdits.push(conf.image_info.image_name);
                continue;
            }
            thumbNailsToUpdate.push(imgId);
            conf.saveImageSettings(() => {
                counter++;
                conf.resetHistory();
                this.publish(IMAGE_SETTINGS_REFRESH, {config_id : conf.id});
                if (this.useMDI) {
                    this.reloadImageConfigForGivenImage(
                        imgId, IMAGE_CONFIG_RELOAD.IMAGE, conf.id);
                }
                if (thumbNailsToUpdate.length === counter)
                    this.publish(THUMBNAILS_UPDATE, {ids: thumbNailsToUpdate});
            });
        }

        return multipleEdits;
    }
}
