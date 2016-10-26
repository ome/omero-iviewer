goog.provide('ome.ol3.source.Regions');

goog.require('ol.source.Vector');
goog.require('ol.events');
goog.require('ol.Feature');
goog.require('ol.layer.Image');
goog.require('ol.source.ImageStatic');
goog.require('ol.proj.Projection');


/**
 * @classdesc
 * Regions is the viewer's layer source for displaying the regions.
 *
 * One of the things that it does is to request the rois from the omero server
 * to store them internally.
 *
 * Furthermore it holds a reference to its 'mother', the viewer.
 * This is necessary since it needs to have access to the viewer state such
 * as which plane has been selected (and theerefore which rois) and adding
 * interactions for shapes, ranging from a simple select, over translate, modify
 * and drawing. As a consequence, Regions can only be created after the viewer
 * has been instantiated.
 *
 * Two flags that can be handed in as part of the second (otional argument)
 * are important to be mentioned. They determine whether the text for a shape
 * or the label text gets scaled with resolutions changes (default behavior)
 * and whether it should get rotated if the rest of the view was rotated
 * (doesn't happen by default), e.g:
 * <pre>
 *	{ 'rotateText' : false, 'scaleText' : true}
 *</pre>
 *
 * @constructor
 * @extends {ol.source.Vector}
 *
 * @param {ome.ol3.Viewer} viewerReference mandatory reference to the viewer parent
 * @param {Object.<string, *>=} options additional properties
 */
ome.ol3.source.Regions = function(viewerReference, options) {
    if (!(viewerReference instanceof ome.ol3.Viewer))
        console.error("Regions needs an ome.ol3.Viewer instance!");

	var opts = options || {};
	// we always use the spatial index
	opts.useSpatialIndex = true;

	var optGeneratedFeatures = null;
	if (ome.ol3.utils.Misc.isArray(opts['features'])) {
		optGeneratedFeatures = options['features'];
		opts['features'] = null;
		opts.features = null;
	}

	goog.base(this, opts); // call super

	/**
	 * a flag that tells us if we'd like for the text to be scaled with resolution
	 * changes of the view. Defaults to true
	 * @type {boolean}
	 * @private
	 */
	this.scale_text_ = true;
	if (typeof(opts['scaleText']) === 'boolean')
		this.scale_text_ = opts['scaleText'];

	/**
	 * a flag that tells us if we'd like for the text to go along with any
	 * rotation that the view underwent. Defauls to false
	 * @type {boolean}
	 * @private
	 */
	this.rotate_text_ = false;
	if (typeof(opts['rotateText']) === 'boolean')
		this.rotate_text_ = opts['rotateText'];

	/**
	 * A boolean that activates clustering
	 * If set to false, clustering will never be used.
	 * If set to true, the flag {@link ome.ol3.source.Regions#useClusteredCollection_}
	 * will determine whether the viewed extent will be clustered
	 * @type {boolean}
	 * @private
	 */
	 this.useClustering_ = false;
	/**
	 * Given that {ome.ol3.source.Regions#useClustering_} is set to true,
	 * this flag is what determines eventually whether the viewed extent is shown clustered
	 * The flag is set in the method {@link ome.ol3.source.Regions#needsClustering}
	 * using among other things the threshold {@link ome.ol3.CLUSTERING_THRESHOLD}
	 *
	 * @type {boolean}
 	 * @private
 	 */
 	 this.useClusteredCollection_ = false;

	/**
 	 * Flag that is used to determine transitions to/fro clustered state
 	 * @type {boolean}
   * @private
   */
 	this.previouslyClustered_ = null;

	/**
	 * clustered RTrees arrangend in levels
	 * @type {Array.<Array.<ome.ol3.feature.Cluster>>}
	 * @private
	 */
	 this.clusteredRTrees_ = null;

	/**
	 * the presently used clustered RTrees level
	 * @type {number}
	 * @private
	 */
	this.currentRTreeLevel_ = 0;

	/**
	 * the associated regions information
	 * as retrieved from the omero server
	 * @type {Object}
	 * @private
	 */
	 this.regions_info_ = null;

     /**
      * used as a lookup container for new, unsaved shapes
 	  * @type {Object}
 	  * @private
 	  */
 	 this.new_unsaved_shapes_ = {};

	/**
	 * the viewer reference
	 *
	 * @type {ome.ol3.Viewer}
	 * @private
	 */
	 this.viewer_ = viewerReference;

	 /**
 	 * a select interaction
 	 *
 	 * @type {ome.ol3.interaction.Select}
 	 * @private
 	 */
 	 this.select_ = null;

	 /**
 	 * a translate interaction
 	 *
 	 * @type {ome.ol3.interaction.Translate}
 	 * @private
 	 */
 	 this.translate_ = null;

	 /**
 	 * a modify interaction
 	 *
 	 * @type {ome.ol3.interaction.Modify}
 	 * @private
 	 */
 	 this.modify_ = null;

	 /**
 	 * a draw interaction
 	 *
 	 * @type {ome.ol3.interaction.Draw}
 	 * @private
 	 */
 	 this.draw_ = null;

	 /**
 	 * array of moded presently used
 	 *
 	 * @type {Array}
 	 * @private
 	 */
	 this.present_modes_ = [];

	/**
	 * The initialization function performs the following steps:
	 * 1. Request regions data as json and store it internally
	 * 2. Convert the json response into open layers objects
	 * 		(ol.Feature and ol.geom.Geometry) and add them to its internal collection
	 * 3. Instantiate a regions layer (ol.vector.Regions) and add it to the map
	 *
	 * Note: steps 2 and 3 are done asynchroniously after the regions data
	 * 			has been received.
 	 *
 	 * @function
	 * @param {Object} scope the java script context
 	 * @private
 	 */
 	this.initialize_ = function(scope) {
		// the success handler that creates the vector layer and adds it to
		// the open layers map
		var success = function(data) {
			if (typeof(data) === 'string') {
				try {
					data = JSON.parse(data);
				} catch(parseError) {
					console.error("Failed to parse json response!");
				}
			}
			if (typeof(data) !== 'object') {
					console.error("Regions Request did not receive proper response!");
					return;
			 }

			 // store response internally to be able to work with it later
			 scope.regions_info_ = data;
             scope.new_unsaved_shapes_ = {}; // reset
			 var regionsAsFeatures =
			 	ome.ol3.utils.Regions.createFeaturesFromRegionsResponse(scope);
			 if (ome.ol3.utils.Misc.isArray(regionsAsFeatures) && regionsAsFeatures.length > 0) {
					scope.addFeatures(regionsAsFeatures);
				}
			};

		 // define request settings
		 var reqParams = {
			 "server" : scope.viewer_.getServer(),
			 "uri" : '/webgateway/get_rois_json/' +
			  	scope.viewer_.getId(),
				"jsonp" : true, // this will only count if we are cross-domain
			 "success" : success,
			 "error" : function(error) {
				 console.error("Error retrieving regions info for id: " +
				  scope.viewer_.getId() +
				 	((error && error.length > 0) ? ("\\n" + error) : ""));
			 }
		 };

		 // send request
		 ome.ol3.utils.Net.sendRequest(reqParams);
	};

	// might be we enter into this constructor with generated features.
	// deal with them first
	if (optGeneratedFeatures) {
		// we run updateStyle over the shapes
		for (var s in optGeneratedFeatures) {
			var f = optGeneratedFeatures[s];
			var rot = this.viewer_.viewer_.getView().getRotation();
			var res = this.viewer_.viewer_.getView().getResolution();
			// in case we got created in a rotated view
			if (f.getGeometry() instanceof ome.ol3.geom.Label && rot !== 0 &&
				!this.rotate_text_)
				f.getGeometry().rotate(-rot);
			// apply style function
			ome.ol3.utils.Style.updateStyleFunction(f, this, true);
		}
		this.addFeatures(optGeneratedFeatures);
	}

	// execute initialization function
	this.initialize_(this);
}
goog.inherits(ome.ol3.source.Regions, ol.source.Vector);


/**
 * This method enables and disables modes, i.e. it (dis)allows certain interactions
 * The disabling works by selecting a mutually exlusive mode or default.
 * see: {@link ome.ol3.REGIONS_MODE}
 *
 * <p>
 * As mentioned already, some modes are inclusive and others mutually exclusive.
 * One can either DRAW or MODIFY but not both at the same time. DEFAULT will over
 * ride any othe mode to deregister all modes presently active.
 * Both, TRANSLATE and MODIFY require select internally, so it's strictly speaking
 * not require to add SELECT explicitly. DRAW is mutually exclusive of everything.
 * it should be noted that modes can unecessarily be handed in multiple times
 * which makes of course no difference. What makes a difference, however, is
 * the order in which they come in with the only exception of DEFAULT. So if you
 * happen to hand in a DRAW and then a MODIFY, MODIFY will get choosen since it
 * overrrided the previous DRAW.
 *
 * The required parameter to the function takes an array of values
 * where the key is a ome.ol3.REGIONS_MODE enum value and the value is a boolean
 *
 * <pre>[ome.ol3.REGIONS_MODE.SELECT, ome.ol3.REGIONS_MODE.TRANSLATE]</pre>
 *
 * @param {Array.<number>} modes an array of modes
 */
ome.ol3.source.Regions.prototype.setModes = function(modes) {
	if (!ome.ol3.utils.Misc.isArray(modes)) return;

	var defaultMode = false;
	var selectMode = false;
	var translateMode = false;
	var modifyMode = false;
	var drawMode = false;

	// empty present modes, remembering old ones for draw reset
	var oldModes = this.present_modes_.slice();
	this.present_modes_ = [];

	for (var m in modes) {
		// we have to be a numnber and within the enum range
		if (typeof(modes[m]) !== 'number' || modes[m] < 0 || modes[m] > 4)
			continue;

		if (modes[m] === ome.ol3.REGIONS_MODE['DEFAULT']) { // DEFAULT
			defaultMode = true;
			selectMode = translateMode = modifyMode = drawMode = false;
			break;
		}

		if (modes[m] === ome.ol3.REGIONS_MODE['SELECT']) { // SELECT
			selectMode = true;
			drawMode = false; // mutally exclusive
			continue;
		}

		if (modes[m] === ome.ol3.REGIONS_MODE['TRANSLATE']) { // TRANSLATE
			selectMode = true; // we need it
			translateMode = true; // set it
			drawMode = false; // mutally exclusive
			continue;
		}

		if (modes[m] === ome.ol3.REGIONS_MODE['MODIFY']) { // MODIFY
			selectMode = true; // we need it
			modifyMode = true; // set it
			drawMode = false; // mutally exclusive
			continue;
		}

		if (modes[m] === ome.ol3.REGIONS_MODE['DRAW']) { // DRAW
			selectMode = false; // mutally exclusive
			translateMode = false; // mutally exclusive
			modifyMode = false; // mutally exclusive
			drawMode = true; // we set it
			continue;
		}
	}

	// this section here does the interaction registration/deregistration
	var removeModifyInteractions = function(keep_select) {
        if (typeof keep_select !== 'boolean') keep_select = false;
		if (this.modify_) {
			this.viewer_.viewer_.getInteractions().remove(this.modify_);
			this.modify_.dispose();
			this.modify_ = null;
		}
		if (this.translate_) {
			this.viewer_.viewer_.getInteractions().remove(this.translate_);
			this.translate_.dispose();
			if (this.viewer_.viewer_.getTargetElement())
                this.viewer_.viewer_.getTargetElement().style.cursor = "";
			this.translate_ = null;
		}
		if (!keep_select && this.select_) {
			// if multiple (box) select was on, we turn it off now
			this.viewer_.removeInteractionOrControl("boxSelect");
			this.select_.clearSelection();
			this.viewer_.viewer_.getInteractions().remove(this.select_);
			this.select_.dispose();
			this.changed();
			this.select_ = null;
		}
	}

	var removeDrawInteractions = function() {
		if (this.draw_) {
			this.draw_.dispose();
			this.draw_ = null;
		}
	}

	var addSelectInteraction = function() {
		if (this.select_ === null) {
			this.select_ = new ome.ol3.interaction.Select(this);
			this.viewer_.viewer_.addInteraction(this.select_);
			// we also add muliple (box) select by default
			this.viewer_.addInteraction(
				"boxSelect",
				new ome.ol3.interaction.BoxSelect(this));
		}
	}

	if (defaultMode) { // reset all interactions
		removeDrawInteractions.call(this);
		removeModifyInteractions.call(this);
		this.present_modes_.push(ome.ol3.REGIONS_MODE.DEFAULT);
		return;
	}

	if (drawMode) { // remove mutually exclusive interactions
		removeModifyInteractions.call(this);
		if (this.draw_ === null) { // no need to do this if we have a draw already
			this.draw_ = new ome.ol3.interaction.Draw(oldModes, this);
		}
		this.present_modes_.push(ome.ol3.REGIONS_MODE.DRAW);
		return;
	}

    // this gets rid of any existing modifies but leaves select
    removeModifyInteractions.call(this, true);
	if (modifyMode) { // remove mutually exclusive interactions
		removeDrawInteractions.call(this);
		addSelectInteraction.call(this);
		if (this.modify_ === null) {
			this.modify_ = new ome.ol3.interaction.Modify(this);
			this.viewer_.viewer_.addInteraction(this.modify_);
		}
		this.present_modes_.push(ome.ol3.REGIONS_MODE.MODIFY);
	}

	if (translateMode) { // remove mutually exclusive interactions
		removeDrawInteractions.call(this);
		addSelectInteraction.call(this);
		if (this.translate_ === null) {
			this.translate_ = new ome.ol3.interaction.Translate(this);
			this.viewer_.viewer_.addInteraction(this.translate_);
		}
		this.present_modes_.push(ome.ol3.REGIONS_MODE.TRANSLATE);
	}

	if (selectMode) { // remove mutually exclusive interactions
		removeDrawInteractions.call(this);
		addSelectInteraction.call(this);
		this.present_modes_.push(ome.ol3.REGIONS_MODE.SELECT);
	}
}

/**
 * 'Updates' the features for the image. This method is used internally but can
 * be called explicitly. In the latter case you would want to use it with the
 * first parameter set to true since otherwise it will just take the rois that
 * were internally stored and add them again after clearing the existing ones.
 * With 'request_info', at a minumum, a new server request is made to reflect
 * potential changes.
 *
 * @param {boolean=} request_info force a server request to get the up-to-date rois
 */
ome.ol3.source.Regions.prototype.updateRegions= function(request_info) {
	var makeServerRequest = false;
	if (typeof(request_info) === 'boolean') makeServerRequest = request_info;

	if (this.select_)
		this.select_.clearSelection();
	this.viewer_.removeRegions(true); // removes masks only

	// remember any features we added
	var allFeatures = this.featuresRtree_.getAll();
	for (var f in allFeatures) {
        var feat = allFeatures[f];
		if (feat['state'] === ome.ol3.REGIONS_STATE.ADDED &&
                typeof this.new_unsaved_shapes_[feat.getId()] !== 'object')
			this.new_unsaved_shapes_[feat.getId()] = feat;
    }

	this.clear(); //wipe everything including objects/members used for clustering
	if (makeServerRequest) {
		this.initialize_(this); // simply reinitialize
		return;
	}

	// just take the roi info that we had already (and include orphaned additions)
	var regionsAsFeatures =
		ome.ol3.utils.Regions.createFeaturesFromRegionsResponse(this, true);
	if (!ome.ol3.utils.Misc.isArray(regionsAsFeatures)) regionsAsFeatures = [];
	if (regionsAsFeatures.length > 0)
		this.addFeatures(regionsAsFeatures);
}

/**
 * Sets the scale text flag
 *
 * @param {boolean} scaleText a flag whether text should be scaled with resolution changes
 */
ome.ol3.source.Regions.prototype.setScaleText = function(scaleText) {
	if (typeof(scaleText) !== 'boolean') return;

	// set member flag
	this.scale_text_ = scaleText;
	this.changed();
}

/**
 * Sets the rotate text flag
 *
 * @param {boolean} rotateText a flag whether text should be rotated along with the view
 */
ome.ol3.source.Regions.prototype.setRotateText = function(rotateText) {
	if (typeof(rotateText) !== 'boolean') return;

	// set member flag
	this.rotate_text_ = rotateText;
	this.changed();
}

/**
 * Finds the features within the present view extent. For internal use.
 *
 * @private
 * @param {ol.Extent} extent the extent
 * @param {number} level a level to use for level rtree search or -1 to use the feature rtree
 * @return {Array.<Array.<ol.Extent, ol.Feature>>|null}
 *	returns the rbush interections with the view or null if no rbush is present
 */
ome.ol3.source.Regions.prototype.findFeaturesInViewExtent = function(extent, level) {
	if (ome.ol3.utils.Misc.isArray(this.clusteredRTrees_) &&
				level >= 0 && level < this.clusteredRTrees_.length)
			return this.clusteredRTrees_[level].getInExtent(extent);

	if (this.featuresRtree_ && this.featuresRtree_.rbush_)
		return this.featuresRtree_.getInExtent(extent);

	return null;
}

/**
 * Internal Method to kick of reclustering asynchroniously.
 *
 * @private
 */
ome.ol3.source.Regions.prototype.clusterFeaturesAsynchronously = function() {
	setTimeout(
		function() {
			this.clusterFeatures();
		}.bind(this), 0);
}

/**
 * Internal Method to kick of reclustering.
 *
 * @private
 */
ome.ol3.source.Regions.prototype.clusterFeatures = function() {
	if (!this.useClustering_) return;

	this.clusteredRTrees_ =
		ome.ol3.utils.Regions.clusterFeatures(
			this.featuresRtree_,
			ome.ol3.CLUSTERING_THRESHOLD);

	if (!ome.ol3.utils.Misc.isArray(this.clusteredRTrees_) || // something went wrong during clustering
				this.clusteredRTrees_.length === 0) return;

	for (var l in this.clusteredRTrees_)
		this.clusteredRTrees_[l].forEach(
			function(feature) {
				if (feature instanceof ome.ol3.feature.Cluster) {
					ome.ol3.utils.Style.updateStyleFunction(feature, this, true);
					feature['group_selected'] = false;
				}
		}, this);
	this.changed();
};

/**
 * Overridden method calls clustering after insertion
 * @param {Array.<ol.Feature>} features Features to add.
 */
ome.ol3.source.Regions.prototype.addFeatures = function(features) {
	if (!this.useClustering_) {
		ol.source.Vector.prototype.addFeatures.call(this,features);
		return;
	}

	this.addFeaturesInternal(features);
	this.clusterFeatures();
};

/**
 * Overridden method calls clustering after insertion
 *
 * @param {ol.Feature} feature Feature to add.
 */
ome.ol3.source.Regions.prototype.addFeature = function(feature) {
	if (!this.useClustering_) {
		ol.source.Vector.prototype.addFeature.call(this,feature);
		return;
	}

	this.addFeatureInternal(feature);
	this.clusterFeaturesAsynchronously();
};

/**
 * Overridden method calls clustering after deletion
 *
 * @param {ol.Feature} feature Feature to remove.
 */
ome.ol3.source.Regions.prototype.removeFeature = function(feature) {
	if (!this.useClustering_) {
		ol.source.Vector.prototype.removeFeature.call(this, feature);
		return;
	}

	var featureKey = ol.getUid(feature).toString();
  if (featureKey in this.nullGeometryFeatures_) {
    delete this.nullGeometryFeatures_[featureKey];
  } else {
    if (this.featuresRtree_) {
      this.featuresRtree_.remove(feature);
    }
  }
  this.removeFeatureInternal(feature);
	this.clusterFeaturesAsynchronously();
};

/**
 * Remove all features from the source.
 */
ome.ol3.source.Regions.prototype.clear = function() {
	if (ome.ol3.utils.Misc.isArray(this.clusteredRTrees_)) {
		for (var l in this.clusteredRTrees_)
			if (this.clusteredRTrees_[l] instanceof ol.structs.RBush)
				this.clusteredRTrees_[l].clear();
				delete this.clusteredRTrees_[l];
	}

	// delegate
	ol.source.Vector.prototype.clear.call(this, true);

	// reset
	this.featureChangeKeys_ = {};
	this.idIndex_ = {};
	this.undefIdIndex_ = {};
	this.featuresCollection_ = null;
	this.useClusteredCollection_ = false;
 	this.previouslyClustered_ = null;
	this.clusteredRTrees_ = null;
 	this.currentRTreeLevel_ = 0;
}

/**
 * This method is called within the rendering workflow and is overridden
 * to take clustering into account. If there is a non-empty collection of
 * containing a filtered/clustered set of features we return it
 *
 * @param {ol.Extent} extent Extent.
 * @param {function(this: T, ol.Feature): S} callback Called with each feature
 *     whose bounding box intersects the provided extent.
 * @param {T=} opt_this The object to use as `this` in the callback.
 * @return {S|undefined} The return value from the last call to the callback.
 * @template T,S
 */
ome.ol3.source.Regions.prototype.forEachFeatureInExtent = function(extent, callback, opt_this) {
	if (typeof(opt_this) === 'undefined' || opt_this === null)
		opt_this = this;

	// do we need to show the clusters
	var useClusteredCollection = this.needsClustering();

    // determine if we had a transition change from clustered -> unclustered
    // set previously clustered state if not already set
    var fromClusterToUnclustered =
        (this.previouslyClustered_ !== null &&
                this.previouslyClustered_ !== useClusteredCollection &&
                this.previouslyClustered_ && !useClusteredCollection);
    this.previouslyClustered_ = useClusteredCollection; // remember new state

    // check out which tree fits our purpose best
    var indexToUse = 0;
	if (useClusteredCollection)
		for (var c=0;c<this.clusteredRTrees_.length;c++)
			if (!this.needsClustering(null, c)) {
				indexToUse = c;
				break;
			}
    var rTreeLevelChanged = this.currentRTreeLevel_ != indexToUse;
	this.currentRTreeLevel_ = indexToUse;

    // unselect clusters on level changes,
    // individually selected features can stay
    if (this.select_) {
        var selArray = this.select_.getFeatures().getArray();
        var len = selArray.length-1;
        while (len >= 0) {
            var selItem = selArray[len];
            if ((rTreeLevelChanged || fromClusterToUnclustered) &&
                    selItem instanceof  ome.ol3.feature.Cluster) {
                selItem['selected'] = false;
                this.select_.getFeatures().removeAt(len);
            }
            if (!(selItem instanceof ome.ol3.feature.Cluster) &&
                    useClusteredCollection &&
                        selItem.getGeometry().intersectsExtent(extent))
                callback.call(opt_this, selItem);
            len--;
        }
    }

    // simplest scenario: no clustering, select individual features in extent => bye
	if (!useClusteredCollection || !ome.ol3.utils.Misc.isArray(this.clusteredRTrees_) ||
				this.clusteredRTrees_.length === 0) // no clustering
		return this.featuresRtree_.forEachInExtent(
			extent,
			function(feature) {
				if ((typeof(feature['visible']) === 'boolean' &&
                    !feature['visible']) ||
                    (typeof feature['state'] === 'number' &&
                        feature['state'] === ome.ol3.REGIONS_STATE.REMOVED))
					return;
				callback.call(opt_this, feature);
			}, opt_this);


    // display cluster features in extent
	var ret = this.clusteredRTrees_[indexToUse].forEachInExtent(
		extent,
		function(feature) {
			if (fromClusterToUnclustered && feature instanceof ome.ol3.feature.Cluster)
				feature['selected'] = false;

			if (feature instanceof ome.ol3.feature.Cluster
				&& (!useClusteredCollection || feature['selected']) &&
				ol.extent.intersects(extent, feature.getBBox())) {
					if (useClusteredCollection && feature['visible'])
							callback.call(opt_this, feature);
						for (var f in feature.features_) {// unclustered
							var visible = true;
							if ((typeof feature['visible'] === 'boolean' &&
                                !feature['visible']) ||
                                    (typeof feature['state'] === 'number' &&
                                    feature['state'] === ome.ol3.REGIONS_STATE.REMOVED))
								visible = false;
							var geometry = feature.features_[f].getGeometry();
							if (visible && geometry && geometry.intersectsExtent(extent))
								callback.call(opt_this, feature.features_[f]);
						}
			} else if (feature.getGeometry() &&
                    (typeof feature['visible'] !== 'boolean' || feature['visible']) &&
                        (typeof feature['state'] !== 'number' ||
                            feature['state'] !== ome.ol3.REGIONS_STATE.REMOVED) &&
					        feature.getGeometry().intersectsExtent(extent))
						callback.call(opt_this, feature);
		}, opt_this);

		return ret;
};

/**
 * Get all features on the source.
 * @return {Array.<ol.Feature>} Features.
 */
ome.ol3.source.Regions.prototype.getFeatures = function() {
	if (!this.useClustering_ ||
			!ome.ol3.utils.Misc.isArray(this.clusteredRTrees_) ||
			this.clusteredRTrees_.length === 0) // no clustering
		return this.featuresRtree_.getAll();

	var presentlyUsedRTreeLevel = this.currentRTreeLevel_;
	if (presentlyUsedRTreeLevel < 0 ||
		presentlyUsedRTreeLevel >= this.clusteredRTrees_.length)
		presentlyUsedRTreeLevel = 0;
  return this.clusteredRTrees_[presentlyUsedRTreeLevel].getAll();
};

/**
 * Assesses whether we want to apply clustering or not
 *
 * @private
 * @param {ol.Extent=} extent the extent we are viewing.
 * @param {number=} level count using the level rtrees.
 * @return {boolean} clustering true or false
 */
ome.ol3.source.Regions.prototype.needsClustering = function(extent, level) {
	if (!this.useClustering_) {
		this.useClusteredCollection_ = false;
		return false;
	}

	var ret = false;

	if (!ome.ol3.utils.Misc.isArray(extent) || extent.length !== 4)
		extent = this.viewer_.getViewExtent();

	level = typeof(level) === 'number' ? level : -1;

	// find all features within the present extent
	var hits = this.findFeaturesInViewExtent(extent, level);

	// use the clustered collection if we are above the threshold or
	// have reached the minumum resolution
	if (ome.ol3.utils.Misc.isArray(hits) && (
				hits.length > ome.ol3.CLUSTERING_THRESHOLD &&
					this.viewer_.viewer_.getView().getResolution() !==
					this.viewer_.viewer_.getView().minResolution_))
		ret = true;

	if (level === -1) this.useClusteredCollection_ = ret;
	return ret;
}

/**
 * Persists modified/added shapes
 *
 * @param {Object} roisAsJsonObject a populated object for json serialization
 */
ome.ol3.source.Regions.prototype.storeRegions = function(roisAsJsonObject) {
	// we need the csrftoken for posting...
	var csrftoken  = ome.ol3.utils.Misc.getCookie("csrftoken");
	if (csrftoken === "") return; // post won't be accepted without csrftoken

	// we do this in batches of 250 which will complete in a reasonable time
	// so that we don't run into a timeout
	var batch = {
		"nextRoiId" : "",
		"nextShapeId" : "",
		"storedCount" : 0
	};
	var imageId = this.viewer_.id_;

	// this method chops up our larger numbers into smaller batches
	var getJsonForNextBatchToPost = function(batch) {
		var counter = 0;
		var rois = {};
		var json;
		for (var r in roisAsJsonObject['rois']) {
			if (batch['nextRoiId'] !== "" && r !== batch['nextRoiId'])
				continue; // skip forward to out next roi
			batch['nextRoiId'] = "";

			if (counter >= 250) { // we are above batch size => set next roi and shape
				batch['nextRoiId'] = r;
				batch['nextShapeId'] = s;
				break;
			}

			for (var s in roisAsJsonObject['rois'][r]['shapes']) {
				if (batch['nextShapeId'] !== "" && s !== batch['nextShapeId'])
					continue; // skip forward to out next shape id
				batch['nextShapeId'] = "";

				// we are above batch size => set next roi and shape
				if (counter >= 250) { // we are above batch size => set next roi and shape
					batch['nextRoiId'] = r;
					batch['nextShapeId'] = s;
					break;
				}

				// else add roi/shape
				if (typeof(rois[r]) !== 'object')
					rois[r] = {
						"@id" : parseInt(r),
						"@type" : "http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI",
						"shapes" : []};
				rois[r]['shapes'].push(roisAsJsonObject['rois'][r]['shapes'][s]);
				++counter;
			}
		}
		if (counter < 250) { // we are done
			// reset
			batch['nextRoiId'] = "";
			batch['nextShapeId'] = "";
		}
		if (counter === 0) // modulo batch size
			return "";

		// turn object into json
		try {
			// add the image id so that the server knows which image is concerned
			var objectToStringify = {"imageId" : imageId, "count" : counter};
			objectToStringify['rois'] = rois;
			return JSON.stringify(objectToStringify);
		} catch(jsonStringifyFailed) {
			return null;
		}
	};

	// fetch next batch to process
	var postContent = getJsonForNextBatchToPost(batch);

	// set post properties and handlers
	var properties = {
		"server" : this.viewer_.getServer(),
		"uri" : '/ol3-viewer/postrois', // TODO: would be nice if this became webgateway
		"method" : 'POST',
		"content" : postContent,
		"headers" : {"X-CSRFToken" : csrftoken},
	 "jsonp" : false,
	 "error" : function(error) {
		console.error("Failed to store regions: " +
		 ((error && error.length > 0) ? ("\\n" + error) : ""));
	 }
 	};

	// the success handler for the POST
	var capturedRegionsReference = this;
	properties["success"] = function(data) {
			 if (typeof(data) !== 'string')
				console.error("Did not receive any data after regions post");

			 try {
				 data = JSON.parse(data);
			 } catch(parseError) {
				 console.error("Failed to parse json response for regions storage!");
			 }
			 if (typeof(data['error']) === 'string') {
				 console.error("Failed to store rois: " + data['error']);
				 return;
			 }
			 if (typeof(data['ids']) === 'object') {
				 // synchronize ids and states
				 for (var id in data['ids']) {
					 try {
						 capturedRegionsReference.idIndex_[id]['state'] = ome.ol3.REGIONS_STATE.DEFAULT;
						 capturedRegionsReference.idIndex_[id].setId(data['ids'][id]);
						 batch['storedCount']++;
					 } catch(wrongIndex) {}
				 }

				 // send off of next batch
				 if (batch['nextRoiId'] !== "" && batch['nextShapeId'] !== "") {
					 properties['content'] =
					 	getJsonForNextBatchToPost(batch);
						if (properties['content'] === null) {
							console.error("Failed to construct json for rois request!");
							return;
						} else if (properties['content'] === "")
							return;

						// send request
						ome.ol3.utils.Net.sendRequest(properties, this);
				 }
				 if (batch['storedCount'] !== roisAsJsonObject['count'])
				 	console.error("Not all added/modified rois were stored: "
					+ batch['storedCount'] + "/" + roisAsJsonObject['count']);
				 return;
			 }
			 console.error("Received unexpected data after regions post");
		};

	if (postContent === null) {
		console.error("Failed to construct json for rois request!");
		return;
	} else if (postContent === "")
		return;

	// send request
	ome.ol3.utils.Net.sendRequest(properties, this);
}

/**
 * Sets a property of a list of features.
 * Used internally for changing visibility, select and state of features
 *
 * @private
 * @param {Array<string>} roi_shape_ids a list of string ids of the form: roi_id:shape_id
 * @param {string} property the property to be set
 * @param {Object} value the new value for the property
 */
ome.ol3.source.Regions.prototype.setProperty =
    function(roi_shape_ids, property, value) {

	if (!ome.ol3.utils.Misc.isArray(roi_shape_ids) ||
        typeof property !== 'string' ||
        typeof value === 'undefined' ||
        typeof this.idIndex_ !== 'object') return;

    let changedFeatures = [];
    var eventProperty = null;
    for (var r in roi_shape_ids) {
        var s = roi_shape_ids[r];

        if (this.idIndex_[s] instanceof ol.Feature && // we have to be a feature
            this.idIndex_[s][property] !== value) { // prop has to have changed

            // some special cases
            if (this.select_ instanceof ome.ol3.interaction.Select) {
                if (property === 'selected' && value)
                    this.select_.getFeatures().push(this.idIndex_[s]);
                else if ((property === 'selected' || property === 'visible') &&
                    !value) {
                    this.idIndex_[s]['selected'] = false;
                    this.select_.getFeatures().remove(this.idIndex_[s]);
                } else if (property === 'state') {
                    if (value === ome.ol3.REGIONS_STATE.REMOVED) {
                        this.select_.toggleFeatureSelection(
                            this.idIndex_[s], false);
                        this.idIndex_[s]["old_state"] =
                            this.idIndex_[s][property];
                        eventProperty = "deleted";
                    } else if (value === ome.ol3.REGIONS_STATE.MODIFIED) {
                        eventProperty = "modified";
                    } else if (value === ome.ol3.REGIONS_STATE.ROLLBACK) {
                        eventProperty = "rollback";
                        value =
                            typeof this.idIndex_[s]["old_state"] === 'number' ?
                                this.idIndex_[s]["old_state"] :
                                ome.ol3.REGIONS_STATE.DEFAULT;
                    }
                }
            }

            // set new value
            this.idIndex_[s][property] = value;
            changedFeatures.push(s);
        }
    }
    this.changed();

    var config_id = this.viewer_.getTargetId();
    var eventbus = this.viewer_.eventbus_;
    if (eventProperty && eventbus) // publish
        setTimeout(function() {
            eventbus.publish("REGIONS_PROPERTY_CHANGED",
                {"config_id": config_id,
                    "property" : eventProperty,
                    "shapes": changedFeatures, value: true});
        },25);
}

/**
 * Clean up
 */
ome.ol3.source.Regions.prototype.disposeInternal = function() {
	this.clear();
	this.featuresRtree_ = null;
	this.loadedExtentsRtree_ = null;
  this.nullGeometryFeatures_ = null;
	this.regions_info_ = null;
	this.viewer_ = null;
};
