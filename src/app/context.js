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
import ImageConfig from '../model/image_config';
import {
    APP_NAME, IVIEWER, INITIAL_TYPES, LUTS_NAMES, LUTS_PNG_URL, PLUGIN_NAME,
    PLUGIN_PREFIX, REQUEST_PARAMS, TABS, URI_PREFIX, WEB_API_BASE, WEBCLIENT,
    WEBGATEWAY
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
    useMDI = true;

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
      * e.g.: key: 65, value: {func: this.selectAllShapes, args: [true]}
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
      * the lookup png
      *
      * @memberof Context
      * @type {Object}
      */
     luts_png = {
         url : '',
         height : 0
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
                this.addImageConfig(e.state.image_id, e.state.dataset_id);
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
        this.luts_png.url =
            this.server + this.getPrefixedURI(WEBGATEWAY, true) + LUTS_PNG_URL;

        // determine the luts png height
        let lutsPng = new Image();
        lutsPng.onload = (e) => {
            this.luts_png.height = e.target.naturalHeight;
            for (let [id, conf] of this.image_configs) conf.changed();
        }
        lutsPng.src = this.luts_png.url;

        // now query the luts list
        let server = this.server;
        let uri_prefix =  this.getPrefixedURI(WEBGATEWAY);
        $.ajax(
            {url : server + uri_prefix + "/luts/",
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    !Misc.isArray(response.luts)) return;

                let i=0;
                response.luts.map(
                    (l) => {
                        let isInList = LUTS_NAMES.indexOf(l.name) !== -1;
                        let mapValue =
                            Object.assign({
                                nice_name :
                                    l.name.replace(/.lut/g, "").replace(/_/g, " "),
                                index : isInList ? i : -1
                            }, l);
                        this.luts.set(mapValue.name, mapValue);
                        if (isInList) i++;
                    });
                for (let [id, conf] of this.image_configs) conf.changed();
            }
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
        // do we have an intial image id
        let initial_image_id =
            typeof this.initParams[REQUEST_PARAMS.IMAGE_ID] !== 'undefined' ?
            parseInt(this.initParams[REQUEST_PARAMS.IMAGE_ID]) : null;
        // we set the initial type and add the image id
        if (typeof initial_image_id === 'number' && !isNaN(initial_image_id)) {
            delete this.initParams[REQUEST_PARAMS.IMAGE_ID];
            this.initial_type = INITIAL_TYPES.IMAGE;
        }

        // do we have a list of image ids
        let initial_image_ids =
            typeof this.initParams[REQUEST_PARAMS.IMAGES] !== 'undefined' ?
                this.initParams[REQUEST_PARAMS.IMAGES] : null;
        if (initial_image_ids) {
            let tokens = initial_image_ids.split(',');
            if (tokens.length > 0) {
                let initialIdCount = this.initial_ids.length;
                tokens.map((tok) => {
                    let parsedToken = parseInt(tok);
                    if (typeof parsedToken === 'number' && !isNaN(parsedToken))
                        this.initial_ids.push(parsedToken);
                });
                if (this.initial_ids.length > initialIdCount)
                    this.initial_type = INITIAL_TYPES.IMAGES;
            }
        }

        // do we have an initial dataset id
        let initial_dataset_id =
            parseInt(
                this.getInitialRequestParam(REQUEST_PARAMS.DATASET_ID));
        if (typeof initial_dataset_id !== 'number' || isNaN(initial_dataset_id))
            initial_dataset_id = null;

        // add image config if we have image ids
        if (this.initial_type === INITIAL_TYPES.IMAGES &&
            this.initial_ids.length > 0)
                this.addImageConfig(this.initial_ids[0], initial_dataset_id);
        else if (this.initial_type === INITIAL_TYPES.IMAGE)
            this.addImageConfig(initial_image_id, initial_dataset_id);
        else if (initial_dataset_id) {
            this.initial_type = INITIAL_TYPES.DATASET;
            this.initial_ids = [initial_dataset_id];
        }
    }

    /**
     * Queries whether a lut by the given name is in our map
     *
     * @param {string} name the lut name
     * @param {boolean} true if the lut was found, false otherwise
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
        let server = this.initParams[REQUEST_PARAMS.SERVER];
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
        delete this.initParams[REQUEST_PARAMS.SERVER];

        let interpolate =
            typeof this.initParams[REQUEST_PARAMS.INTERPOLATE] === 'string' ?
                this.initParams[REQUEST_PARAMS.INTERPOLATE].toLowerCase() : 'true';
        this.interpolate = (interpolate === 'true');
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
     * Adjustments that are necessary if we are running under the
     * webpack dev server
     * @memberof Context
     */
    tweakForDevServer() {
        this.is_dev_server = true;
        this.prefixed_uris.set(IVIEWER, "");
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
                // only process command key combinations
                // and if target is an input field,
                // we do not wish to override either
                if (!event[command] ||
                    event.target.nodeName.toUpperCase() === 'INPUT') return;

                let keyHandlers = this.key_listeners.get(event.keyCode);
                if (keyHandlers) {
                    // we allow the browser's default action and event
                    // bubbling unless one handler returns false
                    let allowDefaultAndPropagation = true;
                    try {
                        for (let action in keyHandlers)
                            if (!((keyHandlers[action])(event)))
                                allowDefaultAndPropagation = false;
                    } catch(ignored) {}
                    if (!allowDefaultAndPropagation) {
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                }
            };
    }

    /**
     * Registers an app wide key handler for individual keys for onkeydown
     * Multiple actions for one key are posssible under the prerequisite
     * that a respective group be used for distinguishing
     *
     * @memberof Context
     * @param {number} key the numeric key code to listen for
     * @param {function} action a function
     * @param {string} group a grouping, default: 'global'
     */
    addKeyListener(key, action, group = 'global') {
        // some basic checks as to validity of key and key_handler_def
        // we need a numeric key and a function at a minimum
        if (typeof key !== 'number' || typeof action !== 'function') return;

        // we allow multiple actions for same key but different groups,
        // i.e. undo/redo, copy/paste, save for settings/rois
        let keyActions = this.key_listeners.get(key);
        if (keyActions) keyActions[group] = action
        else this.key_listeners.set(key, {group: action});
    }

    /**
     * Unregisters a keydown handler for a particular key (with group)
     *
     * @param {number} key the key code associated with the listener
     * @param {string} group a grouping, default: 'global'
     * @memberof Context
     */
    removeKeyListener(key, group='global') {
        if (typeof key !== 'number') return;
        let keyActions = this.key_listeners.get(key);
        if (keyActions) {
            delete keyActions[group];
            let noHandlersLeft = true;
            for(let k in keyActions)
                if (typeof keyActions[k] === 'function') {
                    noHandlersLeft = false;
                    break;
                }
            if (noHandlersLeft) this.key_listeners.delete(key);
        }
    }

    rememberImageConfigChange(image_id, dataset_id) {
        if (!this.hasHTML5HistoryFeatures() ||
            this.getSelectedImageConfig() === null) return;

        let old_image_id =
            this.getSelectedImageConfig().image_info.image_id;
        let oldPath = window.location.pathname;
        let newPath =
            oldPath.replace(old_image_id, image_id);
        if (this.initial_type === INITIAL_TYPES.IMAGE &&
            typeof dataset_id === 'number') newPath += '?dataset=' + dataset_id;
        else if (this.initial_type === INITIAL_TYPES.IMAGES)
            newPath += window.location.search;
        if (this.is_dev_server) {
            newPath += (newPath.indexOf('?') === -1) ? '?' : '&';
            newPath += 'haveMadeCrossOriginLogin_';
        }
        window.history.pushState(
            {image_id: image_id, dataset_id: dataset_id},"",newPath);
    }

    /**
     * Creates and adds an ImageConfig instance by handing it an id of an image
     * stored on the server, as well as making it the selected/active image config.
     *
     * @memberof Context
     * @param {number} image_id the image id
     * @param {number} dataset_id an optional dataset_id
     */
    addImageConfig(image_id, dataset_id) {
        if (typeof image_id !== 'number' || image_id < 0) return;

        // we do not keep the other configs around unless we are in MDI mode.
        if (!this.useMDI)
            for (let [id, conf] of this.image_configs)
                this.removeImageConfig(id,conf)

        let image_config = new ImageConfig(this, image_id, dataset_id);
        // store the image config in the map and make it the selected one
        this.image_configs.set(image_config.id, image_config);
        this.selectConfig(image_config.id);
        image_config.bind();
    }

    /**
     * Removes an image config from the internal map.
     * We can hand it either the id or a reference to itself
     *
     * @memberof Context
     * @param {ImageConfig|number} image_config_or_id id or ImageConfig
     */
    removeImageConfig(image_config_or_id) {
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
        if (selId && selId === conf.id) this.selected_config = null;
        // if in mdi, select another open config
        if (this.useMDI && this.image_configs.size > 0)
            this.selected_config = this.image_configs.keys().next().value;

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
        if (typeof id !== 'number' || id < 0 ||
            !(this.image_configs.get(id) instanceof ImageConfig) ||
            this.selected_config === id) return;

        this.selected_config = id;
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
     * Convenience or short hand way of publishing via the internal eventbus.
     * It will just delegate whatever you hand it as arguments
     *
     * @memberof Context
     */
    publish() {
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
        // empty all handed in params
        this.initParams = {};
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
}
