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
import OlObject from 'ol/object';
import Extent from 'ol/extent';
import Collection from 'ol/collection';
import Projection from 'ol/proj/projection';
import Tile from 'ol/layer/tile';
import View from 'ol/view';
import Feature from 'ol/feature';
import PluggableMap from 'ol/pluggablemap';
import MapEventType from 'ol/mapeventtype';
import GeometryType from 'ol/geom/geometrytype';
import Vector from 'ol/layer/vector';
import Geometry from 'ol/geom/geometry';
import Polygon from 'ol/geom/polygon';
import Condition from 'ol/events/condition';
import Events from 'ol/events';


import Regions from './source/Regions';
import Image from './source/Image';
import Label from './geom/Label';
import Mask from './geom/Mask';
import Draw from './interaction/Draw';
import * as globals from './Globals';
import * as NetUtils from './utils/Net';
import * as MiscUtils from './utils/Misc';
import * as RegionsUtils from './utils/Regions';
import * as StyleUtils from './utils/Style';
import * as ConversionUtils from './utils/Conversion';

/**
 * @classdesc
 * ome.ol3.Viewer is the central object to view images served by the Omero Server.
 * In its simplest form it takes an id to display the associated image:
 *
 * <pre>
 * let omeImgViewer = new ome.ol3.Viewer(1);
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
 * let omeImgViewer = new ome.ol3.Viewer(1
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
 * @constructor
 * @extends {ol.Object}
 *
 * @param {number} id an image id
 * @param {Object.<string, *>=} options additional properties (optional)
 */
export default class Viewer extends OlObject {
  constructor(id, options) {
    super();

    let opts = options || {};

    /**
     * the image id
     *
     * @type {number}
     * @private
     */
    this.id_ = id || -1;
    try {
      this.id_ = parseInt(this.id_);
    } catch (e) {
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
    this.server_ = NetUtils.checkAndSanitizeServerAddress(opts.server || '');

    /**
     * some initial values/parameters for channel, model and projection (optional)
     *
     * @type {Object}
     * @private
     */
    this.initParams_ = opts.initParams || {};
    if (opts.initParams) {
      // this.readPrefixedUris(opts.initParams);
    }

    /**
     * a list of (possibly prefixed) uris for lookup
     * @type {Object}
     * @private
     */
    this.prefixed_uris_ = {};


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
    this.haveMadeCrossOriginLogin_ = NetUtils.isSameOrigin(this.server_);
    if (!this.haveMadeCrossOriginLogin_ &&
      window.location.href.indexOf('haveMadeCrossOriginLogin_') !== -1) {
      this.haveMadeCrossOriginLogin_ = true;
    }

    /**
     * the id of the element serving as the container for the viewer
     * @type {string}
     * @private
     */
    this.container_ = 'ome-viewer';
    if (typeof(opts.container) === 'string') {
      this.container_ = opts.container;
    }

    /**
     * the associated image information as retrieved from the omero server
     * @type {Object}
     * @private
     */
    this.image_info_ = typeof opts.data === 'object' ? opts.data : null;

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
     * <li>The key has to be the same as in {@link ome.ol3.AVAILABLE_VIEWER_INTERACTIONS} or
     * {@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}</li>
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
     * @type {ol.PluggableMap}
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
      typeof opts.eventbus === 'object' &&
      typeof  opts.eventbus.publish === 'function' ?
        opts.eventbus : null;

    /**
     * a flag to indicate the no events should be sent
     *
     * @type {boolean}
     * @private
     */
    this.prevent_event_notification_ = false;

    // execute initialization function
    // for cross domain we check whether we need to have a login made, otherwise
    // we redirect to there ...
    if (NetUtils.isSameOrigin(this.server_) || this.haveMadeCrossOriginLogin_) {
      this.initialize_(null, null);
    } else {
      NetUtils.makeCrossDomainLoginRedirect(this.server_);
    }
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
  initialize_(postSuccessHook, initHook) {
    // can happen if we instantitate the viewer without id
    if (this.id_ < 0) return;

    // use handed in image info instead of requesting it
    if (this.image_info_ !== null) {
      this.bootstrapOpenLayers(postSuccessHook, initHook);
      return;
    }

    // the success handler instantiates the open layers map and controls
    let success = (data) => {
      if (typeof(data) === 'string') {
        try {
          data = JSON.parse(data);
        } catch (parseError) {
          console.error('Failed to parse json response!');
        }
      }
      if (typeof(data) !== 'object') {
        console.error('Image Request did not receive proper response!');
        return;
      }
      // store response internally to be able to work with it later
      this.image_info_ = data;

      // delegate
      this.bootstrapOpenLayers(postSuccessHook, initHook);
    };

    // define request settings
    let reqParams = {
      'server': this.getServer(),
      'uri': this.getPrefixedURI(globals.WEBGATEWAY) +
        '/imgData/' + this.id_,
      'jsonp': true, // this will only count if we are cross-domain
      'success': success,
      'error': (error) => {
        console.error('Error retrieving image info for id: ' +
          this.id_ +
          ((error && error.length > 0) ? (' => ' + error) : ''));
      }
    };

    // send request
    NetUtils.sendRequest(reqParams);
  }

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
  supportsOmeroServerVersion(version) {
    if (typeof version === 'number') {
      version = '' + version;
    } else if (typeof version !== 'string') return false;

    // strip off dots and check length
    version = parseInt(version.replace(/[.]/g, ''));
    if (isNaN(version) || ('' + version).length !== 3) return false;

    // check against actual version
    let actual_version =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.OMERO_VERSION);
    if (typeof actual_version !== 'string') return false;
    actual_version = parseInt(actual_version.replace(/[.]/g, ''));
    if (isNaN(actual_version)) return false;

    return actual_version >= version;
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
    if (typeof(this.image_info_.size) === 'undefined') {
      console.error('Image Info does not contain size info!');
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
    let zoomLevelScaling = null;
    let dims = this.image_info_.size;
    if (this.image_info_.zoomLevelScaling) {
      let tmp = [];
      for (let r in this.image_info_.zoomLevelScaling) {
        tmp.push(1 / this.image_info_.zoomLevelScaling[r]);
      }
      zoomLevelScaling = tmp.reverse();
    }
    let zoom = zoomLevelScaling ? zoomLevelScaling.length : -1;

    // get the initial projection
    let initialProjection =
      this.getInitialRequestParam(
        globals.REQUEST_PARAMS.PROJECTION);
    let parsedInitialProjection =
      MiscUtils.parseProjectionParameter(
        initialProjection !== null ?
          initialProjection.toLowerCase() :
          this.image_info_.rdefs.projection);
    initialProjection = parsedInitialProjection.projection;

    // get the initial model (color/greyscale)
    let initialModel =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.MODEL);
    initialModel =
      initialModel !== null ? initialModel :
        this.image_info_.rdefs.model;
    let lowerCaseModel = initialModel.toLowerCase()[0];
    switch (lowerCaseModel) {
    case 'c':
      initialModel = 'color';
      break;
    case 'g':
      initialModel = 'greyscale';
      break;
    default:
      initialModel = 'color';
    }

    // determine the center
    let imgCenter = [dims.width / 2, -dims.height / 2];
    // pixel size
    let pixelSize =
      typeof this.image_info_.pixel_size === 'object' &&
      typeof this.image_info_.pixel_size.x === 'number' ?
        this.image_info_.pixel_size.x : null;

    // instantiate a pixel projection for omero data
    let proj = new Projection({
      code: 'OMERO',
      units: 'pixels',
      extent: [0, 0, dims.width, dims.height],
      metersPerUnit: pixelSize
    });

    // we might have some requested defaults
    let initialTime =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.TIME);
    initialTime =
      initialTime !== null ? (parseInt(initialTime) - 1) :
        this.image_info_.rdefs.defaultT;
    if (initialTime < 0) initialTime = 0;
    if (initialTime >= dims.t) initialTime = dims.t - 1;
    let initialPlane =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.PLANE);
    initialPlane =
      initialPlane !== null ? (parseInt(initialPlane) - 1) :
        this.image_info_.rdefs.defaultZ;
    if (initialPlane < 0) initialPlane = 0;
    if (initialPlane >= dims.z) initialPlane = dims.z - 1;
    let initialCenterX =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.CENTER_X);
    let initialCenterY =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.CENTER_Y);
    if (initialCenterX && !isNaN(parseFloat(initialCenterX)) &&
      initialCenterY && !isNaN(parseFloat(initialCenterY))) {
      initialCenterX = parseFloat(initialCenterX);
      initialCenterY = parseFloat(initialCenterY);
      if (initialCenterY > 0) initialCenterY = -initialCenterY;
      if (initialCenterX >= 0 && initialCenterX <= dims.width &&
        -initialCenterY >= 0 && -initialCenterX <= dims.height) {
        imgCenter = [initialCenterX, initialCenterY];
      }
    }
    let initialChannels =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.CHANNELS);
    let initialMaps =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.MAPS);
    initialChannels =
      MiscUtils.parseChannelParameters(
        initialChannels, initialMaps);

    // copy needed channels info
    let channels = [];
    this.image_info_.channels.forEach((oldC, c) => {
      let newC = {
        'active': oldC.active,
        'label': typeof oldC.label === 'string' ? oldC.label : c,
        'color':
          typeof oldC.lut === 'string' &&
          oldC.lut.length > 0 ? oldC.lut : oldC.color,
        'min': oldC.window.min,
        'max': oldC.window.max,
        'start': oldC.window.start,
        'end': oldC.window.end
      };
      if (typeof oldC.inverted === 'boolean') {
        newC.inverted = oldC.inverted;
      }
      if (typeof oldC.family === 'string' && oldC.family !== '' &&
        typeof oldC.coefficient === 'number' &&
        !isNaN(oldC.coefficient)) {
        newC.family = oldC.family;
        newC.coefficient = oldC.coefficient;
      }
      channels.push(newC);
    });

    let isTiled =
      typeof this.image_info_.tiles === 'boolean' &&
      this.image_info_.tiles;
    // create an OmeroImage source
    let source = Image.newInstance({
      server: this.getServer(),
      uri: this.getPrefixedURI(globals.WEBGATEWAY),
      image: this.id_,
      width: dims.width,
      height: dims.height,
      plane: initialPlane,
      time: initialTime,
      channels: channels,
      resolutions: zoom > 1 ? zoomLevelScaling : [1],
      img_proj: parsedInitialProjection,
      img_model: initialModel,
      tiled: isTiled,
      tile_size: isTiled && this.supportsOmeroServerVersion('5.4.4') ?
        globals.DEFAULT_TILE_DIMS :
        this.image_info_.tile_size ?
          this.image_info_.tile_size : null
    });
    source.changeChannelRange(initialChannels, false);

    let actualZoom = zoom > 1 ? zoomLevelScaling[0] : 1;
    let initialZoom =
      this.getInitialRequestParam(globals.REQUEST_PARAMS.ZOOM);
    let possibleResolutions =
      MiscUtils.prepareResolutions(zoomLevelScaling);
    if (initialZoom && !isNaN(parseFloat(initialZoom))) {
      initialZoom = (1 / (parseFloat(initialZoom) / 100));
      let posLen = possibleResolutions.length;
      if (posLen > 1) {
        if (initialZoom >= possibleResolutions[0]) {
          actualZoom = possibleResolutions[0];
        } else if (initialZoom <= possibleResolutions[posLen - 1]) {
          actualZoom = possibleResolutions[posLen - 1];
        } else {
          // find nearest resolution
          for (let r = 0; r < posLen - 1; r++) {
            if (initialZoom < possibleResolutions[r + 1]) {
              continue;
            }
            let d1 =
              Math.abs(possibleResolutions[r] - initialZoom);
            let d2 =
              Math.abs(possibleResolutions[r + 1] - initialZoom);
            if (d1 < d2) {
              actualZoom = possibleResolutions[r];
            } else {
              actualZoom = possibleResolutions[r + 1];
            }
            break;
          }
        }
      } else {
        actualZoom = 1;
      }
    }

    // we need a View object for the map
    let view = new View({
      projection: proj,
      center: imgCenter,
      extent: [0, -dims.height, dims.width, 0],
      resolutions: possibleResolutions,
      resolution: actualZoom,
      maxZoom: possibleResolutions.length - 1
    });

    // we have a need to keep a list & reference of the controls
    // and interactions registered, therefore we need to take a
    // slighlty longer route to add them to the map
    let defaultInteractions = globals.defaultInteractions();
    let interactions = new Collection();
    for (let inter in defaultInteractions) {
      interactions.push(defaultInteractions[inter].ref);
      this.viewerState_[inter] = defaultInteractions[inter];
    }
    let defaultControls = globalsdefaultControls();
    let controls = new Collection();
    for (let contr in defaultControls) {
      controls.push(defaultControls[contr].ref);
      this.viewerState_[contr] = defaultControls[contr];
    }

    // finally construct the open layers map object
    this.viewer_ = new PluggableMap({
      logo: false,
      controls: controls,
      interactions: interactions,
      layers: [new Tile({source: source})],
      target: this.container_,
      view: view
    });

    // enable bird's eye view
    let birdsEyeOptions = {
      'url': this.getPrefixedURI(globals.WEBGATEWAY) +
        '/render_thumbnail/' + this.id_,
      'size': [dims.width, dims.height],
      'collapsed': !source.use_tiled_retrieval_
    };
    this.addControl('birdseye', birdsEyeOptions);
    // tweak source element for fullscreen to include dim sliders (iviewer only)
    let targetId = this.getTargetId();
    let viewerFrame = targetId ? document.getElementById(targetId) : null;
    if (targetId && viewerFrame) {
      this.viewerState_.fullscreen.ref.source_ = viewerFrame;
      this.viewerState_.dragPan.ref.condition_ =
        e => {
          // ignore right clicks (from context)
          return Condition.noModifierKeys(e) &&
            Condition.primaryAction(e);
        };
    }
    // enable scalebar by default
    this.toggleScaleBar(true);
    // enable intensity control
    this.toggleIntensityControl(true);

    // helper to broadcast a viewer interaction (zoom and drag)
    let notifyAboutViewerInteraction = viewer => {
      MiscUtils.sendEventNotification(
        viewer, 'IMAGE_VIEWER_INTERACTION', viewer.getViewParameters());
    };

    // get cached initial viewer center etc.
    if (this.image_info_.center || this.image_info_.resolution || this.image_info_.rotation) {
      let center = this.image_info_.center;
      let resolution = this.image_info_.resolution;
      let rotation = this.image_info_.rotation;
      // Need to wait for viewer to be built before this works:
      setTimeout(() =>  this.setViewParameters(center, resolution, rotation), 100);
    }

    // listens to resolution changes
    this.onViewResolutionListener =
      Events.listen( // register a resolution handler for zoom display
        this.viewer_.getView(), 'change:resolution',
        (event) => {
          this.displayResolutionInPercent();
          if (this.eventbus_) notifyAboutViewerInteraction(this);
        });
    this.displayResolutionInPercent();
    // listen to rotation changes
    this.onViewRotationListener =
      Events.listen(
        this.viewer_.getView(), 'change:rotation',
        (event) => {
          let regions = this.getRegions();
          if (regions) regions.changed();
          if (this.eventbus_) notifyAboutViewerInteraction(this);
        });

    // this is for work that needs to be done after,
    // e.g we have just switched images
    // because of the asynchronious nature of the initialization
    // we need to do this here
    if (typeof(postSuccessHook) === 'function') {
      postSuccessHook.call(this);
    }

    if (this.tried_regions) this.addRegions();

    if (this.eventbus_) {
      // an endMove listener to publish move events
      this.onEndMoveListener =
        Events.listen(
          this.viewer_, MapEventType.MOVEEND,
          (event) => {
            notifyAboutViewerInteraction(this);
          });
    }
  }

  /**
   * Shows the viewer
   */
  show() {
    let viewerElement = document.getElementById(this.container_);
    if (viewerElement) viewerElement.style.visibility = 'visible';
  }

  /**
   * Hides the viewer
   */
  hide() {
    let viewerElement = document.getElementById(this.container_);
    if (viewerElement) viewerElement.style.visibility = 'hidden';
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
   * [setRegionsVisibility]{@link ome.ol3.Viewer#setRegionsVisibility} passing in: false
   *
   * If, indeed, you wish to remove the regions layer use:
   * [removeRegions]{@link ome.ol3.Viewer#removeRegions} but bear in mind that this requires a call to
   * [addRegions]{@link ome.ol3.Viewer#addRegions} again if you want it back which is more expensive
   * than toggling visibility
   *
   * @param {Array=} data regions data (optional)
   */
  addRegions(data) {
    // without a map, no need for a regions overlay...
    if (!(this.viewer_ instanceof PluggableMap)) {
      this.tried_regions_ = true;
      if (MiscUtils.isArray(data)) {
        this.tried_regions_data_ = data;
      }
      return;
    }
    this.tried_regions_ = false;
    this.tried_regions_data_ = null;
    if (this.regions_ instanceof Regions) return;

    let options = {};
    if (data) options.data = data;
    this.regions_ = new Regions(this, options);

    // add a vector layer with the regions
    if (this.regions_) {
      this.viewer_.addLayer(new Vector({source: this.regions_}));
      // enable roi selection by default,
      // as well as modify and translate
      this.regions_.setModes(
        [globals.REGIONS_MODE.SELECT,
          globals.REGIONS_MODE.MODIFY,
          globals.REGIONS_MODE.TRANSLATE]);
    }
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
    let regionsLayer = this.getRegionsLayer();
    if (regionsLayer) {
      let flag = visible || false;

      if (!MiscUtils.isArray(roi_shape_ids) || roi_shape_ids.length === 0) {
        regionsLayer.setVisible(flag);
      } else {
        this.getRegions().setProperty(roi_shape_ids, 'visible', flag);
      }
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
    let regions = this.getRegions();
    if (regions && typeof flag === 'boolean') {
      regions.show_comments_ = flag;
      regions.changed();
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
    let regions = this.getRegions();
    if (regions === null || regions.select_ === null) return;

    if (typeof clear === 'boolean' && clear) regions.select_.clearSelection();
    regions.setProperty(roi_shape_ids, 'selected', selected);

    if (typeof center === 'string' &&
      typeof regions.idIndex_[center] === 'object') {
      this.centerOnGeometry(regions.idIndex_[center].getGeometry());
    }
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
    let regions = this.getRegions();
    if (regions === null) return;

    regions.setProperty(
      roi_shape_ids, 'state',
      typeof undo === 'boolean' && undo ?
        globals.REGIONS_STATE.ROLLBACK : globals.REGIONS_STATE.REMOVED,
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
    if (Extent.intersects(
      geometry.getExtent(),
      this.viewer_.getView().calculateExtent())) {
      return;
    }

    // use given resolution for zoom
    if (typeof resolution === 'number' && !isNaN(resolution)) {
      let constrainedResolution =
        this.viewer_.getView().constrainResolution(resolution);
      if (typeof constrainedResolution === 'number') {
        this.viewer_.getView().setResolution(constrainedResolution);
      }
    }

    // center (taking into account potential rotation)
    let rot = this.viewer_.getView().getRotation();
    if (geometry.getType() === GeometryType.CIRCLE) {
      let ext = geometry.getExtent();
      geometry = Polygon.fromExtent(ext);
      geometry.rotate(rot, Extent.getCenter(ext));
    }
    let coords = geometry.getFlatCoordinates();
    let cosine = Math.cos(-rot);
    let sine = Math.sin(-rot);
    let minRotX = +Infinity;
    let minRotY = +Infinity;
    let maxRotX = -Infinity;
    let maxRotY = -Infinity;
    let stride = geometry.getStride();
    for (let i = 0, ii = coords.length; i < ii; i += stride) {
      let rotX = coords[i] * cosine - coords[i + 1] * sine;
      let rotY = coords[i] * sine + coords[i + 1] * cosine;
      minRotX = Math.min(minRotX, rotX);
      minRotY = Math.min(minRotY, rotY);
      maxRotX = Math.max(maxRotX, rotX);
      maxRotY = Math.max(maxRotY, rotY);
    }
    sine = -sine;
    let centerRotX = (minRotX + maxRotX) / 2;
    let centerRotY = (minRotY + maxRotY) / 2;
    let centerX = centerRotX * cosine - centerRotY * sine;
    let centerY = centerRotY * cosine + centerRotX * sine;
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
      this.regions_.setModes([globals.REGIONS_MODE.DEFAULT]);
      // dispose of the internal OmeroRegions instance
      this.regions_.dispose();
      this.regions_ = null;
    }

    let regionsLayer = this.getRegionsLayer();
    if (regionsLayer) {
      //remove everything down to the image layer
      let len = this.viewer_.getLayers().getLength();
      for (let i = len - 1; i > 0; i--) {
        let l = this.viewer_.getLayers().item(i);
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
   * Use the key listed here: {@link ome.ol3.AVAILABLE_VIEWER_INTERACTIONS}
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
    let availableInteraction =
      typeof globals.AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
        globals.AVAILABLE_VIEWER_INTERACTIONS[key] : null;
    // the given interaction has to also match the clazz
    // of the one registered under that key
    if (availableInteraction == null || !(interaction instanceof availableInteraction.clazz)) {
      return;
    }

    // if we don't have an instance in our viewer state, we return
    if (!(this.viewer_ instanceof PluggableMap) || // could be the viewer was not initialized
      (typeof(key) !== 'string')) // key not a string
    {
      return;
    }

    if (typeof this.viewerState_[key] === 'object') {
      return;
    }  // control/interaction already registered

    // now we can safely add the interaction
    this.viewer_.addInteraction(interaction);
    this.viewerState_[key] =
      {
        'type': 'interaction', 'ref': interaction,
        'defaults': false,
        'links': []
      };
  }


  /**
   * Adds a control to the viewer.
   * Note: the control will only be added if it hasn't been added before
   * Use the key listed here: {@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}
   *
   * @param {string} key the unique control key
   * @param {Object=} options (optional) options for control
   */
  addControl(key, options) {
    // delegate
    this.addInteractionOrControl(key, 'control', true, options);
  }

  /**
   * Adds a control/interaction to the viewer. Internal convience method
   *
   * for interaction keys see: {@link ome.ol3.AVAILABLE_VIEWER_INTERACTIONS}
   * for control keys see: {@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}
   *
   * @private
   * @param {string} type whether it's an interaction or a control
   * @param {string} key the unique interaction or control key
   * @param {boolean} descend a flag whether we should follow linked interactions/controls
   * @param {Object=} options (optional) options for control
   */
  addInteractionOrControl(key, type, descend, options) {
    if (!(this.viewer_ instanceof PluggableMap) || // could be the viewer was not initialized
      (typeof(key) !== 'string') || // key not a string
      (typeof(type) !== 'string')) {
      return;
    } // type is not a string

    if (typeof this.viewerState_[key] === 'object') {
      return;
    }  // control/interaction already registered

    let followLinkedComponents = true;
    if (typeof(descend) === 'boolean') {
      followLinkedComponents = descend;
    }

    let componentFound =
      (type === 'control') ?
        (typeof globals.AVAILABLE_VIEWER_CONTROLS[key] === 'object' ?
          globals.AVAILABLE_VIEWER_CONTROLS[key] : null) :
        (typeof globals.AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
          globals.AVAILABLE_VIEWER_INTERACTIONS[key] : null);
    if (componentFound == null) // interaction/control is not available
    {
      return;
    }

    let Constructor = componentFound.clazz;
    // add in additional options
    if (typeof options === 'object' &&
      !MiscUtils.isArray(options)) {
      for (let o in options) {
        componentFound.options[o] = options[o];
      }
    }
    let newComponent = new Constructor(componentFound.options);

    if (type === 'control') {
      this.viewer_.addControl(newComponent);
    } else {
      this.viewer_.addInteraction(newComponent);
    }
    this.viewerState_[key] =
      {
        'type': type, 'ref': newComponent,
        'defaults': componentFound.defaults,
        'links': componentFound.links
      };

    // because controls have interactions and interactions have controls linked to them
    // we are going to call ourselves again with an IMPORTANT flag that we are not
    // going to continue this way in a cyclic manner!
    if (followLinkedComponents) {
      for (let link in componentFound.links) {
        this.addInteractionOrControl(
          componentFound.links[link],
          type === 'control' ? 'interaction' : 'control',
          false);
      }
    }
  }

  /**
   * Removes a control or interaction from the viewer
   * see [AVAILABLE_VIEWER_CONTROLS/AVAILABLE_VIEWER_INTERACTIONS]{@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}
   *
   * @param {string} key the unique interaction or control key
   * @param {boolean} descend a flag whether we should follow linked interactions/controls
   */
  removeInteractionOrControl(key, descend) {
    if (!(this.viewer_ instanceof PluggableMap) || // could be the viewer was not initialized
      (typeof(key) !== 'string')) {
      return;
    } // key is not a string

    if (typeof this.viewerState_[key] !== 'object') {
      return;
    }  // control/interaction already removed

    let controlOrInteraction = this.viewerState_[key];
    let followLinkedComponents = true;
    if (typeof(descend) === 'boolean') {
      followLinkedComponents = descend;
    }

    if (controlOrInteraction.type === 'control') {
      this.viewer_.getControls().remove(controlOrInteraction.ref);
    } else {
      this.viewer_.getInteractions().remove(controlOrInteraction.ref);
    }
    if (typeof(controlOrInteraction.ref.disposeInternal) === 'function' &&
      typeof(controlOrInteraction.ref.dispose) === 'function') {
      controlOrInteraction.ref.dispose();
    }
    delete this.viewerState_[key];

    // because controls have interactions and interactions have controls linked to them
    // we are going to call ourselves again with an IMPORTANT flag that we are not
    // going to continue this way in a cyclic manner!
    if (followLinkedComponents) {
      for (let link in controlOrInteraction.links) {
        this.removeInteractionOrControl(
          controlOrInteraction.links[link], false);
      }
    }
  }

  /**
   * Sets the dimension index for the image via the OmeroImage setter.
   * Available dimension keys to be set are: z,t and c
   * See: {@link ome.ol3.DIMENSION_LOOKUP)
 *
 * This function will check whether the value to be set violates the bounds.
 * If so it will 'fail' silently, i.e. not do anything.
 * This error behavior will extend to unrecognized dimension keys or negative
 * index values as well as non array input for channels
 *
 * Check also out the code in: {@link Image}
   *
   * @param {string} key a 'key' denoting the dimension. allowed are z,t and c!
   * @param {Array.<number>} values the value(s)
   */
  setDimensionIndex(key, values) {
    // dimension key and values check
    if (typeof(key) !== 'string' || key.length === 0 ||
      !MiscUtils.isArray(values)) {
      return;
    }

    let lowerCaseKey = key.substr(0, 1).toLowerCase();
    let omeroImage = this.getImage();
    let dimLookup =
      typeof globals.DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
        globals.DIMENSION_LOOKUP[lowerCaseKey] : null;
    // image not there, dim key not found or dimension not settable (i.e. width, height)
    if (omeroImage === null || dimLookup == null || !dimLookup.settable) {
      return;
    }

    // do some bounds checking
    let max = 0;
    if (key === 'x') key = 'width'; // use alias
    if (key === 'y') key = 'height'; // use alias
    max = this.image_info_.size[key];
    for (let c in values) {
      if (typeof(values[c]) === 'string') {
        values[c] = parseInt(values[c]);
      }
      if (typeof(values[c]) !== 'number' || values[c] < 0) {
        return;
      }
      // just in case of the crazy event of floating point
      values[c] = parseInt(values[c]);
      if (values[c] > max) {
        return;
      }
    }

    // now call setter
    let setter = 'set' + dimLookup.method;
    try {
      omeroImage[setter](key !== 'c' ? values[0] : values);
    } catch (methodNotDefined) {
      // there is the very remote possibility that the method was not defined
      return;
    }

    // we want to affect a rerender,
    // only clearing the cache for tiled sources and channel changes
    this.affectImageRender(omeroImage.use_tiled_retrieval_ && key === 'c');

    // update regions (if necessary)
    if (this.getRegionsLayer()) this.getRegions().changed();
  }

  /**
   * Gets the dimension value for the image via the respective OmeroImage getter.
   * Available dimension keys to query are: x,y,z,t and c
   * See: {@link globals.DIMENSION_LOOKUP)
 *
 * Check also out the code in: {@link OmeroImage}
   *
   * @return {number|null} the present index or null (if an invalid dim key was supplied)
   */
  getDimensionIndex(key) {
    if (typeof(key) !== 'string' || key.length === 0) // dimension key checks
    {
      return;
    }
    let lowerCaseKey = key.substr(0, 1).toLowerCase();

    let omeroImage = this.getImage();
    if (!omeroImage) return; // we could be null

    let dimLookup =
      typeof globals.DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
        globals.DIMENSION_LOOKUP[lowerCaseKey] : null;
    if (!dimLookup) return; // dim key not found

    // now call getter
    let getter = 'get' + dimLookup.method;
    try {
      return omeroImage[getter]();
    } catch (methodNotDefined) {
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
   * [OmeroImage.setPostTileLoadFunction]{@link Image#setPostTileLoadFunction}
   *
   * @param {ol.TileLoadFunctionType} func a function with signature function(tile) {}
   */
  addPostTileLoadHook(func) {
    let omeroImage = this.getImage();
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
    let omeroImage = this.getImage();
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
    if (!(this.viewer_ instanceof PluggableMap) || // mandatory viewer presence check
      this.viewer_.getLayers().getLength() == 0) // unfathomable event of layer missing...
    {
      return null;
    }

    return this.viewer_.getLayers().item(0);
  }

  /**
   * Internal Method to get to the 'regions layer' which will always be the second!
   *
   * @private
   * @return { ol.layer.Vector|null} the open layers vector layer being our regions or null
   */
  getRegionsLayer() {
    if (!(this.viewer_ instanceof PluggableMap) || // mandatory viewer presence check
      this.viewer_.getLayers().getLength() < 2) // unfathomable event of layer missing...
    {
      return null;
    }

    return this.viewer_.getLayers().item(this.viewer_.getLayers().getLength() - 1);
  }

  /**
   * Internal convenience method to get to the image source (in open layers terminoloy)
   *
   * @private
   * @return {Image|null} an instance of OmeroImage or null
   */
  getImage() {
    // delegate
    let imageLayer = this.getImageLayer();
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
    let regionsLayer = this.getRegionsLayer();
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

    let uri = this.prefixed_uris_[resource];
    if (typeof uri === 'string' && uri.length > 1) {
      // check for leading slash and remove trailing one if there...
      let i = uri.length - 1;
      while (i > 0) {
        if (uri[i] === '/') {
          uri = uri.substring(0, i);
        } else {
          break;
        }
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

    for (let uri in globals.PREFIXED_URIS) {
      let resource = globals.PREFIXED_URIS[uri];
      if (typeof params[resource] === 'string') {
        this.prefixed_uris_[resource] = params[resource];
      } else {
        this.prefixed_uris_[resource] = '/' + resource.toLowerCase();
      }
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
   * It uses {@link ome.ol3.utils.Regions.generateRegions} internally
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
    if (!this.image_info_.perms.canAnnotate ||
      this.getRegionsLayer() === null ||
      typeof shape_info !== 'object') {
      return;
    }

    if (typeof options !== 'object' || options === null) options = {};
    // the number of copies we want, default is: 1
    let number =
      typeof options.number === 'number' && options.number > 0 ?
        options.number : 1;
    // a position to place the copies or else random will be used
    let position =
      MiscUtils.isArray(options.position) &&
      options.position.length === 2 ?
        this.viewer_.getCoordinateFromPixel(options.position) : null;
    // a limiting extent (bounding box) in which to place the copies
    // defaults to the entire viewport otherwise
    let extent =
      MiscUtils.isArray(options.extent) &&
      options.extent.length === 4 ?
        options.extent : this.getViewExtent();
    // the dims we want to attach the generated shapes to
    let theDims =
      MiscUtils.isArray(options.theDims) &&
      options.theDims.length > 0 ?
        options.theDims : [{
          'z': this.getDimensionIndex('z'),
          't': this.getDimensionIndex('t'),
          'c': -1
        }];

    // sanity check: we are going to need matching numbers for shapes
    // and associated t/zs for the association loop below to make sense
    let dimLen = theDims.length;
    if (dimLen !== number && dimLen > 1) return;
    let oneToManyRelationShip = dimLen === 1 && number > 1;

    // delegate
    let generatedShapes =
      RegionsUtils.generateRegions(
        shape_info, number, extent, position,
        typeof options.is_compatible === 'boolean' &&
        options.is_compatible);
    // another brief sanity check in case not all shapes were created
    if (generatedShapes === null ||
      (!oneToManyRelationShip &&
        generatedShapes.length !== theDims.length)) {
      return;
    }

    // post generation work
    // update the styling and associate with dimensions
    for (let i = 0; i < generatedShapes.length; i++) {
      let f = generatedShapes[i];
      // and associate them to the proper dims
      f.TheZ =
        oneToManyRelationShip ? theDims[0].z : theDims[i].z;
      f.TheT =
        oneToManyRelationShip ? theDims[0].t : theDims[i].t;
      let theC =
        oneToManyRelationShip ? theDims[0].c :
          (typeof theDims[i].c === 'number' ?
            theDims[i].c : -1);
      f.TheC = theC;
      // in case we got created in a rotated view
      let res = this.viewer_.getView().getResolution();
      let rot = this.viewer_.getView().getRotation();
      if (f.getGeometry() instanceof Label && rot !== 0 &&
        !this.getRegions().rotate_text_) {
        f.getGeometry().rotate(-rot);
      }
      StyleUtils.updateStyleFunction(f, this.regions_, true);
      // calculate measurements
      this.getRegions().getLengthAndAreaForShape(f, true);
    }
    this.getRegions().addFeatures(generatedShapes);

    // notify about generation
    if (this.eventbus_) {
      let newRegionsObject =
        ConversionUtils.toJsonObject(
          new Collection(generatedShapes), true);
      if (typeof newRegionsObject !== 'object' ||
        !MiscUtils.isArray(newRegionsObject.new) ||
        newRegionsObject.new.length === 0) {
        return;
      }
      let params = {'shapes': newRegionsObject.new};
      if (typeof options.hist_id === 'number') {
        params.hist_id = options.hist_id;
      }
      if (typeof options.add_history === 'boolean') {
        params.add_history = options.add_history;
      }

      MiscUtils.sendEventNotification(
        this, 'REGIONS_SHAPE_GENERATED', params, 25);
    }
  }

  /**
   * Gets the viewport extent in internal coordinates. This method is therefore
   * not suitable for use in {@link ome.ol3.Viewer#generateShapes} !
   *
   * @private
   * @return {ol.Extent|null} an array like this: [minX, minY, maxX, maxY] or null (if no viewer)
   */
  getViewExtent() {
    if (!(this.viewer_ instanceof PluggableMap ||
      this.viewer_.getView() === null)) {
      return null;
    }

    return this.viewer_.getView().calculateExtent(this.viewer_.getSize());
  }

  /**
   * Returns an extent whose coordinates are the smaller of either
   * the viewport or the image bounding box
   *
   * @return {ol.Extent|null} an array like this: [minX, minY, maxX, maxY] or null (if no viewer)
   */
  getSmallestViewExtent() {
    let viewport = this.getViewExtent();
    if (viewport === null) return;

    let image_extent = this.viewer_.getView().getProjection().getExtent();
    let smallestExtent = image_extent.slice();
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
    if (!MiscUtils.isArray(ids) || ids.length === 0 ||
      this.regions_.idIndex_ === null) {
      return null;
    }

    let col = new Collection();
    for (let id in ids) {
      try {
        let f = this.regions_.idIndex_[ids[id]];
        if (f.state === globals.REGIONS_STATE.REMOVED ||
          f.getGeometry() instanceof Mask ||
          (typeof f.permissions === 'object' &&
            f.permissions !== null &&
            typeof f.permissions.canEdit === 'boolean' &&
            !f.permissions.canEdit)) {
          continue;
        }
        col.push(f);
      } catch (ignored) {
      }
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
      typeof (shape_info) !== 'object' || shape_info === null) {
      return;
    }

    StyleUtils.modifyStyles(
      shape_info, this.regions_,
      this.getFeatureCollection(ids), callback);
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
      typeof (shape_info) !== 'object' || shape_info === null) {
      return;
    }

    let updatedShapeIds = [];
    let col = this.getFeatureCollection(ids);

    if (col === null) return;

    let dims = ['TheT', 'TheZ', 'TheC'];
    col.forEach(function (f) {
      for (let p in shape_info) {
        if (dims.indexOf(p) !== -1 &&
          typeof shape_info[p] === 'number' &&
          shape_info[p] >= -1 && f[p] !== shape_info[p]) {
          f[p] = shape_info[p];
          updatedShapeIds.push(f.getId());
        }
      }
    });

    if (updatedShapeIds.length > 0) {
      this.regions_.setProperty(
        updatedShapeIds, 'state',
        globals.REGIONS_STATE.MODIFIED, callback);
    }
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
    if (!(this.regions_ instanceof Regions)) {
      return false;
    } // no regions, nothing to persist...

    omit_client_update =
      typeof omit_client_update === 'boolean' && omit_client_update;
    useSeparateRoiForEachNewShape =
      typeof (useSeparateRoiForEachNewShape) === 'boolean' ?
        useSeparateRoiForEachNewShape : true;

    let collectionOfFeatures =
      new Collection(this.regions_.getFeatures());
    let roisAsJsonObject =
      ConversionUtils.toJsonObject(
        collectionOfFeatures, useSeparateRoiForEachNewShape,
        rois_to_be_deleted);

    // check if we have nothing to persist, i.e. to send to the back-end
    if (roisAsJsonObject.count === 0) {
      // we may still want to clean up new but deleted shapes
      if (!omit_client_update &&
        roisAsJsonObject.new_and_deleted.length > 0) {
        let ids = {};
        for (let i in roisAsJsonObject.new_and_deleted) {
          let id = roisAsJsonObject.new_and_deleted[i];
          if (typeof this.regions_.idIndex_[id] === 'object') {
            this.regions_.removeFeature(
              this.regions_.idIndex_[id]);
            ids[id] = id;
          }
        }
        if (this.eventbus_) {
          MiscUtils.sendEventNotification(
            this, 'REGIONS_STORED_SHAPES', {'shapes': ids});
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
    if (!this.image_info_.perms.canAnnotate ||
      !(this.regions_ instanceof Regions) ||
      typeof(shape) !== 'object' || typeof(shape) === null ||
      typeof(shape.type) !== 'string' || shape.type.length === 0) {
      return;
    }

    let oldModes = this.regions_.present_modes_.slice();
    this.setRegionsModes([globals.REGIONS_MODE.DRAW]);
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
      !(this.regions_.draw_ instanceof Draw)) {
      return;
    }
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

    if (typeof(rememberEnabled) !== 'boolean') {
      rememberEnabled = false;
    }
    let componentsRegistered = rememberEnabled ? [] : null;

    // tidy up viewer incl. layers, controls and interactions
    if (this.viewer_ instanceof PluggableMap) {
      if (rememberEnabled && this.viewerState_) {
        // delete them from the list as well as the viewer
        for (let K in this.viewerState_) {
          let V = this.viewerState_[K];
          this.removeInteractionOrControl(K);
          // remember which controls and interactions were used
          // we do not remember controls and interactions that are not defaults
          // i.e. the more involved ones such as roi stuff (i.e. drawing, translation, etc)
          if (typeof(V) === 'object' && V.defaults) {
            componentsRegistered.push({'key': K, 'type': V.type});
          }
        }
        this.viewerState_ = {};
      } else {
        this.viewerState_ = {};
        this.viewer_.getControls().clear();
        this.viewer_.getInteractions().clear();
      }
      let omeroImage = this.getImage();
      if (omeroImage) omeroImage.dispose();
      this.viewer_.getLayers().clear();
      this.viewer_.getOverlays().clear();
      // remove global ol event listeners
      if (typeof(this.onEndMoveListener) !== 'undefined' &&
        this.onEndMoveListener) {
        Events.unlistenByKey(this.onEndMoveListener);
      }
      if (typeof(this.onViewResolutionListener) !== 'undefined' &&
        this.onViewResolutionListener) {
        Events.unlistenByKey(this.onViewResolutionListener);
      }
      if (typeof(this.onViewRotationListener) !== 'undefined' &&
        this.onViewRotationListener) {
        Events.unlistenByKey(this.onViewRotationListener);
      }

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
   * see: {@link Image.changeChannelRange}
   *
   * @param {Array.<Object>} ranges an array of objects with channel props
   */
  changeChannelRange(ranges) {
    let omeroImage = this.getImage();
    if (omeroImage === null) return;

    // rerender image (if necessary)
    if (omeroImage.changeChannelRange(ranges)) this.affectImageRender();

    // update regions (if active)
    if (this.getRegionsLayer()) this.getRegions().changed();
  }

  /**
   * Modifies the image projection
   * see: {@link Image.setImageProjection}
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
   * see: {@link Image.setImageModel}
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
   * see: {@link Image.updateSavedSettings}
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
      typeof this.image_info_.pixel_size !== 'object' ||
      typeof this.image_info_.pixel_size.x !== 'number') {
      return false;
    }

    if (typeof show !== 'boolean') show = false;

    // check if we have an instance of the control already
    // and create one if we don't
    let scalebarControlExists =
      typeof this.viewerState_.scalebar === 'object';
    if (!scalebarControlExists) {
      if (show) this.addControl('scalebar');
      return true;
    }

    // toggle visibility now
    try {
      let scalebarControl = this.viewerState_.scalebar.ref;
      scalebarControl.element_.style.display = show ? '' : 'none';
    } catch (ex) {
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
    let haveControl =
      typeof this.viewerState_.intensity === 'object';
    if (!haveControl && !show) return; // nothing to do
    if (haveControl && !show) { // remove existing one
      this.removeInteractionOrControl('intensity');
      return;
    }
    if (!haveControl) this.addControl('intensity');
    this.viewerState_.intensity.ref.enable(
      this.getPrefixedURI(globals.PLUGIN_PREFIX));
  }

  /**
   * Triggers a map update with redraw of viewport.
   * Useful if target div has been resized
   * @param {number=} delay delay in millis
   */
  redraw(delay) {
    if (this.viewer_) {
      let update =
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
    return MiscUtils.getTargetId(this.viewer_.getTargetElement());
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
      typeof this.initParams_ !== 'object') {
      return null;
    }

    key = key.toUpperCase();
    if (typeof this.initParams_[key] === 'undefined' ||
      typeof this.initParams_[key] === null) {
      return null;
    }

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

    let center = this.viewer_.getView().getCenter();
    let ret = this.getImage().captureImageSettings();
    ret.resolution = this.viewer_.getView().getResolution();
    ret.center = [center[0], -center[1]];

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
      typeof this.getRegions().idIndex_[shape_id] !== 'object') {
      return null;
    }

    return ConversionUtils.featureToJsonObject(
      this.getRegions().idIndex_[shape_id]);
  }

  /**
   * Displays resolution as a percentage
   */
  displayResolutionInPercent() {
    let targetId = this.getTargetId();
    let zoomDisplay =
      document.getElementById('' + targetId).querySelectorAll(
        '.ol-zoom-display');
    if (typeof zoomDisplay !== 'object' ||
      typeof zoomDisplay.length !== 'number' ||
      zoomDisplay.length === 0) {
      return;
    }

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
   * @return {ome.ol3.RENDER_STATUS} the render status
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
      e.context.imageSmoothingEnabled = smoothing;
      e.context.webkitImageSmoothingEnabled = smoothing;
      e.context.mozImageSmoothingEnabled = smoothing;
      e.context.msImageSmoothingEnabled = smoothing;
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
    let allConfigs =
      typeof params.all_configs === 'boolean' && params.all_configs;
    if (this.viewer_ === null || this.eventbus_ === null) {
      if (allConfigs) params.count--;
      return;
    }

    let zipEntry = params.zip_entry;
    let supported = false;
    try {
      let MyBlob = new Blob(['test text'], {type: 'text/plain'});
      if (MyBlob instanceof Blob) supported = true;
    } catch (not_supported) {
    }

    let that = this;
    let publishEvent = (data) => {
      if (allConfigs) params.count--;
      if (that.eventbus_ === null) return;
      params.supported = supported;
      if (supported && allConfigs) {
        let zipEntryName = zipEntry + '.png';
        if (typeof  params.zip.files[zipEntryName] === 'object') {
          let sameCounter = 1;
          zipEntryName = zipEntry + '-' + sameCounter + '.png';
          while (typeof  params.zip.files[zipEntryName] === 'object') {
            ++sameCounter;
            zipEntryName = zipEntry + '-' + sameCounter + '.png';
          }
        }
        params.zip.file(zipEntryName, data);
      } else {
        params.data = data;
      }
      MiscUtils.sendEventNotification(
        that, 'IMAGE_CANVAS_DATA', params);
    };
    let omeroImage = this.getImage();
    if (omeroImage === null || !supported) {
      publishEvent();
      return;
    }

    let loading = 0;
    let loaded = 0;
    let tileLoadStart = () => {
      ++loading;
    };
    let sendNotification = canvas => {
      if (navigator.msSaveBlob) {
        publishEvent(canvas.msToBlob());
      } else {
        canvas.toBlob(
          (blob) => {
            publishEvent(blob);
          });
      }
    };

    let tileLoadEnd = () => {
      ++loaded;
      let ctx = this;
      if (loading === loaded) {
        omeroImage.un('tileloadstart', tileLoadStart);
        omeroImage.un('tileloadend', tileLoadEnd, ctx.canvas);
        omeroImage.un('tileloaderror', tileLoadEnd, ctx.canvas);

        sendNotification(ctx.canvas);
      }
    };

    this.viewer_.once('postcompose', event => {
      omeroImage.on('tileloadstart', tileLoadStart);
      omeroImage.on('tileloadend', tileLoadEnd, event.context);
      omeroImage.on('tileloaderror', tileLoadEnd, event.context);

      setTimeout(() => {
        if (loading === 0) {
          omeroImage.un('tileloadstart', tileLoadStart);
          omeroImage.un('tileloadend', tileLoadEnd, event.context);
          omeroImage.un('tileloaderror', tileLoadEnd, event.context);

          sendNotification(event.context.canvas);
        }
      }, 50);
    });

    if (typeof params.full_extent === 'boolean' && params.full_extent) {
      this.zoomToFit();
    }

    this.viewer_.renderSync();
  }

  /**
   * Returns the area and length values for given shapes
   * @param {Array.<string>} ids the shape ids in the format roi_id:shape_id
   * @param {boolean} recalculate flag: if true we redo the measurement (default: false)
   * @return {Array.<Object>} an array of objects containing shape id, area and length
   */
  getLengthAndAreaForShapes(ids, recalculate) {
    let regions = this.getRegions();
    if (regions === null || !MiscUtils.isArray(ids) ||
      ids.length === 0) {
      return [];
    }

    let ret = [];
    for (let x = 0; x < ids.length; x++) {
      if (typeof ids[x] !== 'string' ||
        typeof regions.idIndex_ !== 'object' ||
        !(regions.idIndex_[ids[x]] instanceof Feature)) {
        continue;
      }
      // delegate
      let measurement =
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
        let constrainedResolution =
          this.viewer_.getView().constrainResolution(resolution);
        if (typeof constrainedResolution === 'number' &&
          constrainedResolution !== this.viewer_.getView().getResolution()) {
          this.viewer_.getView().setResolution(constrainedResolution);
        }
      }

      // center next (if given)
      let presentCenter = this.viewer_.getView().getCenter();
      if (MiscUtils.isArray(center) && center.length === 2 &&
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
    } catch (just_in_case) {
    }
    this.prevent_event_notification_ = false;
  }

  /**
   * Turns on/off intensity querying
   * @param {boolean} flag  if on we turn on intensity querying, otherwise off
   */
  toggleIntensityQuerying(flag) {
    try {
      return this.viewerState_.intensity.ref.toggleIntensityQuerying(flag);
    } catch (ignored) {
      return false;
    }
  }

  /**
   * Triggers an explicit rerendering of the image (tile) layer
   *
   * @param {boolean} clearCache empties the tile cache if true
   */
  affectImageRender(clearCache) {
    let imageLayer = this.getImageLayer();
    if (imageLayer === null) return;
    let imageSource = imageLayer.getSource();

    try {
      // if we didn't get a flag we clear the cache for tiled sources only
      if (typeof clearCache !== 'boolean') {
        clearCache = imageSource.use_tiled_retrieval_;
      }

      if (clearCache) {
        let renderer = this.viewer_.getRenderer(imageLayer);
        let imageCanvas = renderer.getLayerRenderer(imageLayer).getImage();
        imageCanvas.getContext('2d').clearRect(
          0, 0, imageCanvas.width, imageCanvas.height);
        imageSource.tileCache.clear();
      } else {
        imageSource.cache_version_++;
      }
      imageSource.changed();
    } catch (canHappen) {
    }
  }

  /*
   * Sets the sync group
   * @param {string|null} group the sync group or null
   */
  setSyncGroup(group) {
    if (group !== null &&
      (typeof group !== 'string' || group.length === 0)) {
      return;
    }
    this.sync_group_ = group;
  }

  /**
   * Gets the 'view parameters'
   * @return {Object|null} the view parameters or null
   */
  getViewParameters() {
    if (this.viewer_ === null || this.getImage() === null) return null;
    return {
      'z': this.getDimensionIndex('z'),
      't': this.getDimensionIndex('t'),
      'c': this.getDimensionIndex('c'),
      'w': this.getImage().getWidth(),
      'h': this.getImage().getHeight(),
      'center': this.viewer_.getView().getCenter().slice(),
      'resolution': this.viewer_.getView().getResolution(),
      'rotation': this.viewer_.getView().getRotation()
    };
  }

  /**
   * Returns all rois
   *
   * @return {Array.<Object>} an array of rois (incl. shapes)
   */
  getRois() {
    if (!(this.regions_ instanceof Regions)) return [];

    let rois = {};
    let feats = this.regions_.getFeatures();

    for (let i = 0; i < feats.length; i++) {
      let feature = feats[i];

      if (!(feature instanceof Feature) ||
        feature.getGeometry() === null ||
        (typeof feature.state === 'number' &&
          feature.state !== REGIONS_STATE.DEFAULT)) {
        continue;
      }

      let roiId = -1;
      let shapeId = -1;
      try {
        let id = feature.getId();
        let colon = id.indexOf(':');
        roiId = parseInt(id.substring(0, colon));
        shapeId = parseInt(id.substring(colon + 1));
        if (isNaN(roiId) || isNaN(shapeId)) continue;
      } catch (parseError) {
        continue;
      }

      let roiContainer = null;
      if (typeof rois[roiId] === 'object') {
        roiContainer = rois[roiId];
      } else {
        rois[roiId] = {
          '@id': roiId,
          '@type': 'http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI',
          'shapes': []
        };
        roiContainer = rois[roiId];
      }

      let type = feature.type;
      try {
        let jsonObject = ConversionUtils.LOOKUP[type].call(
          null, feature.getGeometry(), shapeId);
        ConversionUtils.integrateStyleIntoJsonObject(feature, jsonObject);
        ConversionUtils.integrateMiscInfoIntoJsonObject(feature, jsonObject);
        jsonObject['omero:details'] = {'permissions': feature.permissions};
        roiContainer.shapes.push(jsonObject);
      } catch (conversion_error) {
        console.error('Failed to turn feature ' + type +
          '(' + feature.getId() + ') into json => ' + conversion_error);
      }
    }

    let ret = [];
    for (let r in rois) {
      if (rois[r].shapes.length > 0) ret.push(rois[r]);
    }
    return ret;
  }

  /**
   * Refreshes the bird's eye view
   *
   * @param {number=} delay an (optional delay) in millis
   */
  refreshBirdsEye(delay) {
    if (!(this.viewer_ instanceof PluggableMap) ||
      typeof this.viewerState_.birdseye !== 'object') {
      return;
    }
    if (typeof delay !== 'number' || isNaN(delay) || delay < 0) delay = 0;

    let refresh = () => {
      this.viewerState_.birdseye.ref.initOrUpdate();
    };

    if (delay === 0) {
      refresh();
    } else {
      setTimeout(refresh, delay);
    }
  }

  /**
   * Zooms to level that makes image fit into the available canvas
   */
  zoomToFit() {
    if (!(this.viewer_ instanceof PluggableMap)) return;
    let view = this.viewer_.getView();
    if (view) {
      let ext = view.getProjection().getExtent();
      view.fit([ext[0], -ext[3], ext[2], ext[1]]);
    }
  }
}

/*
 * This section determines which methods are exposed and usable after compilation
 */
// goog.exportSymbol(
//     'ome.ol3.Viewer',
//     ome.ol3.Viewer,
//     OME);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getId',
//     getId);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'show',
//     show);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'hide',
//     hide);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'addControl',
//     addControl);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'addInteraction',
//     addInteraction);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'removeInteractionOrControl',
//     removeInteractionOrControl);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setDimensionIndex',
//     setDimensionIndex);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getDimensionIndex',
//     getDimensionIndex);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'addRegions',
//     addRegions);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'removeRegions',
//     removeRegions);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setRegionsVisibility',
//     setRegionsVisibility);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setTextBehaviorForRegions',
//     setTextBehaviorForRegions);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setRegionsModes',
//     setRegionsModes);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'generateShapes',
//     generateShapes);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'modifyRegionsStyle',
//     modifyRegionsStyle);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'modifyShapesAttachment',
//     modifyShapesAttachment);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'storeRegions',
//     storeRegions);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'drawShape',
//     drawShape);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'destroyViewer',
//     destroyViewer);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'changeChannelRange',
//     changeChannelRange);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'selectShapes',
//     selectShapes);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'redraw',
//     redraw);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'toggleScaleBar',
//     toggleScaleBar);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'changeImageProjection',
//     changeImageProjection);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'changeImageModel',
//     changeImageModel);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'updateSavedSettings',
//     updateSavedSettings);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'captureViewParameters',
//     captureViewParameters);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'abortDrawing',
//     abortDrawing);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'deleteShapes',
//     deleteShapes);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'showShapeComments',
//     showShapeComments);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getSmallestViewExtent',
//     getSmallestViewExtent);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'doHistory',
//     doHistory);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getShapeDefinition',
//     getShapeDefinition);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'watchRenderStatus',
//     watchRenderStatus);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getRenderStatus',
//     getRenderStatus);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'changeImageProjection',
//     changeImageProjection);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'enableSmoothing',
//     enableSmoothing);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'sendCanvasContent',
//     sendCanvasContent);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getLengthAndAreaForShapes',
//     getLengthAndAreaForShapes);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setViewParameters',
//     setViewParameters);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'toggleIntensityQuerying',
//     toggleIntensityQuerying);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'setSyncGroup',
// setSyncGroup);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getViewParameters',
// getViewParameters);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'getRois',
// getRois);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'refreshBirdsEye',
// refreshBirdsEye);
//
// goog.exportProperty(
//     ome.ol3.Viewer.prototype,
//     'zoomToFit',
// zoomToFit);
