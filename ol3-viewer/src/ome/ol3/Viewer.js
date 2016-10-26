goog.provide('ome.ol3.Viewer');

goog.require('ol.Object');
goog.require('ol.events');
goog.require('ol.Collection');
goog.require('ol.proj.Projection');
goog.require('ol.layer.Tile');
goog.require('ol.View');
goog.require('ol.Map');

/**
 * @classdesc
 * ome.ol3.Viewer is the central object to view images served by the Omero Server.
 * In its simplest form it takes an id to display the associated image:
 *
 * <pre>
 * var omeImgViewer = new ome.ol3.Viewer(1);
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
 * var omeImgViewer = new ome.ol3.Viewer(1
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
 * To view a different image, call the method 'changeToImage' on the existing viewer object:
 *<pre>
 * // the second parameter keeps the added controls
 * ome.ol3.Viewer.changeToImage(2, true);
 *</pre>
 *
 *
 * @constructor
 * @extends {ol.Object}
 *
 * @param {number} id an image id
 * @param {Object.<string, *>=} options additional properties (optional)
 */
ome.ol3.Viewer = function(id, options) {
	goog.base(this);

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
	 * are we in the split view
	 *
	 * @type {boolean}
	 * @private
	 */
    this.split_ = false;

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
	this.server_ = ome.ol3.utils.Net.checkAndSanitizeServerAddress(opts['server'] || "");

    /**
	 * some initial values/parameters for channel, model and projection (optional)
	 *
	 * @type {Object}
	 * @private
	 */
	this.initParams_ = opts['initParams'] || {};

    /**
	 * because of async wait until map has been instatiated, an addRegions call
     * might not be able to execute successfully. this flag tells us so that
     * we can make one once the map initialization has finished
	 * @type {boolean}
	 * @private
	 */
	 this.tried_regions = false;

	/**
	 * a flag that's only relevant if the server is not same orgin.
	 * then we have to go different ways to redirect the user to the server login.
	 * this flag reminds us if we've done so or still need to do so, i.e. if we
	 * have a supposed session or not.
	 *
	 * @type {boolean}
	 * @private
	 */
	 this.haveMadeCrossOriginLogin_ =
	 	ome.ol3.utils.Net.isSameOrigin(this.server_) ? true : false;
	if (!this.haveMadeCrossOriginLogin_ &&
		window['location']['href'].indexOf("haveMadeCrossOriginLogin_") !== -1)
		this.haveMadeCrossOriginLogin_ = true;

	/**
	 * the id of the element serving as the container for the viewer
	 * @type {string}
	 * @private
	 */
	this.container_ = "ome_viewer";
	if (typeof(opts['container']) === 'string')
		this.container_ = opts['container'];

	/**
	 * the associated image information
	 * as retrieved from the omero server
	 * @type {Object}
	 * @private
	 */
	 this.image_info_ = null;

	 /**
 	 * the associated OmeroRegions object
 	 * @type {ome.ol3.source.Regions}
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
	 * the viewer (ol.Map) instance
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
 	 * The initialization function performs the following steps:
	 * 1. Request image data as json
	 * 2. Store the image data internally
	 * 3. Build open layer objects needed for map creation
	 * 4. Instantiate the Viewer(ol.Map) and store it interally
	 *
	 * Note: steps 2-4 are done asynchroniously after the image data
	 * 			has been received.
 	 *
 	 * @function
	 * @param {Object} scope the java script context
	 * @param {?function} postSuccessHook an optional post success handler
     * @param {?function} initHook an optional initialization handler
 	 * @private
 	 */
 	 this.initialize_ = function(scope, postSuccessHook, initHook) {
		 // can happen if we instantitate the viewer without id
		 if (scope.id_ < 0) return;

			// the success handler builds the open layers map
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
				 scope.image_info_ = data;

				 if (typeof(scope.image_info_['size']) === 'undefined') {
						console.error("Image Info does not contain size info!");
						return;
				}

                // we might need to run some initialization handler after we have
                // received the json respone.
                if (typeof initHook === 'function') initHook.call(scope);

				/*
				 * get dimensions of image: width,height, z, t and c sizes,
				 * as well as zoom levels for pyramids
				 * for openlayers we gotta prepare the resolutions
				 * as 1 / res and reverse the order
				 */
				var zoomLevelScaling = null;
				var dims = scope.image_info_['size'];
				if (scope.image_info_['zoomLevelScaling']) {
					var tmp = [];
					for (var r in scope.image_info_['zoomLevelScaling'])
						tmp.push(1 / scope.image_info_['zoomLevelScaling'][r]);
					zoomLevelScaling = tmp.reverse();
				}
				var zoom= zoomLevelScaling ? zoomLevelScaling.length : -1;

                // we have to check the initial projection so that we can adjust
                // the view potentially to cater for split view in the code below
                var initialProjection =
                    scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.PROJECTION);
                initialProjection =
                   initialProjection !== null ? initialProjection.toLowerCase() :
                       scope.image_info_['rdefs']['projection']
                if (initialProjection !== 'normal' &&
                   initialProjection !== 'intmax' && initialProjection !== 'split')
                   initialProjection = 'normal';
               if (initialProjection === 'split')
                   scope.split_ = true;

               // in the same spirit we need the model so that in the split channel
               // case we get the proper dimensions from the json
               var initialModel =
                    scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.MODEL);
                initialModel =
                   initialModel !== null ? initialModel :
                       scope.image_info_['rdefs']['model']
                var lowerCaseModel = initialModel.toLowerCase()[0];
                switch (lowerCaseModel) {
                    case 'c': initialModel = 'color'; break;
                    case 'g': initialModel = 'greyscale'; break;
                    default: initialModel = 'color';
                };

               // should we be in the split view mode, we need to trick ol3
               // and set the dims and tile sizes accordingly to essentially
               // request 1 tile with the dimensions of the entire image extent
               if (scope.split_) {
                   var tmpDims =
                        scope.image_info_['split_channel'][initialModel[0]];
                    if (typeof tmpDims === 'object' && tmpDims) {
                        dims['width'] = tmpDims['width'];
                        dims['height'] = tmpDims['height'];
                        scope.image_info_['tile_size'] =
                            {"width" : dims['width'], "height" : dims['height']};
                    }
                    initialProjection = "split";
               }

				// determine the center
				var imgCenter = [dims['width'] / 2, -dims['height'] / 2];
                // pixel size
                var pixelSize =
                    typeof scope.image_info_['pixel_size'] === "object" &&
                    typeof scope.image_info_['pixel_size']['x'] === "number" ?
                        scope.image_info_['pixel_size']['x'] : null;

				// instantiate a pixel projection for omero data
				var proj = new ol.proj.Projection({
					 code: 'OMERO',
					 units: 'pixels',
					 extent: [0, 0, dims['width'], dims['height']],
                     metersPerUnit : pixelSize
				 });

                 // we might have some requested defaults
                 var initialTime =
                     scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.TIME);
                 initialTime =
                    initialTime !== null ? parseInt(initialTime) :
                    scope.image_info_['rdefs']['defaultT'];
                if (initialTime < 0) initialTime = 0;
                if (initialTime >= dims.t) initialTime =  dims.t-1;
                 var initialPlane =
                     scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.PLANE);
                 initialPlane =
                    initialPlane !== null ? parseInt(initialPlane) :
                        scope.image_info_['rdefs']['defaultZ'];
                if (initialPlane < 0) initialPlane = 0;
                if (initialPlane >= dims.z) initialPlane =  dims.z-1;
                 var initialCenterX =
                     scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.CENTER_X);
                 var initialCenterY =
                     scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.CENTER_Y);
                if (initialCenterX && !isNaN(parseFloat(initialCenterX)) &&
                    initialCenterY && !isNaN(parseFloat(initialCenterY))) {
                    initialCenterX = parseFloat(initialCenterX);
                    initialCenterY = parseFloat(initialCenterY);
                    if (initialCenterY > 0) initialCenterY = -initialCenterY;
                    if (initialCenterX >=0 && initialCenterX <= dims['width'] &&
                        -initialCenterY >=0 && -initialCenterX <= dims['height'])
                    imgCenter = [initialCenterX, initialCenterY];
                }
                var initialChannels =
                    scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.CHANNELS);
                initialChannels =
                    ome.ol3.utils.Misc.parseChannelParameters(initialChannels);

				// copy needed channels info
				var channels = [];
				for (var c in scope.image_info_['channels']) {
						var oldC = scope.image_info_['channels'][c];
					 	var newC = {
							"active" : oldC['active'],
							"color" :
                                typeof oldC['lut'] === 'string' &&
                                oldC['lut'].length > 0 ?
                                    oldC['lut'] : oldC['color'],
                            "reverse" :
                                typeof oldC['reverseIntensity'] === 'boolean' ?
                                    oldC['reverseIntensity'] : false,
							"min" : oldC['window']['min'],
							"max" : oldC['window']['max'],
							"start" : oldC['window']['start'],
							"end" : oldC['window']['end']
					 	};
						channels.push(newC);
					}

				// create an OmeroImage source (tiled)
				 var source = new ome.ol3.source.Image({
					 server : scope.server_,
					 //uri : '/webgateway/render_image_region',
					 image: scope.id_,
					 width: dims['width'],
					 height: dims['height'],
					 plane: initialPlane,
                     time: initialTime,
					 channels: channels,
					 resolutions: zoom > 1 ? zoomLevelScaling : [1],
                     img_proj:  initialProjection,
                     img_model:  initialModel,
                     split: scope.split_,
					 tile_size:  scope.image_info_['tile_size'] ?
					 	scope.image_info_['tile_size'] : null
				 });
                 source.changeChannelRange(initialChannels, false);

                 var actualZoom = zoom > 1 ? zoomLevelScaling[0] : 1;
                 var initialZoom =
                     scope.getInitialRequestParam(ome.ol3.REQUEST_PARAMS.ZOOM);
                 var possibleResolutions =
                    ome.ol3.utils.Misc.prepareResolutions(zoomLevelScaling);
                 if (initialZoom && !isNaN(parseFloat(initialZoom))) {
                     initialZoom = parseFloat(initialZoom);
                     var posLen = possibleResolutions.length;
                     if (posLen > 0 && initialZoom <= possibleResolutions[0] &&
                         initialZoom >= possibleResolutions[posLen-1])
                         actualZoom = initialZoom;
                 }

				 // we need a View object for the map
				 var view = new ol.View({
	 					projection: proj,
	 					center: imgCenter,
	 					extent: [0, -dims['height'], dims['width'], 0],
	 					resolutions : ome.ol3.utils.Misc.prepareResolutions(zoomLevelScaling),
	 					resolution : actualZoom
	 			});

				// we have a need to keep a list & reference of the controls
				// and interactions registered, therefore we need to take a
				// slighlty longer route to add them to the map
				var defaultInteractions = ome.ol3.defaultInteractions();
				var interactions = new ol.Collection();
				for (var inter in defaultInteractions) {
					interactions.push(defaultInteractions[inter]['ref']);
					scope.viewerState_[inter] = defaultInteractions[inter];
				}
				var defaultControls = ome.ol3.defaultControls();
				var controls = new ol.Collection();
				for (var contr in defaultControls) {
					controls.push(defaultControls[contr]['ref']);
                    scope.viewerState_[contr] = defaultControls[contr];
				}

                var targetElement = document.getElementById(scope.container_);
                if (targetElement === null)
                    return;

                var children =
                    Array.prototype.slice.call(targetElement.childNodes);
                for (var child in children)
                    targetElement.removeChild(children[child]);

				// finally construct the open layers map object
				scope.viewer_ = new ol.Map({
					logo: false,
					controls: controls,
					interactions:  interactions,
					renderer: ol.renderer.Type.CANVAS,
					layers: [new ol.layer.Tile({source: source, preload: Infinity})],
					target: scope.container_,
					view: view
				});

                // an endMove listener to publish move events
                if (scope.eventbus_)
                    scope.onEndMoveListener =
                        ol.events.listen(
                            scope.viewer_, ol.MapEvent.Type.MOVEEND,
                            function(event) {
                                this.eventbus_.publish(
                                    "IMAGE_INTERACTION",
                                    {"config_id": this.getTargetId(),
                                     "z": this.getDimensionIndex('z'),
                                     "t": this.getDimensionIndex('t'),
                                     "c": this.getDimensionIndex('c'),
                                     "center": this.viewer_.getView().getCenter()});
                            }, scope);

				// this is for work that needs to be done after,
				// e.g we have just switched images
				// because of the asynchronious nature of the initialization
				// we need to do this here
				if (typeof(postSuccessHook) === 'function')
					postSuccessHook.call(scope);

                if (scope.tried_regions) scope.addRegions();
			};

			// define request settings
			var reqParams = {
				 "server" : scope.server_,
				 "uri" : '/webgateway/imgData/' + scope.id_,
				 "jsonp" : true, // this will only count if we are cross-domain
				 "success" : success,
				 "error" : function(error) {
					 console.error("Error retrieving image info for id: " + scope.id_ +
					 	((error && error.length > 0) ? (" => " + error) : ""));
				 }
			};

			// send request
			ome.ol3.utils.Net.sendRequest(reqParams);
	 };

	// execute initialization function
	// for cross domain we check whether we need to have a login made, otherwise
	// we redirect to there ...
	if (ome.ol3.utils.Net.isSameOrigin(this.server_) || this.haveMadeCrossOriginLogin_) {
		this.initialize_(this);
	} else ome.ol3.utils.Net.makeCrossDomainLoginRedirect(this.server_);
};
goog.inherits(ome.ol3.Viewer, ol.Object);

/**
 * Shows the viewer
 */
ome.ol3.Viewer.prototype.show = function() {
	var viewerElement = document.getElementById(this.container_);
	if (viewerElement)
		viewerElement.style.visibility = "visible";
}

/**
 * Hides the viewer
 */
ome.ol3.Viewer.prototype.hide = function() {
	var viewerElement = document.getElementById(this.container_);
	if (viewerElement)
		viewerElement.style.visibility = "hidden";
}

/**
 * Switches between split and normal view
 *
 * @param {boolean} flag true to affect a split view, false otherwise
 */
ome.ol3.Viewer.prototype.toggleSplitView = function(flag) {
    // we only act upon a valid flag
    if (typeof flag !== 'boolean') return;

    // compare with present split value, if we are the same => why change
    if (this.split_ === flag) return;

    // set new value and force change and reinitialization
    this.split_ = flag;
    // need an init hook to be able to reinitialize to the present settings
    var defT = this.getDimensionIndex('t');
    var defZ = this.getDimensionIndex('z');
    var defM = this.getImage().image_model_ === 'g' ? "greyscale" : "color";
    var defC = [];
    for (var c in this.getImage().channels_info_) {
        var oldC = this.getImage().channels_info_[c];
        defC.push({
             "active" : oldC.active,
             "color" : oldC.color,
             "window" : {
                 "min" : oldC.min,
                 "max" : oldC.max,
                 "start": oldC.start,
                 "end": oldC.end}
        });
    }
    var initHook = function() {
        if (typeof this.image_info_['rdefs'] !== 'object' ||
            this.image_info_['rdefs'] === null) this.image_info_['rdefs'] = {};
        this.image_info_['rdefs']['defaultT'] = defT;
        this.image_info_['rdefs']['defaultZ'] = defZ;
        this.image_info_['rdefs']['model'] = defM;
        this.image_info_['channels'] = defC;
    }
    this.changeToImage(this.id_, true, true, initHook);
}

/**
 * Changes image that is being viewed.
 * The clean up we have to do included the following:
 * <ul>
 * <li>Clear/Remember the controls/interactions (if keep_viewer_state is true)</li>
 * <li>Clear all layers and overlays</li>
 * <li>Reset the stored image info to null</li>
 * <li>Reset the stored regions info to null</li>
 * <li>Reset the internal viewer object</li>
 * <li>Set the internal image id to the new image id</li>
 * <li>Call initialize again to set up things</li>
 *</ul>
 *
 * @param {number} id an image id
 * @param {boolean} keep_viewer_state keeps the viewer 'state',
 *  i.e registered controls and interactions
 * @param {boolean} reinitialize_on_same_image should we reinitialize on the same image
 *  defaults to false and is only useful on rare occasions: e.g. split channel view
 * @param {function=} reinit_handler an optional handler for
 *  defaults to false and is only useful on rare occasions: e.g. split channel view
 */
ome.ol3.Viewer.prototype.changeToImage =
	function(id, keep_viewer_state,
                reinitialize_on_same_image, reinit_handler) {
        var viewer_state =
			typeof(keep_viewer_state) === 'boolean' ? keep_viewer_state : false;
        if (typeof reinitialize_on_same_image !== 'boolean')
            reinitialize_on_same_image = false;
        if (id === this.id_ && !reinitialize_on_same_image) return;

        // clean up, remember registered controls/interactions
		var componentsRegistered = this.dispose(viewer_state);

		// set new id
		this.id_ = id;
		try {
			this.id_ = parseInt(this.id_);
		} catch(not_a_number) {}
        if (typeof this.id_ !== 'number' || this.id_ <=0)
            console.info('Image Id has to be a strictly positive integer');

		/*
		 * add controls and interactions to restore previous 'viewer state'
		 * we also check if after initialization (see above) the control/interaction
		 * hasn't been established already by default so as to avoid multiple Loading
		 * in order to get the interaction/control class that we need to instantiate
		 * we look it up at {@link ome.ol3.AVAILABLE_VIEWER_CONTROLS} or
		 * {@link ome.ol3.AVAILABLE_VIEWER_INTERACTIONS}
		 * via the key value stored for the previously registered components
		 *
		 * Important: all of this needs to be done post reinitialization since we
		 * require an ajax request to get the new image info and reestablishe the
		 * viewer
		 */
		var postSuccessHook = function() {
			// reastablish registered controls/interactions
			for (var c in componentsRegistered) {
				var prevComp = componentsRegistered[c];
				var type = prevComp['type'];
				var key = prevComp['key'];

				this.addInteractionOrControl(key, type);
			}
		}

		// reinitialize everything
		// we also check for cross domain if we have the login flag set to true already
		// otherwise we don't need to bother
		if (ome.ol3.utils.Net.isSameOrigin(this.server_) || this.haveMadeCrossOriginLogin_) {
			this.initialize_(
                this, postSuccessHook,
                typeof reinit_handler === 'function' ? reinit_handler : null);
		} else ome.ol3.utils.Net.makeCrossDomainLoginRedirect(this.server_);
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
 * Should you want to hide the regions, once created, call:
 * [setRegionsVisibility]{@link ome.ol3.Viewer#setRegionsVisibility} passing in: false
 *
 * If, indeed, you wish to remove the regions layer use:
 * [removeRegions]{@link ome.ol3.Viewer#removeRegions} but bear in mind that this requires a call to
 * [addRegions]{@link ome.ol3.Viewer#addRegions} again if you want it back which is more expensive
 * than toggling visibility
 *
 * @param {Object.<string, *>=} options properties not used yet and maybe never
 */
ome.ol3.Viewer.prototype.addRegions = function(options) {
	// without a map, no need for a regions overlay...
	if (!(this.viewer_ instanceof ol.Map)) {
        this.tried_regions = true;
        return;
    }
    this.tried_regions = false;
	if (this.regions_ instanceof ome.ol3.source.Regions)
		return;

	this.regions_ = new ome.ol3.source.Regions(this, options);
	// add a vector layer with the regions
	if (this.regions_) {
		this.viewer_.addLayer(new ol.layer.Vector({source : this.regions_}));
		// enable roi selection by default
		this.regions_.setModes([ome.ol3.REGIONS_MODE['SELECT']]);

		this.onViewRotationListener =
			ol.events.listen( // register a rerender action on rotation
				this.viewer_.getView(), "change:rotation",
				function(event) {
					var regions = this.getRegions();
					if (regions) regions.changed();
				}, this);
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
ome.ol3.Viewer.prototype.setRegionsVisibility = function(visible, roi_shape_ids) {
	// without a regions layer there will be no regions to hide...
	var regionsLayer = this.getRegionsLayer();
	if (regionsLayer) {
		var flag = visible || false;

		if (!ome.ol3.utils.Misc.isArray(roi_shape_ids) || roi_shape_ids.length === 0)
			regionsLayer.setVisible(flag);
		else
			this.getRegions().setProperty(roi_shape_ids, "visible", flag);
	}
}

/**
 * Marks given shapes as selected. The center flag is only considered if we
 * have a single shape only
 *
 * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
 * @param {boolean} selected flag whether we should (de)select the rois
 * @param {boolean} clear flag whether we should clear existing selection beforehand
 * @param {boolean=} center centers map on the shape coordinates
 */
ome.ol3.Viewer.prototype.selectShapes = function(
    roi_shape_ids, selected, clear, center) {
	// without a regions layer there will be no select of regions ...
	var regions = this.getRegions();
	if (regions === null || regions.select_ === null) return;

    if (typeof clear === 'boolean' && clear) regions.select_.clearSelection();
    regions.setProperty(roi_shape_ids, "selected", selected);

    if (roi_shape_ids.length === 1 && typeof center === 'boolean' && center &&
            typeof regions.idIndex_[roi_shape_ids[0]] === 'object')
        this.fitRegionOrExtent(regions.idIndex_[roi_shape_ids[0]].getGeometry());
}

/**
 * Focuses on something that represents an extent or a simple geometry
 * i.e. center it and zoom in
 *
 * @param {ol.geom.SimpleGeometry|ol.Extent} extent an extent
 */
ome.ol3.Viewer.prototype.fitRegionOrExtent = function(extent) {
	// without a regions layer there will be no select of regions ...
	var regions = this.getRegions();
	if (regions === null ||
        (!ome.ol3.utils.Misc.isArray(extent) && !(extent instanceof ol.geom.SimpleGeometry))) return;

    regions.viewer_.viewer_.getView().fit(
        extent, regions.viewer_.viewer_.getSize());
}

/**
 * Focuses on something that represents an extent or a simple geometry
 * i.e. center it and zoom in
 *
 * @param {string|Array<number>} shape_or_coord
 *              a shape id in roi_id:shape_id form or a coordinate pair array
 */
ome.ol3.Viewer.prototype.centerOnShapeOrCoordinate = function(shape_or_coord) {
    if (ome.ol3.utils.Misc.isArray(shape_or_coord)) {
        this.viewer_.getView().setCenter(shape_or_coord);
        return;
    }

	// without a regions layer there will be no select of regions ...
	var regions = this.getRegions();
	if (regions === null || regions.idIndex_ === null ||
        typeof shape_or_coord !== 'string' ||
        !(regions.idIndex_[shape_or_coord] instanceof ol.Feature)) return;

    this.fitRegionOrExtent(regions.idIndex_[shape_or_coord].getGeometry());
}

/**
 * Removes the regions from the viewer which is a multi step procedure
 * that involves destroying the OmeroRegions instance as well as the open
 * layer's vector layer
 *
 */
ome.ol3.Viewer.prototype.removeRegions = function(masks_only) {
	var removeMasksOnly = false;
	if (typeof(masks_only) === 'boolean')
		removeMasksOnly = masks_only;

	// without an existing instance no need to destroy it...
	if (!removeMasksOnly && this.regions_ instanceof ome.ol3.source.Regions) {
		// reset mode which will automatically deregister interactions
		this.regions_.setModes([ome.ol3.REGIONS_MODE['DEFAULT']]);
		// dispose of the internal OmeroRegions instance
		this.regions_.dispose();
		this.regions_ = null;
	}

	// remove any onViewRotationListener
	if (typeof(this.onViewRotationListener) !== 'undefined' &&
				this.onViewRotationListener)
			ol.events.unlistenByKey(this.onViewRotationListener);

	var regionsLayer = this.getRegionsLayer();
	if (regionsLayer) {
		//remove everything down to the image layer
		var len = this.viewer_.getLayers().getLength();
		if (removeMasksOnly) --len;
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
 * see: [setRotateText & setScaleText{@link ome.ol3.source.Regions#setRotateText}
 *
 * @param {boolean=} scaleText flag whether text should be scaled with view resolution
 * @param {boolean=} rotateText flag whether text should be rotated with view resolution
 */
ome.ol3.Viewer.prototype.setTextBehaviorForRegions = function(scaleText, rotateText) {
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
ome.ol3.Viewer.prototype.addInteraction = function(key, interaction) {
	// if we have no interaction given as the second argument => delegate to the factory
	if (typeof interaction !== 'object' || interaction === null) {
		this.addInteractionOrControl(key, 'interaction');
		return;
	}

	// we do have to have the key listed in the AVAILABLE_VIEWER_INTERACTIONS
	var availableInteraction =
        typeof ome.ol3.AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
            ome.ol3.AVAILABLE_VIEWER_INTERACTIONS[key] : null;
	// the given interaction has to also match the clazz
	// of the one registered under that key
	if (availableInteraction == null || !(interaction instanceof availableInteraction['clazz']))
		 return;

	// if we don't have an instance in our viewer state, we return
	if (!(this.viewer_ instanceof ol.Map) || // could be the viewer was not initialized
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
 * Use the key listed here: {@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}
 *
 * @param {string} key the unique control key
 */
ome.ol3.Viewer.prototype.addControl = function(key) {
	// delegate
	this.addInteractionOrControl(key, "control");
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
 */
ome.ol3.Viewer.prototype.addInteractionOrControl = function(key, type, descend) {
	if (!(this.viewer_ instanceof ol.Map) || // could be the viewer was not initialized
				(typeof(key) !== 'string') || // key not a string
				(typeof(type) !== 'string')) return; // type is not a string

	if (typeof this.viewerState_[key] === 'object')
		return;  // control/interaction already registered

	var followLinkedComponents = true;
	if (typeof(descend) === 'boolean')
		followLinkedComponents = descend;

	var componentFound =
		(type === 'control') ?
            (typeof ome.ol3.AVAILABLE_VIEWER_CONTROLS[key] === 'object' ?
                ome.ol3.AVAILABLE_VIEWER_CONTROLS[key] : null) :
            (typeof ome.ol3.AVAILABLE_VIEWER_INTERACTIONS[key] === 'object' ?
                ome.ol3.AVAILABLE_VIEWER_INTERACTIONS[key] : null);
	if (componentFound == null) // interaction/control is not available
		return;

	var Constructor = componentFound['clazz'];
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
 * see [AVAILABLE_VIEWER_CONTROLS/AVAILABLE_VIEWER_INTERACTIONS]{@link ome.ol3.AVAILABLE_VIEWER_CONTROLS}
 *
 * @param {string} key the unique interaction or control key
 * @param {boolean} descend a flag whether we should follow linked interactions/controls
 */
ome.ol3.Viewer.prototype.removeInteractionOrControl = function(key, descend) {
	if (!(this.viewer_ instanceof ol.Map) || // could be the viewer was not initialized
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
 * See: {@link ome.ol3.DIMENSION_LOOKUP)
 *
 * This function will check whether the value to be set violates the bounds.
 * If so it will 'fail' silently, i.e. not do anything.
 * This error behavior will extend to unrecognized dimension keys or negative
 * index values as well as non array input for channels
 *
 * Check also out the code in: {@link ome.ol3.source.Image}
 *
 * @param {string} key a 'key' denoting the dimension. allowed are z,t and c!
 * @param {number|string} value the var-length arguments list
 */
ome.ol3.Viewer.prototype.setDimensionIndex = function(key, value) {
	if (typeof(key) !== 'string' || key.length === 0) // dimension key checks
		return;
	var lowerCaseKey = key.substr(0,1).toLowerCase();

	var omeroImage = this.getImage();
	var dimLookup =
        typeof ome.ol3.DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
            ome.ol3.DIMENSION_LOOKUP[lowerCaseKey] : null;
	// image not there, dim key not found or dimension not settable (i.e. width, height)
	if (omeroImage === null || dimLookup == null ||
				!dimLookup['settable']) return;

	var values = Array.prototype.slice.call(arguments, 1);
	 // do some bounds checking
	 var max = 0;
	 try {
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
 	} catch(methodNotDefined) {
 		// there is the very remote possibility that the method was not defined
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

	// update regions if added
	if (this.getRegionsLayer())
		this.getRegions().updateRegions();

    // we want to affect a rerender,
    // only clearing the cache for tiled sources and channel changes
	omeroImage.forceRender(omeroImage.tiled_ && key === 'c');
}

/**
 * Gets the dimension value for the image via the respective OmeroImage getter.
 * Available dimension keys to query are: x,y,z,t and c
 * See: {@link ome.ol3.DIMENSION_LOOKUP)
 *
 * Check also out the code in: {@link OmeroImage}
 *
 * @return {number|null} the present index or null (if an invalid dim key was supplied)
 */
ome.ol3.Viewer.prototype.getDimensionIndex = function(key) {
	if (typeof(key) !== 'string' || key.length === 0) // dimension key checks
		return;
	var lowerCaseKey = key.substr(0,1).toLowerCase();

	var omeroImage = this.getImage();
	if (omeroImage == null) return; // we could be null

	var dimLookup =
        typeof ome.ol3.DIMENSION_LOOKUP[lowerCaseKey] === 'object' ?
            ome.ol3.DIMENSION_LOOKUP[lowerCaseKey] : null;
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
 * [OmeroImage.setPostTileLoadFunction]{@link ome.ol3.source.Image#setPostTileLoadFunction}
 *
 * @param {ol.TileLoadFunctionType} func a function with signature function(tile) {}
 */
ome.ol3.Viewer.prototype.addPostTileLoadHook = function(func) {
	var omeroImage = this.getImage();
	if (omeroImage)
		omeroImage.setPostTileLoadFunction(func);
}

/**
 * Removes a post tile load hook previously set by:
 * {@link addPostTileLoadHook} *
 */
ome.ol3.Viewer.prototype.removePostTileLoadHook = function() {
	var omeroImage = this.getImage();
	if (omeroImage)
		omeroImage.clearPostTileLoadFunction();
}

/**
 * Internal Method to get to the 'image/tile layer' which will always be the first!
 *
 * @private
 * @return {ol.layer.Tile|null} the open layers tile layer being our image or null
 */
ome.ol3.Viewer.prototype.getImageLayer = function() {
	if (!(this.viewer_ instanceof ol.Map) || // mandatory viewer presence check
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
ome.ol3.Viewer.prototype.getRegionsLayer = function() {
	if (!(this.viewer_ instanceof ol.Map) || // mandatory viewer presence check
		this.viewer_.getLayers().getLength() < 2) // unfathomable event of layer missing...
		return null;

		return this.viewer_.getLayers().item(this.viewer_.getLayers().getLength()-1);
}

/**
 * Internal convenience method to get to the image source (in open layers terminoloy)
 *
 * @private
 * @return {ome.ol3.source.Image|null} an instance of OmeroImage or null
 */
ome.ol3.Viewer.prototype.getImage = function() {
	// delegate
	var imageLayer = this.getImageLayer();
	if (imageLayer) return imageLayer.getSource();

	return null;
}

/**
 * Internal convenience method to get to the regions vector source (in open layers terminoloy)
 *
 * @private
 * @return {ome.ol3.source.Regions|null} an instance of OmeroRegions or null
 */
ome.ol3.Viewer.prototype.getRegions = function() {
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
ome.ol3.Viewer.prototype.getId = function() {
	  return this.id_;
}

/**
 * Gets the server information
 *
 * @return {object} the server information
 */
ome.ol3.Viewer.prototype.getServer = function() {
	  return this.server_;
}

/**
 * This method controls the region layer modes for interacting with the shapes.
 * Anything that concerns selection, translation, modification and drawing can
 * be enabled/disable this way.
 *
 * <p>
 * for use see: [OmeroRegions.setModes]{@link ome.ol3.source.Regions#setModes}
 * </p>
 *
 * @param {Array.<number>} modes an array of modes
 */
ome.ol3.Viewer.prototype.setRegionsModes = function(modes) {
	// delegate
	if (this.getRegionsLayer())
		this.getRegions().setModes(modes);
}

/**
 * This method generates shapes and adds them to the regions layer
 *
 * It uses {@link ome.ol3.utils.Regions.generateRegions} internally
 *
 * @param {Object} shape_info the roi shape information (in 'get_rois_json' format )
 * @param {number} number the number of shapes that should be generated
 * @param {boolean=} random_placement should the shapes be generated in random places? default: false
 * @param {ol.Extent=} extent the portion of the image used for generation (bbox format), default: the entire image
 */
ome.ol3.Viewer.prototype.generateShapes =
 	function(shape_info, number, random_placement, extent) {
	if (!ome.ol3.utils.Misc.isArray(extent) || extent.length === 0)
		extent = this.viewer_.getView().getProjection().getExtent(); // use image extent

	// delegate
	var generatedShapes = ome.ol3.utils.Regions.generateRegions(
		shape_info, number, extent, random_placement);

	if (generatedShapes === null)
		return;

	// in the case that the regions layer hasn't been added, we take the liberty
	// of doing so
	if (this.getRegionsLayer()) {
		// we run updateStyle over the shapes
		for (var s in generatedShapes) {
			// in case we got created in a rotated view
			var f = generatedShapes[s];
			var res = this.viewer_.getView().getResolution();
			var rot = this.viewer_.getView().getRotation();
			if (f.getGeometry() instanceof ome.ol3.geom.Label && rot !== 0 &&
					!this.getRegions().rotate_text_)
				f.getGeometry().rotate(-rot);
				ome.ol3.utils.Style.updateStyleFunction(f, this.regions_, true);
		}
		this.getRegions().addFeatures(generatedShapes);
	} else this.addRegions({"features" : generatedShapes});
};

/**
 * Gets the viewport extent in internal coordinates. This method is therefore
 * not suitable for use in {@link ome.ol3.Viewer#generateShapes} !
 *
 * @private
 * @return {ol.Extent|null} an array like this: [minX, minY, maxX, maxY] or null (if no viewer)
 */
ome.ol3.Viewer.prototype.getViewExtent = function() {
	if (!(this.viewer_ instanceof ol.Map)) return null;

	if (this.viewer_ && this.viewer_.getView() &&
		this.viewer_.getView().getState()) {
			var viewState = this.viewer_.getView().getState();

			return ol.extent.getForViewAndSize(
				this.viewer_.getView().getCenter(),
				this.viewer_.getView().getResolution(),
				this.viewer_.getView().getRotation(),
				this.viewer_.getSize());
	}

	// in case no frame state/extent is present (should not happen really)
	// we return the projection's extent in internal format (negative y)
	// should the projection also not be present, we return null
	if (this.viewer_.getView() && this.viewer_.getView().getProjection()) {
		var extent = this.viewer_.getView().getProjection().getExtent();
		return [extent[0], -extent[3], extent[2], -extent[1]];
	}

	return null;
}

/**
 * Activates clustering. Whether you are going to get a clustered view depends on:
 * {@link ome.ol3.source.Regions#useClusteredCollection_} and
 * {@link ome.ol3.source.Regions#needsClustering}
 *
 * @param {boolen} flag true/false flag
 */
ome.ol3.Viewer.prototype.activateClustering = function(flag) {
	if (this.getRegions() === null)
		this.addRegions();

	if (typeof(flag) !== 'boolean')
		flag = false;
	if (flag === this.regions_.useClustering_) return; // nothing has changed

	this.regions_.useClustering_ = flag;

	// delesect anything before switch
	if (this.regions_.select_) {
		this.regions_.select_.clearSelection();
		if (typeof this.viewerState_["boxSelect"] === 'object') // reset box select listeners
			this.viewerState_["boxSelect"]['ref'].resetListeners();
	}
	this.viewer_.getTargetElement().style = "";

	if (this.regions_.useClustering_)
		this.regions_.clusterFeaturesAsynchronously(); // kick off clustering
	else {// reset collection and clustered rtrees
			this.previouslyClustered_ = null;
			this.regions_.featuresCollection_ = null;
			this.regions_.clusteredRTrees_ = null;
			this.regions_.currentRTreeLevel_ = 0;
		}
};

/**
 * Modifies the selected shapes with the given shape info, e.g.
 * <pre>
 * {"type" : "label", textValue: 'changed', fontSize: 15, fontStyle: 'italic'}
 * </pre>
 *
 * @param {Object} shape_info the shape info as received from the json
 * @param {Array<string>=} ids an optional array of ids (roi_id:shape_id)
 */
 ome.ol3.Viewer.prototype.modifyRegionsStyle = function(shape_info, ids) {
	 if (!(this.regions_ instanceof ome.ol3.source.Regions) ||
	  	typeof(shape_info) !== 'object' || shape_info === null)
	 	return;

    var col = null;
    if (ome.ol3.utils.Misc.isArray(ids) && ids.length > 0 && this.regions_.idIndex_) {
        col = new ol.Collection();
        for (var id in ids)
            if (this.regions_.idIndex_[ids[id]] instanceof ol.Feature)
                col.push(this.regions_.idIndex_[ids[id]]);
    }

	 ome.ol3.utils.Style.modifyStyles(shape_info, this.regions_, col);
 }

/**
 * Persists modified/added shapes
 * see: {@link ome.ol3.source.Regions.storeRegions}
 *
 * @param {boolean} selectedOnly if true only selected regions are considered
 * @param {boolean} useSeparateRoiForEachNewShape if false all new shapes are combined within one roi
 */
ome.ol3.Viewer.prototype.storeRegions =
	function(selectedOnly,useSeparateRoiForEachNewShape) {

	if (!(this.regions_ instanceof ome.ol3.source.Regions))
		return; // no regions, nothing to persist...

	selectedOnly = typeof(selectedOnly) === 'boolean' ? selectedOnly : false;
	useSeparateRoiForEachNewShape =
		typeof(useSeparateRoiForEachNewShape) === 'boolean' ?
			useSeparateRoiForEachNewShape : true;

	var collectionOfFeatures =
		(selectedOnly && this.regions_.select_) ? this.regions_.select_.getFeatures() :
			new ol.Collection(this.regions_.getFeatures());

	var roisAsJsonObject =
	ome.ol3.utils.Conversion.toJsonObject(
		collectionOfFeatures, useSeparateRoiForEachNewShape);

	// either something happened or we don't have anything to persist
	if (roisAsJsonObject === null || roisAsJsonObject['count'] === 0)
		return;

	this.regions_.storeRegions(roisAsJsonObject);
}

/**
 * Enables/Disables context menu for regions
 * see: {@link ome.ol3.interaction.Select.enableContextMenu}
 *
 * @param {boolean} flag if true the context menu will be shown on right click, otherwise not
 */
ome.ol3.Viewer.prototype.enableRegionsContextMenu = function(flag) {

	if (!(this.regions_ instanceof ome.ol3.source.Regions) ||
			!(this.regions_.select_ instanceof ome.ol3.interaction.Select))
		return; // no regions or select => no context menu...

	this.regions_.select_.enableContextMenu(flag);
}

/**
 * Enables the drawing of one shape of a given type
 * To do so it sets the regions mode to draw, storing previously chosen
 * modes, adds the openlayers draw interaction to then switch back to
 * the previous modes.
 * The types supported are: 'point', 'line', 'rectangle', 'ellipse' and
 * 'polygons'.
 *
 * @param {string} type the shape type to draw
 */
ome.ol3.Viewer.prototype.drawShape = function(type) {
	if (!(this.regions_ instanceof ome.ol3.source.Regions) ||
			typeof(type) !== 'string' || type.length === 0)
		return;

	var oldModes = this.regions_.present_modes_.slice();
	this.setRegionsModes([ome.ol3.REGIONS_MODE.DRAW]);
	if (!(this.regions_.draw_ instanceof ome.ol3.interaction.Draw)) {
		this.setRegionsModes(oldModes);
		return;
	}

	this.regions_.draw_.drawShape(type);
}

/**
 * Cancels any active drawing interactions
 */
ome.ol3.Viewer.prototype.abortDrawing = function() {
    if (!(this.regions_ instanceof ome.ol3.source.Regions) ||
            !(this.regions_.draw_ instanceof ome.ol3.interaction.Draw)) return;
    this.regions_.draw_.endDrawingInteraction();
}

/**
 * Cleans up, calling the dispose() methods of the regions instance and the ol3 map
 * @private
 * @param {boolean} rememberEnabled a flag if the presently enabled controls/
 * 		interactions should be remembered
 * @return {Array|null} if rememberEnabled is true:
 * 								an array of enabled controls/interactions, otherwise null
 */
ome.ol3.Viewer.prototype.dispose = function(rememberEnabled) {
	// remove regions first (if exists) since it holds a reference to the viewer
	this.removeRegions();

	if (typeof(rememberEnabled) !== 'boolean')
		rememberEnabled = false;
	var componentsRegistered = rememberEnabled ? [] : null;

	// tidy up viewer incl. layers, controls and interactions
	if (this.viewer_ instanceof ol.Map) {
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
        // remove any onEndMoveListener
        if (typeof(this.onEndMoveListener) !== 'undefined' &&
                    this.onEndMoveListener)
                ol.events.unlistenByKey(this.onEndMoveListener);
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
ome.ol3.Viewer.prototype.destroyViewer = function() {
	this.dispose();
	if (this.eventbus_) this.eventbus_ = null;
}

/**
 * Modifies the channel value range
 * see: {@link ome.ol3.source.Image.changeChannelRange}
 *
 * @param {Array.<Object>} ranges an array of objects with channel props
 */
ome.ol3.Viewer.prototype.changeChannelRange = function(ranges) {
	if (this.getImage() === null) return;

    this.getImage().changeChannelRange(ranges);
}

/**
 * Modifies the image projection
 * see: {@link ome.ol3.source.Image.setImageProjection}
 *
 * @param {string} value the new value
 */
ome.ol3.Viewer.prototype.changeImageProjection = function(value) {
		if (this.getImage() === null) return;

		this.getImage().setImageProjection(value);
}

/**
 * Modifies the image model
 * see: {@link ome.ol3.source.Image.setImageModel}
 *
 * @param {string} value the new value
 */
ome.ol3.Viewer.prototype.changeImageModel = function(value) {
		if (this.getImage() === null) return;

		this.getImage().setImageModel(value);
}

/**
 * Enables/disabled scale bar
 *
 * @param {boolean} show if true we show the scale bar, otherwise not
 */
 ome.ol3.Viewer.prototype.toggleScaleBar =
 	function(show) {
        // check if we have an image and a pixel size specified
 		if (this.getImage() === null ||
            typeof this.image_info_['pixel_size'] !== "object" ||
            typeof this.image_info_['pixel_size']['x'] !== "number") return;

        if (typeof show !== 'boolean') show = false;

 	if (show) {
        this.addControl("scalebar");
        return;
    }
    this.removeInteractionOrControl("scalebar");
 }

/**
 * Triggers a map update with redraw of viewport.
 * Useful if target div has been resized
 * @param {number=} delay delay in millis
 */
ome.ol3.Viewer.prototype.redraw = function(delay) {
    if (this.viewer_) {
        if (typeof delay !== 'number' || delay < 0)
            delay = 0;
        var update = function() {
            if (this.viewer_) this.viewer_.updateSize()}.bind(this);
        setTimeout(update, delay);
    }
}

/**
 * Extracts the id which is part of the viewer's target element id
 * e.g. xxxxx_344455
 */
ome.ol3.Viewer.prototype.getTargetId = function() {
    var elemId = typeof this.viewer_.getTargetElement() === 'string' ?
        this.viewer_.getTargetElement() :
            typeof this.viewer_.getTargetElement() === 'object' &&
            typeof this.viewer_.getTargetElement().id === 'string' ?
                this.viewer_.getTargetElement().id : null;

    var _pos = -1;
    if (elemId === null || ((_pos = elemId.lastIndexOf("_")) === -1)) return null;

    try {
        var id = parseInt(elemId.substring(_pos+1));
        if (!isNaN(id)) return id;
    } catch(no_care) {}

    return null;
}

/**
 * Retrieves initial request parameter by key
 *
 * @private
 * @param {string} key the key
 * @return {string|null} returns the value associated with the key or null
 */
ome.ol3.Viewer.prototype.getInitialRequestParam = function(key) {
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
ome.ol3.Viewer.prototype.captureViewParameters = function() {
     if (this.getImage() === null) return null;

     var center = this.viewer_.getView().getCenter();
     var ret = this.getImage().captureImageSettings();
     ret["resolution"] = this.viewer_.getView().getResolution();
     ret["center"] = [center[0], -center[1]];

     return ret;
}

/*
 * This section determines which methods are exposed and usable after compilation
 */
goog.exportSymbol(
	'ome.ol3.Viewer',
	ome.ol3.Viewer,
	OME);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'show',
	ome.ol3.Viewer.prototype.show);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'hide',
	ome.ol3.Viewer.prototype.hide);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'addControl',
	ome.ol3.Viewer.prototype.addControl);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'addInteraction',
	ome.ol3.Viewer.prototype.addInteraction);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'removeInteractionOrControl',
	ome.ol3.Viewer.prototype.removeInteractionOrControl);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'changeToImage',
	ome.ol3.Viewer.prototype.changeToImage);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'addPostTileLoadHook',
	ome.ol3.Viewer.prototype.addPostTileLoadHook);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'removePostTileLoadHook',
	ome.ol3.Viewer.prototype.removePostTileLoadHook);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'setDimensionIndex',
	ome.ol3.Viewer.prototype.setDimensionIndex);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'getDimensionIndex',
	ome.ol3.Viewer.prototype.getDimensionIndex);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'getId',
	ome.ol3.Viewer.prototype.getId);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'getServer',
	ome.ol3.Viewer.prototype.getServer);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'addRegions',
	ome.ol3.Viewer.prototype.addRegions);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'removeRegions',
	ome.ol3.Viewer.prototype.removeRegions);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'setRegionsVisibility',
	ome.ol3.Viewer.prototype.setRegionsVisibility);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'setTextBehaviorForRegions',
	ome.ol3.Viewer.prototype.setTextBehaviorForRegions);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'setRegionsModes',
	ome.ol3.Viewer.prototype.setRegionsModes);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'generateShapes',
	ome.ol3.Viewer.prototype.generateShapes);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'activateClustering',
	ome.ol3.Viewer.prototype.activateClustering);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'modifyRegionsStyle',
	ome.ol3.Viewer.prototype.modifyRegionsStyle);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'storeRegions',
	ome.ol3.Viewer.prototype.storeRegions);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'enableRegionsContextMenu',
	ome.ol3.Viewer.prototype.enableRegionsContextMenu);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'drawShape',
	ome.ol3.Viewer.prototype.drawShape);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'destroyViewer',
	ome.ol3.Viewer.prototype.destroyViewer);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'changeChannelRange',
	ome.ol3.Viewer.prototype.changeChannelRange);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'selectShapes',
	ome.ol3.Viewer.prototype.selectShapes);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'centerOnShapeOrCoordinate',
	ome.ol3.Viewer.prototype.centerOnShapeOrCoordinate);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'redraw',
	ome.ol3.Viewer.prototype.redraw);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'toggleScaleBar',
	ome.ol3.Viewer.prototype.toggleScaleBar);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'changeImageProjection',
	ome.ol3.Viewer.prototype.changeImageProjection);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'changeImageModel',
	ome.ol3.Viewer.prototype.changeImageModel);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'captureViewParameters',
	ome.ol3.Viewer.prototype.captureViewParameters);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'toggleSplitView',
	ome.ol3.Viewer.prototype.toggleSplitView);

goog.exportProperty(
	ome.ol3.Viewer.prototype,
	'abortDrawing',
	ome.ol3.Viewer.prototype.abortDrawing);
