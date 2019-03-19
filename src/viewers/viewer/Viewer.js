//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import OlObject from 'ol/Object';
import MapEventType from 'ol/MapEventType';
import Geometry from 'ol/geom/Geometry';
import GeometryType from 'ol/geom/GeometryType';
import Polygon from 'ol/geom/Polygon';
import {fromExtent as polygonFromExtent} from 'ol/geom/Polygon.js';
import {listen, unlistenByKey} from 'ol/events';
import Collection from 'ol/Collection';
import Feature from 'ol/Feature';
import Projection from 'ol/proj/Projection';
import Tile from 'ol/layer/Tile';
import Vector from 'ol/layer/Vector';
import View from 'ol/View';
import OlMap from 'ol/Map';
import {intersects, getCenter} from 'ol/extent';
import {noModifierKeys, primaryAction} from 'ol/events/condition';

import Draw from './interaction/Draw';
import ShapeEditPopup from './controls/ShapeEditPopup';
import {checkAndSanitizeServerAddress,
    isSameOrigin,
    sendRequest,
    makeCrossDomainLoginRedirect} from './utils/Net';
import {generateRegions} from './utils/Regions';
import {modifyStyles,
    updateStyleFunction} from './utils/Style';
import Label from './geom/Label';
import {AVAILABLE_VIEWER_INTERACTIONS,
    AVAILABLE_VIEWER_CONTROLS,
    WEBGATEWAY,
    PLUGIN_PREFIX,
    REQUEST_PARAMS,
    DEFAULT_TILE_DIMS,
    REGIONS_MODE,
    REGIONS_STATE,
    DIMENSION_LOOKUP,
    PREFIXED_URIS,
    defaultInteractions,
    defaultControls} from './globals';
import {isArray,
    parseProjectionParameter,
    parseChannelParameters,
    sendEventNotification,
    prepareResolutions,
    getTargetId} from './utils/Misc';
import {integrateStyleIntoJsonObject,
    integrateMiscInfoIntoJsonObject,
    toJsonObject,
    featureToJsonObject,
    LOOKUP} from './utils/Conversion';
import OmeroImage from './source/Image';
import Regions from './source/Regions';
import Mask from './geom/Mask';

/**
 * @classdesc
 * Viewer is the central object to view images served by the Omero Server.
 * In its simplest form it takes an id to display the associated image:
 *
 * <pre>
 * var omeImgViewer = new Viewer(1);
 * </pre>
 *
 * The constructor takes an object as its second parameter to set further options.
 * You can override the server location (server) which by default is relative (same origin)
 * as well as the html element which contains the viewer (default: 'ome_ol3_viewer')
 * Furthermore you can hand in an EventBus instance to publish/subscribe to
 * events for other ui components
 *
 * e.g.
 * <pre>
 * var omeImgViewer = new Viewer(1
 *    { eventbus: eventbus_instance,
 *      server: 'https://myomeroserver',
 *      initParams : {'m' : 'c'},
 *      container: 'somedivsid'});
 *</pre>
 *
 * Moreover, by default the viewer does not add any controls to the viewer.
 * As far as interactions go, the only ones enabled, by default, are pan & zoom.
 *
 * The controls and interactions can be set programmatically by calling the respective methods,
 * such as:
 *<pre>
 * omeImgViewer.addControl("fullscreen");
 * omeImgViewer.addInteraction("draw");
 *</pre>
 *
 * @extends {ol.Object}
 */
class Viewer extends OlObject {

    /**
    * @constructor
    *
    * @param {number} id an image id
    * @param {Object.<string, *>=} options additional properties (optional)
    */
    constructor(id, options) {
    
        super();

        var opts = options || {};

        /**
         * the image id
         *
         * @type {number}
         * @private
         */
        this.id_ = id || -1;
        try {
            this.id_ = parseInt(this.id_);
        } catch(not_a_number) {
            id = -1;
        }

        /**
         * an omero server address given as a fully qualified address
         * https://some_host:[some_port]
         *
         * if not supplied we use relative to what our location is which is the best
         * solution for same origin anyhow.
         *
         * after input sanitization we end up with a server info object
         *
         * @type {Object}
         * @private
         */
        this.server_ = checkAndSanitizeServerAddress(opts['server'] || "");

        /**
         * some initial values/parameters for channel, model and projection (optional)
         *
         * @type {Object}
         * @private
         */
        this.initParams_ = opts['initParams'] || {};

        /**
         * a list of (possibly prefixed) uris for lookup
         * @type {Object}
         * @private
         */
        this.prefixed_uris_ = {};
        this.readPrefixedUris(this.initParams_);

        /**
         * because of async wait until map has been instatiated, an addRegions call
         * might not be able to execute successfully. this flag tells us so that
         * we can make one once the map initialization has finished
         * @type {boolean}
         * @private
         */
        this.tried_regions_ = false;

        /**
         * any handed in regions data when we tried the regions (see tried_regions_)
         * @type {Array.<Object>}
         * @private
         */
        this.tried_regions_data_ = false;

        /**
         * the viewer's sync group
         * @type {string|null}
         * @private
         */
        this.sync_group_ = null;

        /**
         * a flag that's only relevant if the server is not same orgin.
         * then we have to go different ways to redirect the user to the server login.
         * this flag reminds us if we've done so or still need to do so, i.e. if we
         * have a supposed session or not.
         *
         * @type {boolean}
         * @private
         */
        this.haveMadeCrossOriginLogin_ = isSameOrigin(this.server_) ? true : false;
        if (!this.haveMadeCrossOriginLogin_ &&
            window['location']['href'].indexOf("haveMadeCrossOriginLogin_") !== -1)
            this.haveMadeCrossOriginLogin_ = true;

        /**
         * the id of the element serving as the container for the viewer
         * @type {string}
         * @private
         */
        this.container_ = "ome-viewer";
        if (typeof(opts['container']) === 'string')
            this.container_ = opts['container'];

        /**
         * the associated image information as retrieved from the omero server
         * @type {Object}
         * @private
         */
        this.image_info_ = typeof opts['data'] === 'object' ? opts['data'] : null;

        /**
         * the associated OmeroRegions object
         * @type {Regions}
         * @private
         */
        this.regions_ = null;

        /**
         * the 'viewer state', i.e. the controls and interactions that were added
         * the items in the map have the following layout
         * <pre>
         *  "key" : { type : "interaction/control", ref : reference_to_instance}
         * </pre>
         *
         * IMPORTANT:
         * <ul>
         * <li>The key has to be the same as in {@link AVAILABLE_VIEWER_INTERACTIONS} or
         * {@link AVAILABLE_VIEWER_CONTROLS}</li>
         * <li>The type has to be: 'interaction' or 'control'</li>
         * <li>The reference has to exist so that the component can be individually unregistered</li>
         * </ul>
         *
         * @type {Object}
         * @private
         */
        this.viewerState_ = {};

        /**
         * the viewer instance
         *
         * @type {ol.Map}
         * @private
         */
        this.viewer_ = null;

        /**
         * an EventBus instance
         *
         * @type {EventBus}
         * @private
         */
        this.eventbus_ =
            typeof opts['eventbus'] === 'object' &&
            typeof  opts['eventbus']['publish'] === 'function' ?
            opts['eventbus'] : null;

        /**
         * a flag to indicate the no events should be sent
         *
         * @type {boolean}
         * @private
         */
        this.prevent_event_notification_ = false;

        /**
         * Checks whether a given omero server version is supported.
         * It is if the given server version is equal or greater to the
         * presently used omero server.
         * The given version is accepted in 2 notations:
         * - a three digit number (omitting the dots)
         * - a string (including dots or not)
         *
         * @function
         * @param {string|number} version the minimal version to check against
         * @return {boolean} true if the given version is suppored, false otherwise
         */
        this.supportsOmeroServerVersion = function(version) {
            if (typeof version === 'number') {
                version = '' + version;
            } else if (typeof version !== 'string') return false;

            // strip off dots and check length
            version = parseInt(version.replace(/[.]/g, ""));
            if (isNaN(version) || ('' + version).length !== 3) return false;

            // check against actual version
            let actual_version =
                this.getInitialRequestParam(REQUEST_PARAMS.OMERO_VERSION);
            if (typeof actual_version !== 'string') return false;
            actual_version = parseInt(actual_version.replace(/[.]/g, ""));
            if (isNaN(actual_version)) return false;

            return actual_version >= version;
        }

        /**
         * The initialization function performs the following steps:
         * 1. Request image data as json (if not handed in)
         * 2. Store the image data internally (if not handed in)
         * 3. Bootstrap ol3 map (and associated objects such as view, controls, etc)
         *
         * Note: Step 3 happens asynchroniously (if data had to be fetched via ajax)
         *
         * @function
         * @param {Object} scope the java script context
         * @param {?function} postSuccessHook an optional post success handler
         * @param {?function} initHook an optional initialization handler
         * @private
         */
        this.initialize_ = function(postSuccessHook, initHook) {
            // can happen if we instantitate the viewer without id
            if (this.id_ < 0) return;

            // use handed in image info instead of requesting it
            if (this.image_info_ !== null) {
                this.bootstrapOpenLayers(postSuccessHook, initHook);
                return;
            }

            // the success handler instantiates the open layers map and controls
            var success = function(data) {
                if (typeof(data) === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch(parseError) {
                        console.error("Failed to parse json response!");
                    }
                }
                if (typeof(data) !== 'object') {
                    console.error("Image Request did not receive proper response!");
                    return;
                }
                // store response internally to be able to work with it later
                this.image_info_ = data;

                // delegate
                this.bootstrapOpenLayers(postSuccessHook, initHook);
            }.bind(this);

            // define request settings
            var reqParams = {
                "server" : this.getServer(),
                "uri" : this.getPrefixedURI(WEBGATEWAY) +
                    '/imgData/' + this.id_,
                "jsonp" : true, // this will only count if we are cross-domain
                "success" : success,
                "error" : function(error) {
                    console.error("Error retrieving image info for id: " +
                        this.id_ +
                        ((error && error.length > 0) ? (" => " + error) : ""));
                }.bind(this)
            };

            // send request
            sendRequest(reqParams);
        };

        // execute initialization function
        // for cross domain we check whether we need to have a login made, otherwise
        // we redirect to there ...
        if (isSameOrigin(this.server_) || this.haveMadeCrossOriginLogin_) {
            this.initialize_();
        } else makeCrossDomainLoginRedirect(this.server_);
    }

    /**
     * Bootstraps the Openlayers components
     * e.g. view, projection, map and any controls/interactions used
     *
     * @function
     * @param {?function} postSuccessHook an optional post success handler
     * @param {?function} initHook an optional initialization handler
     * @private
     */
    bootstrapOpenLayers(postSuccessHook, initHook) {
        if (typeof(this.image_info_['size']) === 'undefined') {
            console.error("Image Info does not contain size info!");
            return;
        }

        // we might need to run some initialization handler after we have
        // received the json respone.
        if (typeof initHook === 'function') initHook.call(this);

        /*
        * get dimensions of image: width,height, z, t and c sizes,
        * as well as zoom levels for pyramids
        * for openlayers we gotta prepare the resolutions
        * as 1 / res and reverse the order
        */
        var zoomLevelScaling = null;
        var dims = this.image_info_['size'];
        if (this.image_info_['zoomLevelScaling']) {
            var tmp = [];
            for (var r in this.image_info_['zoomLevelScaling'])
                tmp.push(1 / this.image_info_['zoomLevelScaling'][r]);
            zoomLevelScaling = tmp.reverse();
        }
        var zoom = zoomLevelScaling ? zoomLevelScaling.length : -1;

        // get the initial projection
        var initialProjection =
        this.getInitialRequestParam(
            REQUEST_PARAMS.PROJECTION);
        var parsedInitialProjection =
            parseProjectionParameter(
                initialProjection !== null ?
                    initialProjection.toLowerCase() :
                    this.image_info_['rdefs']['projection']);
        initialProjection = parsedInitialProjection.projection;

        // get the initial model (color/greyscale)
        var initialModel =
        this.getInitialRequestParam(REQUEST_PARAMS.MODEL);
        initialModel =
        initialModel !== null ? initialModel :
            this.image_info_['rdefs']['model']
        var lowerCaseModel = initialModel.toLowerCase()[0];
        switch (lowerCaseModel) {
            case 'c': initialModel = 'color'; break;
            case 'g': initialModel = 'greyscale'; break;
            default: initialModel = 'color';
        };

        // determine the center
        var defaultImgCenter = [dims['width'] / 2, -dims['height'] / 2];
        // pixel size
        var pixelSize =
        typeof this.image_info_['pixel_size'] === "object" &&
        typeof this.image_info_['pixel_size']['x'] === "number" ?
            this.image_info_['pixel_size']['x'] : null;

        // instantiate a pixel projection for omero data
        var proj = new Projection({
            code: 'OMERO',
            units: 'pixels',
            extent: [0, 0, dims['width'], dims['height']],
            metersPerUnit : pixelSize
        });

        // we might have some requested defaults
        var initialTime = this.getInitialRequestParam(REQUEST_PARAMS.TIME);
        initialTime = initialTime !== null ? (parseInt(initialTime)-1) :
        this.image_info_['rdefs']['defaultT'];
        if (initialTime < 0) initialTime = 0;
        if (initialTime >= dims.t) initialTime =  dims.t-1;
        var initialPlane = this.getInitialRequestParam(REQUEST_PARAMS.PLANE);
        initialPlane = initialPlane !== null ? (parseInt(initialPlane)-1) :
            this.image_info_['rdefs']['defaultZ'];
        if (initialPlane < 0) initialPlane = 0;
        if (initialPlane >= dims.z) initialPlane =  dims.z-1;
        var initialCenterX = this.getInitialRequestParam(REQUEST_PARAMS.CENTER_X);
        var initialCenterY = this.getInitialRequestParam(REQUEST_PARAMS.CENTER_Y);
        let imgCenter;
        if (initialCenterX && !isNaN(parseFloat(initialCenterX)) &&
                    initialCenterY && !isNaN(parseFloat(initialCenterY))) {
            initialCenterX = parseFloat(initialCenterX);
            initialCenterY = parseFloat(initialCenterY);
            // Restrict centre to within image bounds
            initialCenterX = Math.min(Math.max(0, initialCenterX), dims['width']);
            initialCenterY = Math.min(Math.max(0, initialCenterY), dims['height']);
            imgCenter = [initialCenterX, -initialCenterY];
        }
        var initialChannels = this.getInitialRequestParam(REQUEST_PARAMS.CHANNELS);
        var initialMaps = this.getInitialRequestParam(REQUEST_PARAMS.MAPS);
        initialChannels = parseChannelParameters(initialChannels, initialMaps);

        // copy needed channels info
        var channels = [];
        this.image_info_['channels'].forEach(function(oldC, c) {
        var newC = {
            "active" : oldC['active'],
            "label" : typeof oldC['label'] === 'string' ? oldC['label'] : c,
            "color" :
                typeof oldC['lut'] === 'string' &&
                oldC['lut'].length > 0 ? oldC['lut'] : oldC['color'],
            "min" : oldC['window']['min'],
            "max" : oldC['window']['max'],
            "start" : oldC['window']['start'],
            "end" : oldC['window']['end']
        };
        if (typeof oldC['inverted'] === 'boolean')
            newC['inverted'] = oldC['inverted'];
        if (typeof oldC['family'] === 'string' && oldC['family'] !== "" &&
            typeof oldC['coefficient'] === 'number' &&
            !isNaN(oldC['coefficient'])) {
                newC['family'] = oldC['family'];
                newC['coefficient'] = oldC['coefficient'];
        }
        channels.push(newC);
        });

        var isTiled =
            typeof this.image_info_['tiles'] === 'boolean' &&
                this.image_info_['tiles'];
        // create an OmeroImage source
        var source = new OmeroImage({
            server : this.getServer(),
            uri : this.getPrefixedURI(WEBGATEWAY),
            image: this.id_,
            width: dims['width'],
            height: dims['height'],
            plane: initialPlane,
            time: initialTime,
            channels: channels,
            resolutions: zoom > 1 ? zoomLevelScaling : [1],
            img_proj:  parsedInitialProjection,
            img_model:  initialModel,
            tiled: isTiled,
            tile_size: isTiled && this.supportsOmeroServerVersion("5.4.4") ?
                    DEFAULT_TILE_DIMS :
                        this.image_info_['tile_size'] ?
                            this.image_info_['tile_size'] : null
        });
        source.changeChannelRange(initialChannels, false);

        var defaultZoom = zoom > 1 ? zoomLevelScaling[0] : 1;
        var actualZoom;
        var initialZoom = this.getInitialRequestParam(REQUEST_PARAMS.ZOOM);
        var possibleResolutions = prepareResolutions(zoomLevelScaling);
        if (initialZoom && !isNaN(parseFloat(initialZoom))) {
            initialZoom = (1 / (parseFloat(initialZoom) / 100));
            var posLen = possibleResolutions.length;
            if (posLen > 1) {
                if (initialZoom >= possibleResolutions[0])
                    actualZoom = possibleResolutions[0];
                else if (initialZoom <= possibleResolutions[posLen-1])
                    actualZoom = possibleResolutions[posLen-1];
                else {
                    // find nearest resolution
                    for (var r=0;r<posLen-1;r++) {
                        if (initialZoom < possibleResolutions[r+1])
                            continue;
                        var d1 =
                            Math.abs(possibleResolutions[r] - initialZoom);
                        var d2 =
                            Math.abs(possibleResolutions[r+1] - initialZoom);
                        if (d1 < d2)
                            actualZoom = possibleResolutions[r];
                        else actualZoom = possibleResolutions[r+1];
                        break;
                    }
                }
            } else {
                actualZoom = 1;
            }
        }

        // we need a View object for the map
        var view = new View({
            projection: proj,
            center: defaultImgCenter,
            extent: [0, -dims['height'], dims['width'], 0],
            resolutions : possibleResolutions,
            resolution : defaultZoom,
            maxZoom: possibleResolutions.length-1
        });

        // we have a need to keep a list & reference of the controls
        // and interactions registered, therefore we need to take a
        // slighlty longer route to add them to the map
        var defaultInts = defaultInteractions();
        var interactions = new Collection();
        for (var inter in defaultInts) {
        interactions.push(defaultInts[inter]['ref']);
        this.viewerState_[inter] = defaultInts[inter];
        }
        var defaultConts = defaultControls();
        var controls = new Collection();
        for (var contr in defaultConts) {
        controls.push(defaultConts[contr]['ref']);
        this.viewerState_[contr] = defaultConts[contr];
        }

        // finally construct the open layers map object
        this.viewer_ = new OlMap({
            logo: false,
            controls: controls,
            interactions: interactions,
            layers: [new Tile({source: source})],
            target: this.container_,
            view: view
        });

        // enable bird's eye view
        var birdsEyeOptions = {
            'url': this.getPrefixedURI(WEBGATEWAY) +
                        '/render_thumbnail/' + this.id_,
            'size': [dims['width'], dims['height']],
            'collapsed': !source.use_tiled_retrieval_
        };
        this.addControl('birdseye', birdsEyeOptions);
        // tweak source element for fullscreen to include dim sliders (iviewer only)
        var targetId = this.getTargetId();
        var viewerFrame = targetId ? document.getElementById(targetId) : null;
        if (targetId && viewerFrame) {
            this.viewerState_["fullscreen"]['ref'].source_ = viewerFrame;
            this.viewerState_["dragPan"]['ref'].condition_ =
                function(e) {
                    // ignore right clicks (from context)
                    return noModifierKeys(e) && primaryAction(e);
                };
        }
        // enable scalebar by default
        this.toggleScaleBar(true);
        // enable intensity control
        this.toggleIntensityControl(true);

        // helper to broadcast a viewer interaction (zoom and drag)
        var notifyAboutViewerInteraction = function(viewer) {
            sendEventNotification(
                viewer, "IMAGE_VIEWER_INTERACTION", viewer.getViewParameters());
        };

        // get cached initial viewer center etc.
        if (this.image_info_['center'] || imgCenter || this.image_info_['resolution']
                || this.image_info_['rotation'] || actualZoom) {
            let center = this.image_info_['center'] || imgCenter;
            let resolution = this.image_info_['resolution'] || actualZoom;
            let rotation = this.image_info_['rotation'];
            // Need to wait for viewer to be built before this works:
            setTimeout(function() {
                this.setViewParameters(center, resolution, rotation);
            }.bind(this), 100)
        }

        // listens to resolution changes
        this.onViewResolutionListener =
        listen( // register a resolution handler for zoom display
            this.viewer_.getView(), "change:resolution",
            function(event) {
                this.displayResolutionInPercent();
                if (this.eventbus_) notifyAboutViewerInteraction(this);
            }, this);
        this.displayResolutionInPercent();
        // listen to rotation changes
        this.onViewRotationListener =
            listen(
                this.viewer_.getView(), "change:rotation",
                function(event) {
                    var regions = this.getRegions();
                    if (regions) regions.changed();
                    if (this.eventbus_) notifyAboutViewerInteraction(this);
                }, this);

        // this is for work that needs to be done after,
        // e.g we have just switched images
        // because of the asynchronious nature of the initialization
        // we need to do this here
        if (typeof(postSuccessHook) === 'function')
        postSuccessHook.call(this);

        if (this.tried_regions) this.addRegions();

        if (this.eventbus_) {
        // an endMove listener to publish move events
        this.onEndMoveListener =
            listen(
                this.viewer_, MapEventType.MOVEEND,
                function(event) {
                    notifyAboutViewerInteraction(this);
                }, this);
        }
    }

    /**
     * Shows the viewer
     */
    show() {
        var viewerElement = document.getElementById(this.container_);
        if (viewerElement) viewerElement.style.visibility = "visible";
    }

    /**
     * Hides the viewer
     */
    hide() {
        var viewerElement = document.getElementById(this.container_);
        if (viewerElement) viewerElement.style.visibility = "hidden";
    }

    /**
     * Creates an OmeroRegions instance and stores its reference internally
     * with everything that that entails, i.e. an omero server request for rois.
     *
     * Note, however, that for general drawing ability this method has to be called
     * before any drawing interaction is possible regardless of whether the image
     * has existing rois associated with it or not!
     *
     * Important: Calling this method twice or more times will have no effect if
     * there is a regions instance present already.
     *
     * Note: Because of asynchronous viewer initialization this method can be called
     * at a moment in time that the viewer has not been fully initialized in which
     * case we make a note (flag: tried_regions_) and remember any handed in
     * regions data which will be picked up at the end of the initialization process
     * when the tried_regions_ flag is checked.
     *
     * Should you want to hide the regions, once created, call:
     * [setRegionsVisibility]{@link Viewer#setRegionsVisibility} passing in: false
     *
     * If, indeed, you wish to remove the regions layer use:
     * [removeRegions]{@link Viewer#removeRegions} but bear in mind that this requires a call to
     * [addRegions]{@link Viewer#addRegions} again if you want it back which is more expensive
     * than toggling visibility
     *
     * @param {Array=} data regions data (optional)
     */
    addRegions(data) {
        // without a map, no need for a regions overlay...
        if (!(this.viewer_ instanceof OlMap)) {
            this.tried_regions_ = true;
            if (isArray(data))
                this.tried_regions_data_ = data;
            return;
        }
        this.tried_regions_ = false;
        this.tried_regions_data_ = null;
        if (this.regions_ instanceof Regions) return;

        var options = {};
        if (data) options['data'] = data;
        // Regions constructor creates ol.Features from JSON data
        this.regions_ = new Regions(this, options);

        // add a vector layer with the regions
        if (this.regions_) {
            this.viewer_.addLayer(new Vector({source : this.regions_}));
            // enable roi selection by default,
            // as well as modify and translate
            this.regions_.setModes(
                [REGIONS_MODE['SELECT'],
                REGIONS_MODE['MODIFY'],
                REGIONS_MODE['TRANSLATE']]);
        }

        //Overlay to show a popup for editing shapes (adds itself to map)
        new ShapeEditPopup(this.regions_);
    }

    /**
     * Toggles the visibility of the regions/layer.
     * If a non-empty array of rois is handed in, only the listed regions will be affected,
     * otherwise the entire layer
     *
     * @param {boolean} visible visibitily flag (true for visible)
     * @param {Array<string>} roi_shape_ids a list of string ids of the form: roi_id:shape_id
     */
    setRegionsVisibility(visible, roi_shape_ids) {
        // without a regions layer there will be no regions to hide...
        var regionsLayer = this.getRegionsLayer();
        if (regionsLayer) {
            var flag = visible || false;

            if (!isArray(roi_shape_ids) || roi_shape_ids.length === 0)
                regionsLayer.setVisible(flag);
            else
                this.getRegions().setProperty(roi_shape_ids, "visible", flag);
        }
    }

    /**
     * Toggles the visibility of the regions/layer.
     * If a non-empty array of rois is handed in, only the listed regions will be affected,
     * otherwise the entire layer
     *
     * @param {boolean} flag if true we are displaying the text (if there), otherwise no
     */
    showShapeComments(flag) {
        // without a regions layer there will be no regions to hide...
        var regions = this.getRegions();
        if (regions && typeof flag === 'boolean') {
            regions.show_comments_ = flag;
            regions.changed();
        }
    }

    /**
     * Enable or disable the showing of a Popup to edit selected shapes.
     *
     * @param {boolean} flag
     */
    enableShapePopup(flag) {
        var regions = this.getRegions();
        if (regions) {
            regions.enable_shape_popup = flag;
        }
    }

    /**
     * Marks given shapes as selected, clearing any previously selected if clear flag
     * is set. Optionally the view centers on a given shape.
     *
     * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
     * @param {boolean} selected flag whether we should (de)select the rois
     * @param {boolean} clear flag whether we should clear existing selection beforehand
     * @param {string|null} center the id of the shape to center on or null
     */
    selectShapes(
        roi_shape_ids, selected, clear, center) {
        // without a regions layer there will be no select of regions ...
        var regions = this.getRegions();
        if (regions === null || regions.select_ === null) return;

        if (typeof clear === 'boolean' && clear) regions.select_.clearSelection();
        regions.setProperty(roi_shape_ids, "selected", selected);

        if (typeof center === 'string' &&
            typeof regions.idIndex_[center] === 'object')
                this.centerOnGeometry(regions.idIndex_[center].getGeometry());
    }

    /**
     * Marks given shapes as selected. The center flag is only considered if we
     * have a single shape only
     *
     * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
     * @param {boolean} undo if true we roll back, default: false
     * @param {function=} callback a success handler
     */
    deleteShapes(roi_shape_ids, undo, callback) {
        // without a regions layer there will be no select of regions ...
        var regions = this.getRegions();
        if (regions === null) return;

        regions.setProperty(
            roi_shape_ids, "state",
            typeof undo === 'boolean' && undo ?
                REGIONS_STATE.ROLLBACK : REGIONS_STATE.REMOVED,
            typeof callback === 'function' ? callback : null);
    }

    /**
     * Centers view on the middle of a geometry
     * optionally zooming in on a given resolution
     *
     * @param {ol.geom.Geometry} geometry the geometry
     * @param {number=} resolution the resolution to zoom in on
     */
    centerOnGeometry(geometry, resolution) {
        if (!(geometry instanceof Geometry)) return;

        // only center if we don't intersect the viewport
        if (intersects(
                geometry.getExtent(),
                this.viewer_.getView().calculateExtent())) return;

        // use given resolution for zoom
        if (typeof resolution === 'number' && !isNaN(resolution)) {
            var constrainedResolution =
                this.viewer_.getView().constrainResolution(resolution);
            if (typeof constrainedResolution === 'number')
                this.viewer_.getView().setResolution(constrainedResolution);
        }

        // center (taking into account potential rotation)
        var rot = this.viewer_.getView().getRotation();
        if (geometry.getType() === GeometryType.CIRCLE) {
            var ext = geometry.getExtent();
            geometry = polygonFromExtent(ext);
            geometry.rotate(rot, getCenter(ext));
        }
        var coords = geometry.getFlatCoordinates();
        var cosine = Math.cos(-rot);
        var sine = Math.sin(-rot);
        var minRotX = +Infinity;
        var minRotY = +Infinity;
        var maxRotX = -Infinity;
        var maxRotY = -Infinity;
        var stride = geometry.getStride();
        for (var i = 0, ii = coords.length; i < ii; i += stride) {
            var rotX = coords[i] * cosine - coords[i + 1] * sine;
            var rotY = coords[i] * sine + coords[i + 1] * cosine;
            minRotX = Math.min(minRotX, rotX);
            minRotY = Math.min(minRotY, rotY);
            maxRotX = Math.max(maxRotX, rotX);
            maxRotY = Math.max(maxRotY, rotY);
        }
        sine = -sine;
        var centerRotX = (minRotX + maxRotX) / 2;
        var centerRotY = (minRotY + maxRotY) / 2;
        var centerX = centerRotX * cosine - centerRotY * sine;
        var centerY = centerRotY * cosine + centerRotX * sine;
        this.viewer_.getView().setCenter([centerX, centerY]);
    }

    /**
     * Removes the regions from the viewer which is a multi step procedure
     * that involves destroying the OmeroRegions instance as well as the open
     * layer's vector layer
     *
     */
    removeRegions() {
        // without an existing instance no need to destroy it...
        if (this.regions_ instanceof Regions) {
            // reset mode which will automatically deregister interactions
            this.regions_.setModes([REGIONS_MODE['DEFAULT']]);
            // dispose of the internal OmeroRegions instance
            this.regions_.dispose();
            this.regions_ = null;
        }

        var regionsLayer = this.getRegionsLayer();
        if (regionsLayer) {
            //remove everything down to the image layer
            var len = this.viewer_.getLayers().getLength();
            for (var i=len-1; i > 0;i--) {
                var l = this.viewer_.getLayers().item(i);
                l.setSource(null);
                l.sourceChangeKey_ = null;
                this.viewer_.getLayers().removeAt(i);
            }
        }
    }

    /**
     * Sets the behavior for text in the regions layer.
     * see: [setRotateText & setScaleText{@link Regions#setRotateText}
     *
     * @param {boolean=} scaleText flag whether text should be scaled with view resolution
     * @param {boolean=} rotateText flag whether text should be rotated with view resolution
     */
    setTextBehaviorForRegions(scaleText, rotateText) {
        // without a regions layer there will be no regions to hide...
        if (this.getRegionsLayer()) {
            this.getRegions().setScaleText(scaleText);
            this.getRegions().setRotateText(rotateText);
        }
    }

    /**
     * Adds an interaction to the viewer.
     * Note: the interaction will only be added if it hasn't been added before
     * Use the key listed here: {@link AVAILABLE_VIEWER_INTERACTIONS}
     * <p>The version with the second argument can be used to sort of bypass the factory
     * for cases where one wants to hand in an already existing interaction</p>
     *
     * @param {string} key the unique interaction key
     * @param {Object} interaction an object that is an interaction
     */
    addInteraction(key, interaction) {
        // if we have no interaction given as the second argument => delegate to the factory
        if (typeof interaction !== 'object' || interaction === null) {
            this.addInteractionOrControl(key, 'interaction', true);
            return;
        }

        // we do have to have the key listed in the AVAILABLE_VIEWER_INTERACTIONS
        var availableInteraction =
            typeof AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
                AVAILABLE_VIEWER_INTERACTIONS[key] : null;
        // the given interaction has to also match the clazz
        // of the one registered under that key
        if (availableInteraction == null || !(interaction instanceof availableInteraction['clazz']))
            return;

        // if we don't have an instance in our viewer state, we return
        if (!(this.viewer_ instanceof OlMap) || // could be the viewer was not initialized
                    (typeof(key) !== 'string')) // key not a string
                        return;

        if (typeof this.viewerState_[key] === 'object')
            return;  // control/interaction already registered

        // now we can safely add the interaction
        this.viewer_.addInteraction(interaction);
        this.viewerState_[key] =
            {"type": 'interaction', "ref": interaction,
            "defaults" : false,
            "links" : []};
    }


    /**
     * Adds a control to the viewer.
     * Note: the control will only be added if it hasn't been added before
     * Use the key listed here: {@link AVAILABLE_VIEWER_CONTROLS}
     *
     * @param {string} key the unique control key
     * @param {Object=} options (optional) options for control
     */
    addControl(key, options) {
        // delegate
        this.addInteractionOrControl(key, "control", true, options);
    }

    /**
     * Adds a control/interaction to the viewer. Internal convience method
     *
     * for interaction keys see: {@link AVAILABLE_VIEWER_INTERACTIONS}
     * for control keys see: {@link AVAILABLE_VIEWER_CONTROLS}
     *
     * @private
     * @param {string} type whether it's an interaction or a control
     * @param {string} key the unique interaction or control key
     * @param {boolean} descend a flag whether we should follow linked interactions/controls
     * @param {Object=} options (optional) options for control
     */
    addInteractionOrControl(key, type, descend, options) {
        if (!(this.viewer_ instanceof OlMap) || // could be the viewer was not initialized
            (typeof(key) !== 'string') || // key not a string
            (typeof(type) !== 'string')) return; // type is not a string

        if (typeof this.viewerState_[key] === 'object')
            return;  // control/interaction already registered

        var followLinkedComponents = true;
        if (typeof(descend) === 'boolean')
            followLinkedComponents = descend;

        var componentFound =
            (type === 'control') ?
                (typeof AVAILABLE_VIEWER_CONTROLS[key] === 'object' ?
                    AVAILABLE_VIEWER_CONTROLS[key] : null) :
                (typeof AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
                    AVAILABLE_VIEWER_INTERACTIONS[key] : null);
        if (componentFound == null) // interaction/control is not available
            return;

        var Constructor = componentFound['clazz'];
        // add in additional options
        if (typeof options === 'object' &&
            !isArray(options)) {
            for (var o in options) {
                componentFound['options'][o] = options[o];
            }
        }
        var newComponent = new Constructor(componentFound['options']);

        if (type === 'control')
            this.viewer_.addControl(newComponent);
        else
            this.viewer_.addInteraction(newComponent);
        this.viewerState_[key] =
            {"type": type, "ref": newComponent,
            "defaults" : componentFound['defaults'],
            "links" : componentFound['links']};

        // because controls have interactions and interactions have controls linked to them
        // we are going to call ourselves again with an IMPORTANT flag that we are not
        // going to continue this way in a cyclic manner!
        if (followLinkedComponents) {
            for (var link in componentFound['links'])
                this.addInteractionOrControl(
                    componentFound['links'][link],
                    type === 'control' ? 'interaction' : 'control',
                    false);
            }
    }

    /**
     * Removes a control or interaction from the viewer
     * see [AVAILABLE_VIEWER_CONTROLS/AVAILABLE_VIEWER_INTERACTIONS]{@link AVAILABLE_VIEWER_CONTROLS}
     *
     * @param {string} key the unique interaction or control key
     * @param {boolean} descend a flag whether we should follow linked interactions/controls
     */
    removeInteractionOrControl(key, descend) {
        if (!(this.viewer_ instanceof OlMap) || // could be the viewer was not initialized
            (typeof(key) !== 'string')) return; // key is not a string

        if (typeof this.viewerState_[key] !== 'object')
            return;  // control/interaction already removed

        var controlOrInteraction = this.viewerState_[key];
        var followLinkedComponents = true;
        if (typeof(descend) === 'boolean')
            followLinkedComponents = descend;

        if (controlOrInteraction['type'] === 'control')
            this.viewer_.getControls().remove(controlOrInteraction['ref']);
        else
            this.viewer_.getInteractions().remove(controlOrInteraction['ref']);
        if (typeof(controlOrInteraction['ref'].disposeInternal) === 'function' &&
                    typeof(controlOrInteraction['ref'].dispose) === 'function')
                controlOrInteraction['ref'].dispose();
        delete this.viewerState_[key];

        // because controls have interactions and interactions have controls linked to them
        // we are going to call ourselves again with an IMPORTANT flag that we are not
        // going to continue this way in a cyclic manner!
        if (followLinkedComponents) {
            for (var link in controlOrInteraction['links'])
                this.removeInteractionOrControl(
                    controlOrInteraction['links'][link], false);
            }
    }

    /**
     * Sets the dimension index for the image via the OmeroImage setter.
     * Available dimension keys to be set are: z,t and c
     * See: {@link DIMENSION_LOOKUP)
     *
     * This function will check whether the value to be set violates the bounds.
     * If so it will 'fail' silently, i.e. not do anything.
     * This error behavior will extend to unrecognized dimension keys or negative
     * index values as well as non array input for channels
     *
     * Check also out the code in: {@link source.Image}
     *
     * @param {string} key a 'key' denoting the dimension. allowed are z,t and c!
     * @param {Array.<number>} values the value(s)
     */
    setDimensionIndex(key, values) {
        // dimension key and values check
        if (typeof(key) !== 'string' || key.length === 0 ||
            !isArray(values)) return;

        var lowerCaseKey = key.substr(0,1).toLowerCase();
        var omeroImage = this.getImage();
        var dimLookup =
            typeof DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
                DIMENSION_LOOKUP[lowerCaseKey] : null;
        // image not there, dim key not found or dimension not settable (i.e. width, height)
        if (omeroImage === null || dimLookup == null || !dimLookup['settable'])
            return;

        // do some bounds checking
        var max = 0;
        if (key === 'x') key = 'width'; // use alias
        if (key === 'y') key = 'height'; // use alias
        max = this.image_info_.size[key];
        for (var c in values) {
            if (typeof(values[c]) === 'string')
                    values[c] = parseInt(values[c]);
            if (typeof(values[c]) !== 'number' || values[c] < 0)
                return;
            // just in case of the crazy event of floating point
            values[c] = parseInt(values[c]);
            if (values[c] > max)
                return;
        }

        // now call setter
        var setter = "set" + dimLookup['method'];
        try {
            omeroImage[setter](key !== 'c' ? values[0] : values);
        } catch(methodNotDefined) {
            // there is the very remote possibility that the method was not defined
            return;
        }

        // we want to affect a rerender,
        // only clearing the cache for tiled sources and channel changes
        this.affectImageRender(omeroImage.use_tiled_retrieval_ && key === 'c');

        // update regions (if necessary)
        if (this.getRegionsLayer()) this.getRegions().changed();

        // update popup (hide it if shape no longer visible)
        this.viewer_.getOverlays().forEach(o => {
            if (o.updatePopupVisibility) {
                o.updatePopupVisibility();
            }
        });
    }

    /**
     * Gets the dimension value for the image via the respective OmeroImage getter.
     * Available dimension keys to query are: x,y,z,t and c
     * See: {@link DIMENSION_LOOKUP)
     *
     * Check also out the code in: {@link OmeroImage}
     *
     * @return {number|null} the present index or null (if an invalid dim key was supplied)
     */
    getDimensionIndex(key) {
        if (typeof(key) !== 'string' || key.length === 0) // dimension key checks
            return;
        var lowerCaseKey = key.substr(0,1).toLowerCase();

        var omeroImage = this.getImage();
        if (omeroImage == null) return; // we could be null

        var dimLookup =
            typeof DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
                DIMENSION_LOOKUP[lowerCaseKey] : null;
        if (dimLookup == null) return; // dim key not found

        // now call getter
        var getter = "get" + dimLookup['method'];
        try {
            return omeroImage[getter]();
        } catch(methodNotDefined) {
            // there is the very remote possibility that the method was not defined
            return null;
        }
    }

    /**
     * Adds a post tile load hook which can be removed again by:
     * {@link removePostTileLoadHook}
     *
     * The function will take one parameter which is the tile that gets handend in
     * by the framework.
     *
     * For more info have a look at:
     * [OmeroImage.setPostTileLoadFunction]{@link source.Image#setPostTileLoadFunction}
     *
     * @param {ol.TileLoadFunctionType} func a function with signature function(tile) {}
     */
    addPostTileLoadHook(func) {
        var omeroImage = this.getImage();
        if (omeroImage) {
            omeroImage.setPostTileLoadFunction(func);
            this.affectImageRender();
        }
    }

    /**
     * Removes a post tile load hook previously set by:
     * {@link addPostTileLoadHook} *
     */
    removePostTileLoadHook() {
        var omeroImage = this.getImage();
        if (omeroImage) {
            omeroImage.clearPostTileLoadFunction();
            this.affectImageRender();
        }
    }

    /**
     * Internal Method to get to the 'image/tile layer' which will always be the first!
     *
     * @private
     * @return {ol.layer.Tile|null} the open layers tile layer being our image or null
     */
    getImageLayer() {
        if (!(this.viewer_ instanceof OlMap) || // mandatory viewer presence check
            this.viewer_.getLayers().getLength() == 0) // unfathomable event of layer missing...
            return null;

        return this.viewer_.getLayers().item(0);
    }

    /**
     * Internal Method to get to the 'regions layer' which will always be the second!
     *
     * @private
     * @return { ol.layer.Vector|null} the open layers vector layer being our regions or null
     */
    getRegionsLayer() {
        if (!(this.viewer_ instanceof OlMap) || // mandatory viewer presence check
            this.viewer_.getLayers().getLength() < 2) // unfathomable event of layer missing...
            return null;

        return this.viewer_.getLayers().item(this.viewer_.getLayers().getLength()-1);
    }

    /**
     * Internal convenience method to get to the image source (in open layers terminoloy)
     *
     * @private
     * @return {source.Image|null} an instance of OmeroImage or null
     */
    getImage() {
        // delegate
        var imageLayer = this.getImageLayer();
        if (imageLayer) return imageLayer.getSource();

        return null;
    }

    /**
     * Internal convenience method to get to the regions vector source (in open layers terminoloy)
     *
     * @private
     * @return {Regions|null} an instance of OmeroRegions or null
     */
    getRegions() {
        // delegate
        var regionsLayer = this.getRegionsLayer();
        if (regionsLayer) return regionsLayer.getSource();

        return null;
    }

    /**
     * Gets the image id
     *
     * @return {number} the image id
     */
    getId() {
        return this.id_;
    }

    /**
     * Returns the (possibly prefixed) uri for a resource
     *
     * @param {string} resource the resource name
     * @return {string|null} the prefixed URI or null (if not found)
     */
    getPrefixedURI(resource) {
        if (typeof this.prefixed_uris_[resource] !== 'string') return null;

        var uri = this.prefixed_uris_[resource];
        if (typeof uri === 'string' && uri.length > 1) {
            // check for leading slash and remove trailing one if there...
            var i=uri.length-1;
            while(i>0) {
                if (uri[i] === '/') uri = uri.substring(0,i);
                else break;
                i--;
            }
            if (uri[0] !== '/') uri = '/' + uri;
        }

        return uri;
    }

    /**
     * Reads (possibly prefixed) uris from the parameters
     *
     * @param {Object} params the parameters handed in
     */
    readPrefixedUris(params) {
        if (typeof params !== 'object' || params === null) return;

        for (var uri in PREFIXED_URIS) {
            var resource = PREFIXED_URIS[uri];
            if (typeof params[resource] === 'string')
                this.prefixed_uris_[resource] = params[resource];
            else this.prefixed_uris_[resource] = '/' + resource.toLowerCase();
        }
    }

    /**
     * Gets the server information
     *
     * @return {object} the server information
     */
    getServer() {
        return this.server_;
    }

    /**
     * This method controls the region layer modes for interacting with the shapes.
     * Anything that concerns selection, translation, modification and drawing can
     * be enabled/disable this way.
     *
     * <p>
     * for use see: [OmeroRegions.setModes]{@link Regions#setModes}
     * </p>
     *
     * @param {Array.<number>} modes an array of modes
     * @return {Array.<number>} the present modes set
     */
    setRegionsModes(modes) {
        // delegate
        if (this.getRegionsLayer()) {
            this.getRegions().setModes(modes);
            return this.getRegions().present_modes_;
        }

        return [];
    }

    /**
     * This method generates shapes and adds them to the regions layer
     * It uses {@link utils.Regions.generateRegions} internally
     *
     * The options argument is optional and can have the following properties:
     * - shape_info => the roi shape definition (omero marshal format)
     * - number => the number of copies that should be generated
     * - position => the position to place the shape(s) or null (random placement)
     * - extent => a bounding box for generation, default: the entire viewport
     * - theDims => a list of dims to attach to
     * - is_compatible => the image size of the originating image was smaller or equal
     * - add_history => determines whether we should add the generation to the history
     * - hist_id => the history id to pass through
     */
    generateShapes(shape_info, options) {
        // elementary check if we have a shape definition to generate from,
        // a regions layer to add to and the permission to do so
        if (!this.image_info_['perms']['canAnnotate'] ||
            this.getRegionsLayer() === null ||
            typeof shape_info !== 'object') return;

        if (typeof options !== 'object' || options === null) options = {};
        // the number of copies we want, default is: 1
        var number =
            typeof options['number'] === 'number' && options['number'] > 0  ?
                options['number'] : 1;
        // a position to place the copies or else random will be used
        var position =
            isArray(options['position']) &&
            options['position'].length === 2 ?
                this.viewer_.getCoordinateFromPixel(options['position']) : null;
        // a limiting extent (bounding box) in which to place the copies
        // defaults to the entire viewport otherwise
        var extent =
            isArray(options['extent']) &&
            options['extent'].length === 4 ?
                options['extent'] : this.getViewExtent();
        // the dims we want to attach the generated shapes to
        var theDims =
            isArray(options['theDims']) &&
            options['theDims'].length > 0 ?
                options['theDims'] : [{
                    "z" : this.getDimensionIndex('z'),
                    "t" : this.getDimensionIndex('t'),
                    "c" : -1}];

        // sanity check: we are going to need matching numbers for shapes
        // and associated t/zs for the association loop below to make sense
        var dimLen = theDims.length;
        if (dimLen !== number && dimLen > 1) return;
        var oneToManyRelationShip = dimLen === 1 && number > 1;

        // delegate
        var generatedShapes = generateRegions(
                shape_info, number, extent, position,
                typeof options['is_compatible'] === 'boolean' &&
                    options['is_compatible']);
        // another brief sanity check in case not all shapes were created
        if (generatedShapes === null ||
                (!oneToManyRelationShip &&
                generatedShapes.length !== theDims.length)) return;

        // post generation work
        // update the styling and associate with dimensions
        for (var i=0;i<generatedShapes.length;i++) {
            var f = generatedShapes[i];
            // and associate them to the proper dims
            f['TheZ'] =
                oneToManyRelationShip ? theDims[0]['z'] : theDims[i]['z'];
            f['TheT'] =
                oneToManyRelationShip ? theDims[0]['t'] : theDims[i]['t'];
            var theC =
                oneToManyRelationShip ? theDims[0]['c'] :
                    (typeof theDims[i]['c'] === 'number' ?
                        theDims[i]['c'] : -1);
            f['TheC'] = theC;
            // in case we got created in a rotated view
            var res = this.viewer_.getView().getResolution();
            var rot = this.viewer_.getView().getRotation();
            if (f.getGeometry() instanceof Label && rot !== 0 &&
                    !this.getRegions().rotate_text_)
                f.getGeometry().rotate(-rot);
                updateStyleFunction(f, this.regions_, true);
            // calculate measurements
            this.getRegions().getLengthAndAreaForShape(f, true);
        }
        this.getRegions().addFeatures(generatedShapes);

        // notify about generation
        if (this.eventbus_) {
            var newRegionsObject = toJsonObject(
                    new Collection(generatedShapes), true);
            if (typeof newRegionsObject !== 'object' ||
                !isArray(newRegionsObject['new']) ||
                newRegionsObject['new'].length === 0) return;
            var params = {"shapes": newRegionsObject['new']};
            if (typeof options['hist_id'] === 'number')
                params['hist_id'] = options['hist_id'];
            if (typeof options['add_history'] === 'boolean')
                params['add_history'] =  options['add_history'];

            sendEventNotification(
                this, "REGIONS_SHAPE_GENERATED", params, 25);
        }
    };

    /**
     * Gets the viewport extent in internal coordinates. This method is therefore
     * not suitable for use in {@link Viewer#generateShapes} !
     *
     * @private
     * @return {ol.Extent|null} an array like this: [minX, minY, maxX, maxY] or null (if no viewer)
     */
    getViewExtent() {
        if (!(this.viewer_ instanceof OlMap ||
                this.viewer_.getView() === null)) return null;

        return this.viewer_.getView().calculateExtent(this.viewer_.getSize());
    }

    /**
     * Returns an extent whose coordinates are the smaller of either
     * the viewport or the image bounding box
     *
     * @return {ol.Extent|null} an array like this: [minX, minY, maxX, maxY] or null (if no viewer)
     */
    getSmallestViewExtent() {
        var viewport = this.getViewExtent();
        if (viewport === null) return;

        var image_extent = this.viewer_.getView().getProjection().getExtent();
        var smallestExtent = image_extent.slice();
        smallestExtent[1] = -smallestExtent[3];
        smallestExtent[3] = 0;

        if (viewport[0] > image_extent[0]) smallestExtent[0] = viewport[0];
        if (viewport[1] > -image_extent[3]) smallestExtent[1] = viewport[1];
        if (viewport[2] < image_extent[2]) smallestExtent[2] = viewport[2];
        if (viewport[3] < image_extent[1]) smallestExtent[3] = viewport[3];

        return smallestExtent;
    }

    /**
     * Helper to gather the ol3 features based on an array of given ids
     *
     * @private
     * @param {Array<string>} ids an array of ids (roi_id:shape_id)
     * @return {ol.Collection|null} a collection of features or null
     */
    getFeatureCollection(ids) {
        if (!isArray(ids) || ids.length === 0 ||
            this.regions_.idIndex_ === null) return null;

        var col = new Collection();
        for (var id in ids) {
            try {
                var f = this.regions_.idIndex_[ids[id]];
                if (f['state'] === REGIONS_STATE.REMOVED ||
                    f.getGeometry() instanceof Mask ||
                    (typeof f['permissions'] === 'object' &&
                        f['permissions'] !== null &&
                        typeof f['permissions']['canEdit'] === 'boolean' &&
                        !f['permissions']['canEdit'])) continue;
                col.push(f);
            } catch(ignored) {}
        }

        return col;
    }

    /**
     * Modifies the selected shapes with the given shape info, e.g.
     * <pre>
     * {"type" : "label", Text: 'changed', FontSize: { Value: 15 }, FontStyle: 'italic'}
     * </pre>
     *
     * @param {Object} shape_info the shape info as received from the json
     * @param {Array<string>} ids an array of ids (roi_id:shape_id)
     * @param {function=} callback an optional success handler
     */
    modifyRegionsStyle(shape_info, ids, callback) {
        if (!(this.regions_ instanceof Regions) ||
            typeof(shape_info) !== 'object' || shape_info === null) return;

        modifyStyles(
            shape_info, this.regions_,
            this.getFeatureCollection(ids), callback);

        // Update any popup that might be showing shape Text
        if (shape_info.hasOwnProperty('Text')) {
            // Update the ShapeEditPopup
            this.viewer_.getOverlays().forEach(o => {
                if (o.updatePopupText) {
                    o.updatePopupText(ids, shape_info.Text);
                }
            });
        }
    }

    /**
     * Modifies the selected shapes dimension attachment
     * <pre>
     * {"type" : "label", theT: 0, theZ: -1}
     * </pre>
     *
     * @param {Object} shape_info the shape info as received from the json
     * @param {Array<string>} ids an array of ids (roi_id:shape_id)
     * @param {function=} callback an optional success handler
     */
    modifyShapesAttachment(shape_info, ids, callback) {
        if (!(this.regions_ instanceof Regions) ||
            typeof(shape_info) !== 'object' || shape_info === null) return;

        var updatedShapeIds = [];
        var col = this.getFeatureCollection(ids);

        if (col === null) return;

        var dims = ['TheT', 'TheZ', 'TheC'];
        col.forEach(function(f) {
            for (var p in shape_info)
                if (dims.indexOf(p) !== -1 &&
                    typeof shape_info[p] === 'number' &&
                    shape_info[p] >= -1 && f[p] !== shape_info[p]) {
                        f[p] = shape_info[p];
                        updatedShapeIds.push(f.getId());
                }
        });

        if (updatedShapeIds.length > 0)
            this.regions_.setProperty(
                updatedShapeIds, "state",
                REGIONS_STATE.MODIFIED, callback);
    }

    /**
     * Persists modified/added/deleted shapes
     * see: {@link Regions.storeRegions}
     *
     * @param {Object} rois_to_be_deleted an associative array of roi ids for deletion
     * @param {boolean} useSeparateRoiForEachNewShape if false all new shapes are combined within one roi
     * @param {boolean} omit_client_update an optional flag that's handed back to the client
     *                  to indicate that a client side update to the response is not needed
     * @return {boolean} true if a storage request was made, false otherwise
     */
    storeRegions(rois_to_be_deleted, useSeparateRoiForEachNewShape, omit_client_update) {

        if (!(this.regions_ instanceof Regions))
            return false; // no regions, nothing to persist...

        omit_client_update =
            typeof omit_client_update === 'boolean' && omit_client_update;
        useSeparateRoiForEachNewShape =
            typeof(useSeparateRoiForEachNewShape) === 'boolean' ?
                useSeparateRoiForEachNewShape : true;

        var collectionOfFeatures =
            new Collection(this.regions_.getFeatures());
        var roisAsJsonObject = toJsonObject(
                collectionOfFeatures, useSeparateRoiForEachNewShape,
                rois_to_be_deleted);

        // check if we have nothing to persist, i.e. to send to the back-end
        if (roisAsJsonObject['count'] === 0) {
            // we may still want to clean up new but deleted shapes
            if (!omit_client_update &&
                roisAsJsonObject['new_and_deleted'].length > 0) {
                    var ids = {};
                    for (var i in roisAsJsonObject['new_and_deleted']) {
                        var id = roisAsJsonObject['new_and_deleted'][i];
                        if (typeof this.regions_.idIndex_[id] === 'object') {
                            this.regions_.removeFeature(
                                this.regions_.idIndex_[id]);
                            ids[id] = id;
                        }
                    }
                    if (this.eventbus_) {
                        sendEventNotification(
                            this, "REGIONS_STORED_SHAPES", {'shapes': ids});
                    }
            }
            return false;
        }

        return this.regions_.storeRegions(roisAsJsonObject, omit_client_update);
    }

    /**
     * Enables the drawing of one shape of a given type
     * To do so it sets the regions mode to draw, storing previously chosen
     * modes, adds the openlayers draw interaction to then switch back to
     * the previous modes.
     * The types supported are: 'point', 'line', 'rectangle', 'ellipse' and
     * 'polygons'.
     *
     * @param {Object} shape the shape definition for drawing (incl. type)
     * @param {number} roi_id a roi id that gets incorporated into the id (for grouping)
     * @param {Object=} opts optional parameters such as:
     *                       an a history id (hist_id) to pass through
     *                       or a list of unattached dimensions (unattached)
     */
    drawShape(shape, roi_id, opts) {
        if (!this.image_info_['perms']['canAnnotate'] ||
            !(this.regions_ instanceof Regions) ||
            typeof(shape) !== 'object' || typeof(shape) === null ||
            typeof(shape['type']) !== 'string' || shape['type'].length === 0) return;

        var oldModes = this.regions_.present_modes_.slice();
        this.setRegionsModes([REGIONS_MODE.DRAW]);
        if (!(this.regions_.draw_ instanceof Draw)) {
            this.setRegionsModes(oldModes);
            return;
        }

        this.regions_.draw_.drawShape(shape, roi_id, opts);
    }

    /**
     * Cancels any active drawing interactions
     */
    abortDrawing() {
        if (!(this.regions_ instanceof Regions) ||
            !(this.regions_.draw_ instanceof Draw)) return;
        this.regions_.draw_.endDrawingInteraction();
    }

    /**
     * Cleans up, calling the dispose() methods of the regions instance and the ol3 map
     * @private
     * @param {boolean} rememberEnabled a flag if the presently enabled controls/interactions should be remembered
     * @return {Array|null} if rememberEnabled is true: an array of enabled controls/interactions, otherwise null
     */
    dispose(rememberEnabled) {
        // remove regions first (if exists) since it holds a reference to the viewer
        this.removeRegions();

        if (typeof(rememberEnabled) !== 'boolean')
            rememberEnabled = false;
        var componentsRegistered = rememberEnabled ? [] : null;

        // tidy up viewer incl. layers, controls and interactions
        if (this.viewer_ instanceof OlMap) {
            if (rememberEnabled && this.viewerState_) {
                // delete them from the list as well as the viewer
                for (var K in this.viewerState_) {
                    var V = this.viewerState_[K];
                    this.removeInteractionOrControl(K);
                    // remember which controls and interactions were used
                    // we do not remember controls and interactions that are not defaults
                    // i.e. the more involved ones such as roi stuff (i.e. drawing, translation, etc)
                    if (typeof(V) === 'object' && V['defaults'])
                        componentsRegistered.push({ "key" : K, "type" : V['type']});
                };
                this.viewerState_ = {};
            } else {
                this.viewerState_ = {};
                this.viewer_.getControls().clear();
                this.viewer_.getInteractions().clear();
            }
            var omeroImage = this.getImage();
            if (omeroImage) omeroImage.dispose();
            this.viewer_.getLayers().clear();
            this.viewer_.getOverlays().clear();
            // remove global ol event listeners
            if (typeof(this.onEndMoveListener) !== 'undefined' &&
                        this.onEndMoveListener)
                    unlistenByKey(this.onEndMoveListener);
            if (typeof(this.onViewResolutionListener) !== 'undefined' &&
                this.onViewResolutionListener)
                    unlistenByKey(this.onViewResolutionListener);
            if (typeof(this.onViewRotationListener) !== 'undefined' &&
                this.onViewRotationListener)
                    unlistenByKey(this.onViewRotationListener);

            this.viewer_.dispose();
        }

        // reset internally stored viewer and image information
        this.initParams_ = {};
        this.image_info_ = null;
        this.viewer_ = null;

        return componentsRegistered;
    }

    /**
     * Destroys the viewer object as best as is possible
     * disposing of all contained regions and ol map (and associated objects)
     * as well as unregistering any event subscriptions
     *
     */
    destroyViewer() {
        this.dispose();
        if (this.eventbus_) this.eventbus_ = null;
    }

    /**
     * Modifies the channel value range
     * see: {@link source.Image.changeChannelRange}
     *
     * @param {Array.<Object>} ranges an array of objects with channel props
     */
    changeChannelRange(ranges) {
        var omeroImage = this.getImage();
        if (omeroImage === null) return;

        // rerender image (if necessary)
        if (omeroImage.changeChannelRange(ranges)) this.affectImageRender();

        // update regions (if active)
        if (this.getRegionsLayer()) this.getRegions().changed();
    }

    /**
     * Modifies the image projection
     * see: {@link source.Image.setImageProjection}
     *
     * @param {string} value the new value
     * @param {Object=} opts additional options, e.g. intmax projection start/end
     */
    changeImageProjection(value, opts) {
        if (this.getImage() === null) return;

        this.getImage().setImageProjection(value, opts);
        this.affectImageRender();

        // update regions (if necessary)
        if (this.getRegionsLayer()) this.getRegions().changed();
    }

    /**
     * Modifies the image model
     * see: {@link source.Image.setImageModel}
     *
     * @param {string} value the new value
     */
    changeImageModel(value) {
        if (this.getImage() === null) return;

        this.getImage().setImageModel(value);
        this.affectImageRender();
    }

    /**
     * Updates the saved settings to the current settings
     * see: {@link source.Image.updateSavedSettings}
     */
    updateSavedSettings() {
        if (this.getImage() === null) return;
        this.getImage().updateSavedSettings();
    }

    /**
     * Enables/disabled scale bar
     *
     * @param {boolean} show if true we show the scale bar, otherwise not
     * @return {boolean} true if the toggle was successfully done, otherwise false
     */
    toggleScaleBar(show) {
        // check if we have an image and a pixel size specified
        if (this.getImage() === null ||
            typeof this.image_info_['pixel_size'] !== "object" ||
            typeof this.image_info_['pixel_size']['x'] !== "number") return false;

        if (typeof show !== 'boolean') show = false;

        // check if we have an instance of the control already
        // and create one if we don't
        var scalebarControlExists =
            typeof this.viewerState_['scalebar'] === 'object';
        if (!scalebarControlExists) {
            if (show) this.addControl("scalebar");
            return true;
        }

        // toggle visibility now
        try {
            var scalebarControl = this.viewerState_["scalebar"]['ref'];
            scalebarControl.element_.style.display = show ? "" : "none";
        } catch(ex) {
            return false;
        }
        return true;
    }

    /**
     * Enables/disabled intensity display control
     *
     * @param {boolean} show if true we show the intensity, otherwise not
     */
    toggleIntensityControl(show) {
        var haveControl =
            typeof this.viewerState_['intensity'] === 'object';
        if (!haveControl && !show) return; // nothing to do
        if (haveControl && !show) { // remove existing one
            this.removeInteractionOrControl("intensity");
            return;
        }
        if (!haveControl) this.addControl("intensity");
        this.viewerState_["intensity"]['ref'].enable(
            this.getPrefixedURI(PLUGIN_PREFIX));
    }

    /**
     * Triggers a map update with redraw of viewport.
     * Useful if target div has been resized
     * @param {number=} delay delay in millis
     */
    redraw(delay) {
        if (this.viewer_) {
            var update =
                function() {
                    if (this.viewer_) {
                        this.viewer_.updateSize();
                    }
                }.bind(this);

            if (typeof delay !== 'number' || delay <= 0) {
                update();
                return;
            }
            setTimeout(update, delay);
        }
    }

    /**
     * Extracts the id which is part of the viewer's target element id
     * e.g. xxxxx_344455. In a standalone ol3 setup there won't be a number
     * but just an id
     */
    getTargetId() {
        return getTargetId(this.viewer_.getTargetElement());
    }

    /**
     * Retrieves initial request parameter by key
     *
     * @private
     * @param {string} key the key
     * @return {string|null} returns the value associated with the key or null
     */
    getInitialRequestParam(key) {
        if (typeof key !== 'string' ||
            typeof this.initParams_ !== 'object') return null;

        key = key.toUpperCase();
        if (typeof this.initParams_[key] === 'undefined' ||
            typeof this.initParams_[key] === null) return null;

        return this.initParams_[key];
    }

    /**
     * Captures the view parameters, that is to say image settings + resolution
     * and center
     *
     * @return {object} an object populated with the properties mentioned above
     */
    captureViewParameters() {
        if (this.getImage() === null) return null;

        var center = this.viewer_.getView().getCenter();
        var ret = this.getImage().captureImageSettings();
        ret["resolution"] = this.viewer_.getView().getResolution();
        ret["center"] = [center[0], -center[1]];

        return ret;
    }

    /**
     * Undoes/redoes history entries
     *
     * @param {number} hist_id the id associated with the history entry
     * @param {boolean=} undo if true we undo, if false we redo, default: undo
     */
    doHistory(hist_id, undo) {
        if (typeof hist_id !== 'number' || this.getRegions() === null) return;

        this.getRegions().doHistory(hist_id, undo);
    }

    /**
     * Retrieves an up-to-date shape definition for the given shape id
     *
     * @param {string} shape_id a combined roi:shape id
     * @return {Object} the shape definition or null if id does not have a feature
     */
    getShapeDefinition(shape_id) {
        if (this.getRegions() === null || typeof shape_id !== 'string' ||
            typeof this.getRegions().idIndex_[shape_id] !== 'object') return null;

        return featureToJsonObject(this.getRegions().idIndex_[shape_id]);
    }

    /**
     * Displays resolution as a percentage
     */
    displayResolutionInPercent() {
        var targetId = this.getTargetId();
        var zoomDisplay =
            document.getElementById('' + targetId).querySelectorAll(
                '.ol-zoom-display')
        if (typeof zoomDisplay !== 'object' ||
            typeof zoomDisplay.length !== 'number' ||
            zoomDisplay.length === 0) return;

        zoomDisplay[0].value =
            Math.round((1 / this.viewer_.getView().getResolution()) * 100);
    }

    /**
     * Watches the next rendering iteration (i.e. postrender event)
     * @param {boolean} stopOnTileLoadError we don't continue watching the load
     *                      progress if we experience tile load errors,
     *                      defaults to false
     * @return {boolean} true if the watch has been started, false otherwise
     */
    watchRenderStatus(stopOnTileLoadError) {
        // delegate
        return this.getImage().watchRenderStatus(this.viewer_, stopOnTileLoadError);
    }

    /**
     * Gets the present render status
     * @param {boolean} reset if true we reset to NOT_WATCHED
     * @return {RENDER_STATUS} the render status
     */
    getRenderStatus(reset) {
        // delegate
        return this.getImage().getRenderStatus(reset);
    }

    /**
     * Turns on/off smoothing for canvas
     * @param {boolean} smoothing if true the viewer uses smoothing, otherwise not
     */
    enableSmoothing(smoothing) {
        this.viewer_.once('precompose', function(e) {
            e.context['imageSmoothingEnabled'] = smoothing;
            e.context['webkitImageSmoothingEnabled'] = smoothing;
            e.context['mozImageSmoothingEnabled'] = smoothing;
            e.context['msImageSmoothingEnabled'] = smoothing;
        });

        // force rerender
        this.viewer_.updateSize();
    }

    /**
     * Captures the canvas content, sending the data via event notification
     * (which is necessary since the loading is async and has to complete)
     *
     * @param {Object} params the event notification parameters
     */
    sendCanvasContent(params) {
        params = params || {};
        var allConfigs =
            typeof params['all_configs'] === 'boolean' && params['all_configs'];
        if (this.viewer_ === null || this.eventbus_ === null) {
            if (allConfigs) params['count']--;
            return;
        }

        var zipEntry = params['zip_entry'];
        var supported = false;
        try {
            var MyBlob = new Blob(['test text'], {type : 'text/plain'});
            if (MyBlob instanceof Blob) supported = true;
        } catch(not_supported) {}

        var that = this;
        var publishEvent = function(data) {
            if (allConfigs) params['count']--;
            if (that.eventbus_ === null) return;
            params["supported"] = supported;
            if (supported && allConfigs) {
                var zipEntryName = zipEntry + '.png';
                if (typeof  params['zip']['files'][zipEntryName] === 'object') {
                    var sameCounter = 1;
                    zipEntryName = zipEntry + '-' + sameCounter + '.png';
                    while (typeof  params['zip']['files'][zipEntryName] === 'object') {
                        ++sameCounter;
                        zipEntryName = zipEntry + '-' + sameCounter + '.png';
                    }
                }
                params['zip'].file(zipEntryName, data);
            } else params['data'] = data;
            sendEventNotification(
                that, "IMAGE_CANVAS_DATA", params);
        };
        var omeroImage = this.getImage();
        if (omeroImage === null || !supported) {
            publishEvent();
            return;
        }

        var loading = 0;
        var loaded = 0;
        var tileLoadStart = function() {
            ++loading;
        };
        var sendNotification = function(canvas) {
            if (navigator['msSaveBlob'])
                publishEvent(canvas.msToBlob());
            else canvas.toBlob(
                    function(blob) {publishEvent(blob);});
        };

        var tileLoadEnd = function() {
            ++loaded;
            var ctx = this;
            if (loading === loaded) {
                omeroImage.un('tileloadstart', tileLoadStart);
                omeroImage.un('tileloadend', tileLoadEnd, ctx.canvas);
                omeroImage.un('tileloaderror', tileLoadEnd, ctx.canvas);

                sendNotification(ctx.canvas);
            }
        };

        this.viewer_.once('postcompose', function(event) {
            omeroImage.on('tileloadstart', tileLoadStart);
            omeroImage.on('tileloadend', tileLoadEnd, event.context);
            omeroImage.on('tileloaderror', tileLoadEnd, event.context);

            setTimeout(function() {
                if (loading === 0) {
                    omeroImage.un('tileloadstart', tileLoadStart);
                    omeroImage.un('tileloadend', tileLoadEnd, event.context);
                    omeroImage.un('tileloaderror', tileLoadEnd, event.context);

                    sendNotification(event.context.canvas);
                }
            }, 50);
        });

        if (typeof params['full_extent'] === 'boolean' && params['full_extent'])
            this.zoomToFit();

        this.viewer_.renderSync();
    }

    /**
     * Returns the area and length values for given shapes
     * @param {Array.<string>} ids the shape ids in the format roi_id:shape_id
     * @param {boolean} recalculate flag: if true we redo the measurement (default: false)
     * @return {Array.<Object>} an array of objects containing shape id, area and length
     */
    getLengthAndAreaForShapes(ids, recalculate) {
        var regions = this.getRegions();
        if (regions === null || !isArray(ids) ||
            ids.length === 0) return [];

        var ret = [];
        for (var x=0;x<ids.length;x++) {
            if (typeof ids[x] !== 'string' ||
                typeof regions.idIndex_ !== 'object' ||
                !(regions.idIndex_[ids[x]] instanceof Feature)) continue;
            // delegate
            var measurement =
                regions.getLengthAndAreaForShape(regions.idIndex_[ids[x]], recalculate);
            if (measurement !== null) ret.push(measurement);
        }

        return ret;
    }

    /**
     * Sets view parameters (center, resolution, rotation)
     *
     * @param {Array.<number>=} center the new center as an array: [x,y]
     * @param {number=} resolution the new resolution
     * @param {number=} rotation the new rotation
     */
    setViewParameters(center, resolution, rotation) {
        this.prevent_event_notification_ = true;
        try {
            //resolution first (if given)
            if (typeof resolution === 'number' && !isNaN(resolution)) {
                var constrainedResolution =
                    this.viewer_.getView().constrainResolution(resolution);
                if (typeof constrainedResolution === 'number' &&
                    constrainedResolution !== this.viewer_.getView().getResolution())
                        this.viewer_.getView().setResolution(constrainedResolution);
            }

            // center next (if given)
            var presentCenter = this.viewer_.getView().getCenter();
            if (isArray(center) && center.length === 2 &&
                typeof center[0] === 'number' && typeof center[1] === 'number' &&
                presentCenter[0] !== center[0] && presentCenter[1] !== center[1]) {
                this.viewer_.getView().setCenter(center);
            }

            // rotation (if given)
            if (typeof rotation === 'number' && !isNaN(rotation) &&
                rotation !== this.viewer_.getView().getRotation()) {
                    this.viewer_.getView().setRotation(rotation);
            }

            this.viewer_.renderSync();
        } catch(just_in_case) {}
        this.prevent_event_notification_ = false;
    }

    /**
     * Turns on/off intensity querying
     * @param {boolean} flag  if on we turn on intensity querying, otherwise off
     */
    toggleIntensityQuerying(flag) {
        try {
            return this.viewerState_["intensity"]["ref"].toggleIntensityQuerying(flag);
        } catch(ignored) {
            return false;
        }
    }

    /**
     * Triggers an explicit rerendering of the image (tile) layer
     *
     * @param {boolean} clearCache empties the tile cache if true
     */
    affectImageRender(clearCache) {
        var imageLayer = this.getImageLayer();
        if (imageLayer === null) return;
        var imageSource = imageLayer.getSource();

        try {
            // if we didn't get a flag we clear the cache for tiled sources only
            if (typeof clearCache !== 'boolean')
                clearCache = imageSource.use_tiled_retrieval_;

            if (clearCache) {
                var renderer = this.viewer_.getRenderer(imageLayer);
                var imageCanvas = renderer.getLayerRenderer(imageLayer).getImage();
                imageCanvas.getContext('2d').clearRect(
                    0, 0, imageCanvas.width, imageCanvas.height);
                imageSource.tileCache.clear();
            } else {
                imageSource.cache_version_++;
            }
            imageSource.changed();
        } catch(canHappen) {}
    }

    /*
    * Sets the sync group
    * @param {string|null} group the sync group or null
    */
    setSyncGroup(group) {
        if (group !== null &&
            (typeof group !== 'string' || group.length === 0)) return;
        this.sync_group_ = group
    }

    /**
     * Gets the 'view parameters'
     * @return {Object|null} the view parameters or null
     */
    getViewParameters() {
        if (this.viewer_ === null || this.getImage() === null) return null;
        return {
            "z": this.getDimensionIndex('z'),
            "t": this.getDimensionIndex('t'),
            "c": this.getDimensionIndex('c'),
            "w": this.getImage().getWidth(),
            "h": this.getImage().getHeight(),
            "center": this.viewer_.getView().getCenter().slice(),
            "resolution": this.viewer_.getView().getResolution(),
            "rotation": this.viewer_.getView().getRotation()
        };
    }

    /**
     * Returns all rois
     *
     * @return {Array.<Object>} an array of rois (incl. shapes)
     */
    getRois() {
        if (!(this.regions_ instanceof Regions)) return [];

        var rois = {};
        var feats = this.regions_.getFeatures();

        for (var i=0;i<feats.length;i++) {
            var feature = feats[i];

            if (!(feature instanceof Feature) ||
                feature.getGeometry() === null ||
                (typeof feature['state'] === 'number' &&
                feature['state'] !== REGIONS_STATE.DEFAULT)) continue;

            var roiId = -1;
            var shapeId = -1;
            try {
                var id = feature.getId();
                var colon = id.indexOf(":");
                roiId = parseInt(id.substring(0,colon));
                shapeId = parseInt(id.substring(colon+1));
                if (isNaN(roiId) || isNaN(shapeId)) continue;
            } catch(parseError) {
                continue;
            }

            var roiContainer = null;
            if (typeof rois[roiId] === 'object') roiContainer = rois[roiId];
            else {
                rois[roiId] = {
                    "@id" : roiId,
                    "@type" : 'http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI',
                    "shapes" : []
                };
                roiContainer = rois[roiId];
            }

            var type = feature['type'];
            try {
                var jsonObject = LOOKUP[type].call(
                        null, feature.getGeometry(), shapeId);
                integrateStyleIntoJsonObject(feature, jsonObject);
                integrateMiscInfoIntoJsonObject(feature, jsonObject);
                jsonObject['omero:details'] = {'permissions': feature['permissions']};
                roiContainer['shapes'].push(jsonObject);
            } catch(conversion_error) {
                console.error("Failed to turn feature " + type +
                    "(" + feature.getId() + ") into json => " + conversion_error);
            }
        };

        ret = [];
        for (var r in rois)
            if (rois[r]['shapes'].length > 0) ret.push(rois[r]);
        return ret;
    };

    /**
     * Refreshes the bird's eye view
     *
     * @param {number=} delay an (optional delay) in millis
     */
    refreshBirdsEye(delay) {
        if (!(this.viewer_ instanceof OlMap) ||
            typeof this.viewerState_['birdseye'] !== 'object') return;
        if (typeof delay !== 'number' || isNaN(delay) || delay < 0) delay = 0;

        var refresh = function() {
            this.viewerState_["birdseye"]["ref"].initOrUpdate();
        }.bind(this);

        if (delay === 0) refresh();
        else setTimeout(refresh, delay);
    }

    /**
     * Zooms to level that makes image fit into the available canvas
     */
    zoomToFit() {
        if (!(this.viewer_ instanceof OlMap)) return;
        var view = this.viewer_.getView();
        if (view) {
            var ext = view.getProjection().getExtent();
            view.fit([ext[0], -ext[3], ext[2], ext[1]]);
        }
    }
}

export default Viewer;
