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
     * this flag determines whether text is displayed for shapes other than labels
     * Defauls to false
     * @type {boolean}
     * @private
     */
     this.show_comments_ = false;

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
 	 * a history for translations and modifications
     * keeping old and new versions of the respective geometries
 	 *
 	 * @type {Object}
 	 * @private
 	 */
     this.history_ = {};

     /**
 	  * an autoincremented history id
 	  * @type {number}
 	  * @private
 	  */
     this.history_id_ = 0;

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
            if (ome.ol3.utils.Misc.isArray(regionsAsFeatures) &&
                regionsAsFeatures.length > 0) {
                    scope.addFeatures(regionsAsFeatures);
            }
        };

         // define request settings
         var reqParams = {
             "server" : scope.viewer_.getServer(),
             "uri" : scope.viewer_.getPrefixedURI(ome.ol3.WEBGATEWAY) +
                     '/get_rois_json/' + scope.viewer_.getId(),
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
                !this.rotate_text_) f.getGeometry().rotate(-rot);
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
        if (this.draw_ === null) // no need to do this if we have a draw already
            this.draw_ = new ome.ol3.interaction.Draw(oldModes, this);
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

    this.clear();
    if (makeServerRequest) {
        this.initialize_(this); // simply reinitialize
        return;
    }

    // just take the roi info that we had already (and include orphaned additions)
    var regionsAsFeatures =
        ome.ol3.utils.Regions.createFeaturesFromRegionsResponse(this, true);
    if (!ome.ol3.utils.Misc.isArray(regionsAsFeatures)) regionsAsFeatures = [];
    if (regionsAsFeatures.length > 0) this.addFeatures(regionsAsFeatures);
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
 * This method determines which features are seen. We overrided the standard
 * implementation to cater for t,p,c visible and removed constraints
 *
 * @param {ol.Extent} extent Extent.
 * @param {function} callback for each feature in extent
 * @param {object=} opt_this The object to use as `this` in the callback.
 * @return {S|undefined} The return value from the last call to the callback.
 */
ome.ol3.source.Regions.prototype.forEachFeatureInExtent =
    function(extent, callback, opt_this) {

    return this.featuresRtree_.forEachInExtent(extent, function(feature) {
        // here we filter for t,z and c (if applicable)
        // and deleted flag or whether wie are invisible
        var visible =
            typeof(feature['visible']) !== 'boolean' || feature['visible'];
        var deleted =
            typeof feature['state'] === 'number' &&
                feature['state'] === ome.ol3.REGIONS_STATE.REMOVED;
        var belongsToDimension = true;

        var viewerT = this.viewer_.getDimensionIndex('t');
        var viewerZ = this.viewer_.getDimensionIndex('z');
        var viewerCs = this.viewer_.getDimensionIndex('c');
        var shapeT = typeof feature['theT'] === 'number' ? feature['theT'] : -1;
        var shapeZ = typeof feature['theZ'] === 'number' ? feature['theZ'] : -1;
        var shapeC = typeof feature['theC'] === 'number' ? feature['theC'] : -1;

        // whenever we have a dimension that the shape belongs but doesn't
        // correspond with the viewer's present settings
        // we will not include it in the results
        if ((shapeC !== -1 && viewerCs.indexOf(shapeC) === -1) ||
                (shapeT !== -1 && shapeT !== viewerT) ||
                (shapeZ !== -1 && shapeZ !== viewerZ))
                    belongsToDimension = false;

        if (visible && !deleted && belongsToDimension)
            callback.call(this, feature);
    }, this);
};

/**
 * Persists modified/added shapes
 *
 * @param {Object} roisAsJsonObject a populated object for json serialization
 * @param {string} uri a uri to post to for persistance
 * @param {boolean} omit_client_update an optional flag that's handed back to the client
 *                  to indicate that a client side update to the response is not needed
 * @return {boolean} true if peristence request was made, false otherwise
 */
ome.ol3.source.Regions.prototype.storeRegions =
    function(roisAsJsonObject, uri, omit_client_update) {

    if (typeof omit_client_update !== 'boolean') omit_client_update = false;

    try {
        // loop over given given shapes, wrapping them
        var rois = {};
        for (var r in roisAsJsonObject['rois']) {
            for (var s in roisAsJsonObject['rois'][r]['shapes']) {
                // else add roi/shape
                if (typeof(rois[r]) !== 'object') {
                    var newRois = {
                        "@type" : "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI",
                        "shapes" : []
                    };
                    var roisId = parseInt(r);
                    if (roisId >= 0) newRois['@id'] = roisId;
                    rois[r] = newRois;
                }
                rois[r]['shapes'].push(roisAsJsonObject['rois'][r]['shapes'][s]);
            }
        };
        var postContent = {
            "imageId": this.viewer_.id_,
            "rois": rois
        };

        // set properties for ajax request
        var properties = {
            "server" : this.viewer_.getServer(),
            "uri" : uri,
            "method" : 'POST',
            "content" : JSON.stringify(postContent),
            "headers" : {"X-CSRFToken" : ome.ol3.utils.Misc.getCookie("csrftoken")},
            "jsonp" : false
     	};

        var capturedRegionsReference = this;
        // the event notification
        var sendEventNotification = function(viewer, params) {
            var config_id = viewer.getTargetId();
            var eventbus = viewer.eventbus_;
            if (config_id && eventbus) {
                params['config_id'] = config_id;
                eventbus.publish("REGIONS_STORED_SHAPES", params);
            }
        }

        // the success handler for the POST
        properties["success"] = function(data) {
            var error = null;
            try {
                data = JSON.parse(data);

                // synchronize ids and states
                if (!omit_client_update) {
                    for (var id in data['ids']) {
                        var f = capturedRegionsReference.idIndex_[id];
                        if (f['state'] === ome.ol3.REGIONS_STATE.REMOVED)
                            capturedRegionsReference.removeFeature(f);
                        else {
                            f['state'] = ome.ol3.REGIONS_STATE.DEFAULT;
                            f.setId(data['ids'][id]);
                        }
                    }
                }
            } catch(err) {
                error = err;
            }

            var params = {
                "shapes":
                    typeof data === 'object' &&
                    typeof data['ids'] === 'object' ? data['ids'] : null,
                "omit_client_update" : omit_client_update
            };
            if (error) params['error'] = error;

            sendEventNotification(capturedRegionsReference.viewer_, params);
        };

        // the error handler for the POST
        properties["error"] = function(error) {
            var params = {
                "shapes": [],
                "error" : error
            };
            sendEventNotification(capturedRegionsReference.viewer_, params);
        };

        // send request
        ome.ol3.utils.Net.sendRequest(properties, this);
    } catch(requestNotSent) {
        console.error(requestNotSent);
        return false;
    }
    return true;
}

/**
 * Sets a property of a list of features.
 * Used internally for changing visibility, select and state of features
 *
 * @private
 * @param {Array<string>} roi_shape_ids a list of string ids of the form: roi_id:shape_id
 * @param {string} property the property to be set
 * @param {Object} value the new value for the property
 * @param {function=} callback an (optional) success handler
 */
ome.ol3.source.Regions.prototype.setProperty =
    function(roi_shape_ids, property, value, callback) {

    if (!ome.ol3.utils.Misc.isArray(roi_shape_ids) ||
        typeof property !== 'string' ||
        typeof value === 'undefined' ||
        typeof this.idIndex_ !== 'object') return;

    var changedFeatures = [];
    var changedProperties = [];
    var changedValues = [];
    var eventProperty = null;
    for (var r in roi_shape_ids) {
        var s = roi_shape_ids[r];

        if (this.idIndex_[s] instanceof ol.Feature) {
            // we allow to toggle the selected state
            // as well as the state for removed, modified and rollback deletes
            var presentState = null;
            var hasSelect = (this.select_ instanceof ome.ol3.interaction.Select);
            if (hasSelect && property === 'selected' && value)
                this.select_.getFeatures().push(this.idIndex_[s]);
            else if (hasSelect && !value &&
                        (property === 'selected' || property === 'visible')) {
                this.select_.toggleFeatureSelection(
                    this.idIndex_[s], false);
            } else if (property === 'state') {
                presentState = this.idIndex_[s][property];
                if (value === ome.ol3.REGIONS_STATE.REMOVED) {
                    if (hasSelect)
                        this.select_.toggleFeatureSelection(
                            this.idIndex_[s], false);
                    // we have already done this
                    if (presentState !== ome.ol3.REGIONS_STATE.REMOVED &&
                        (typeof this.idIndex_[s]["old_state"] !== 'number' ||
                            this.idIndex_[s]["old_state"] !== ome.ol3.REGIONS_STATE.ADDED))
                                this.idIndex_[s]["old_state"] = presentState;
                    eventProperty = "deleted";
                } else if (value === ome.ol3.REGIONS_STATE.MODIFIED) {
                    // we are presently deleted
                    // so all we do is remember the modification as the
                    // 'old_state' in case of a rollback
                    if (presentState === ome.ol3.REGIONS_STATE.REMOVED) {
                        this.idIndex_[s]["old_state"] = value;
                        continue;
                    } else if (presentState === ome.ol3.REGIONS_STATE.ADDED)
                        // we maintain the added state at all times
                        this.idIndex_[s]["old_state"] = presentState;
                    eventProperty = "modified";
                } else if (value === ome.ol3.REGIONS_STATE.ROLLBACK)
                    eventProperty = "rollback";
            }

            // set new value
            this.idIndex_[s][property] =
                (property === 'state' && value === ome.ol3.REGIONS_STATE.ROLLBACK) ?
                    (typeof this.idIndex_[s]["old_state"] === 'number' ?
                        this.idIndex_[s]["old_state"] :
                        ome.ol3.REGIONS_STATE.DEFAULT) : value;

            // gather info for event response
            changedFeatures.push(s);
            var val = true;
            if (eventProperty === 'rollback') {
                eventProperty = 'deleted';
                val = false;
            }
            changedProperties.push(eventProperty);
            changedValues.push(val);
        }
    }
    this.changed();

    var config_id = this.viewer_.getTargetId();
    var eventbus = this.viewer_.eventbus_;
    if (config_id && eventbus) // publish
        setTimeout(function() {
            eventbus.publish("REGIONS_PROPERTY_CHANGED",
                {"config_id": config_id,
                    "properties" : changedProperties,
                    "shapes": changedFeatures,
                    "values": changedValues,
                    "callback": callback });
        },25);
}

/**
 * Adds an old value/new value pair to the history,
 * returning the id for the entry
 * @param {Array.<ol.Feature>} features an array of features containing the geometries
 * @param {boolean} is_old_value
 *          if true we take the geometries to be the old value, otherwise new
 * @return {number} the id for the history entry
 */
ome.ol3.source.Regions.prototype.addHistory =
    function(features, is_old_value, hist_id) {
    if (!ome.ol3.utils.Misc.isArray(features) || features.length === 0) return;

    // get the latest id and increment it, if we don't have an id
    var hist_entry = {};
    if (typeof hist_id !== 'number') {
        hist_id = ++this.history_id_;
        this.history_[hist_id] = hist_entry;
    } else hist_entry = this.history_[hist_id];
    // we have to have either a new(empty) entry or an existing one
    if (typeof hist_entry !== 'object') return;

    // iterate over features and add the geometries to the history
    for (var i=0;i<features.length;i++) {
        var f = features[i];
        // we have a record per feature id for convenient lookup
        // if we don't have one yet, we ar going to create and add it
        var hist_record = { old_value : null, new_value : null};
        if (typeof hist_entry[f.getId()] === 'object')
            hist_record = hist_entry[f.getId()];
        else hist_entry[f.getId()] = hist_record;
        // now set either the old or new value
        var clonedGeometry = f.getGeometry().clone();
        if (is_old_value) hist_record.old_value = clonedGeometry;
        else hist_record.new_value = clonedGeometry;
    }

    return hist_id;
}

/**
 * Undoes/redoes the history
 *
 * @param {number} hist_id the id for the history entry we like to un/redo
 * @param {boolean=} undo if true we undo, if false we redo, default: undo
 */
ome.ol3.source.Regions.prototype.doHistory = function(hist_id, undo) {
    // get the history entry for the given id (if exists)
    if (typeof this.history_[hist_id] !== 'object') return;
    if (typeof undo !== 'boolean') undo = true;
    var hist_entry = this.history_[hist_id];

    // iterate over history records of associated feature ids
    // to then apply the history undo
    for (var f in hist_entry) {
        var hist_record = hist_entry[f];
        // check if we have such as feature
        if (this.idIndex_[f] instanceof ol.Feature)
            this.idIndex_[f].setGeometry(
                undo ? hist_record.old_value : hist_record.new_value);
    }
}

/**
 * Sends out an event notification with the associated history id
 *
 * @param {number} hist_id the id for the history entry we like to un/redo
 */
ome.ol3.source.Regions.prototype.sendHistoryNotification = function(hist_id) {
    // send out notification with shape ids
    var config_id = this.viewer_.getTargetId();
    var eventbus = this.viewer_.eventbus_;
    if (config_id && eventbus) // publish
        eventbus.publish("REGIONS_HISTORY_ENTRY",
                {"config_id": config_id, "hist_id": hist_id});
}

/**
 * Clean up
 */
ome.ol3.source.Regions.prototype.disposeInternal = function() {
    this.clear();
    this.featuresRtree_ = null;
    this.loadedExtentsRtree_ = null;
    this.nullGeometryFeatures_ = null;
    this.history_ = {};
    this.regions_info_ = null;
    this.viewer_ = null;
};
