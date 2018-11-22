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

import VectorSource from "ol/source/vector";
import Feature from "ol/feature";

import {PLUGIN_PREFIX, PROJECTION, REGIONS_MODE, REGIONS_REQUEST_URL, REGIONS_STATE, WEB_API_BASE} from "../Globals";

import Viewer from "../Viewer";
import Select from "../interaction/Select";
import BoxSelect from "../interaction/BoxSelect";
import Draw from "../interaction/Draw";
import Modify from "../interaction/Modify";
import Translate from "../interaction/Translate";
import * as MiscUtils from "../utils/Misc";
import * as NetUtils from "../utils/Net";
import * as RegionsUtils from '../utils/Regions';




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
 * Flags that can be handed in as part of the second (otional argument)
 * are 'rotateText', 'scaleText' which determine whether a shape comment
 * or label text gets scaled with resolutions changes (default behavior)
 * and whether it should get rotated if the rest of the view was rotated
 * (doesn't happen by default), as well as optional rois data that has already
 * been requested. For the latter use a deep clone.
 *
 * e.g:
 * <pre>
 *  { 'rotateText' : false, 'scaleText' : true}
 *</pre>
 *
 * @constructor
 * @extends {ol.source.Vector}
 *
 * @param {ome.ol3.Viewer} viewerReference mandatory reference to the viewer parent
 * @param {Object=} options additional properties for initialization
 */
export default class Regions extends VectorSource {

    constructor(viewerReference, options) {
        if (!(viewerReference instanceof Viewer))
            console.error("Regions needs an ome.ol3.Viewer instance!");

        let opts = options || {};
        // we always use the spatial index
        opts.useSpatialIndex = true;
        // call super
        super(opts);

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
         * @type {ome/ol3/Select}
         * @private
         */
        this.select_ = null;

        /**
         * a translate interaction
         *
         * @type {ome/ol3/Translate}
         * @private
         */
        this.translate_ = null;

        /**
         * a modify interaction
         *
         * @type {ome/ol3/Modify}
         * @private
         */
        this.modify_ = null;

        /**
         * a draw interaction
         *
         * @type {ome/ol3/Draw}
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
         * 1. Make an ajax request for the regions data as json and store it internally
         * 2. Convert the json response into open layers objects
         *    (ol.Feature and ol.geom.Geometry) and add them to its internal collection
         * 3. Instantiate a regions layer (ol.vector.Regions) and add it to the map
         *
         * Note: if data is provided step is skipped
         *
         * @function
         * @param {Object} scope the java script context
         * @param data
         * @private
         */
        this.initialize_ = (scope, data) => {

            // initialize features helper function
            let init0 = data => {
                // store response internally to be able to work with it later
                scope.regions_info_ = data;
                scope.new_unsaved_shapes_ = {}; // reset
                let regionsAsFeatures =
                   RegionsUtils.createFeaturesFromRegionsResponse(scope);
                if (Array.isArray(regionsAsFeatures) &&
                    regionsAsFeatures.length > 0)
                    scope.addFeatures(regionsAsFeatures);
            }

            // we use provided data if there
            if (Array.isArray(data)) {
                init0(data);
                return;
            }

            // define request settings
            let reqParams = {
                "server": scope.viewer_.getServer(),
                "uri": scope.viewer_.getPrefixedURI(WEB_API_BASE) +
                    REGIONS_REQUEST_URL +
                    '/?image=' + scope.viewer_.getId(),
                "success": response => {
                    if (typeof(response) === 'string') {
                        try {
                            response = JSON.parse(response);
                        } catch (parseError) {
                            console.error("Failed to parse json response!");
                        }
                    }
                    if (typeof(response) !== 'object' || response === null) {
                        console.error("Regions Request did not receive proper response!");
                        return;
                    }
                    // delegate
                    init0(response.data);
                }, "error": error => {
                    console.error("Error retrieving regions info for id: " +
                        scope.viewer_.getId() +
                        ((error && error.length > 0) ? ("\\n" + error) : ""));
                }
            };

            // send request
            NetUtils.sendRequest(reqParams);
        };

        // execute initialization function
        this.initialize_(this, opts.data);
    }


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
    setModes = (modes) => {
        if (!Array.isArray(modes)) return;

        let defaultMode = false;
        let selectMode = false;
        let translateMode = false;
        let modifyMode = false;
        let drawMode = false;

        // empty present modes, remembering old ones for draw reset
        let oldModes = this.present_modes_.slice();
        this.present_modes_ = [];

        for (let m in modes) {
            // we have to be a numnber and within the enum range
            if (typeof(modes[m]) !== 'number' || modes[m] < 0 || modes[m] > 4)
                continue;

            if (modes[m] === REGIONS_MODE['DEFAULT']) { // DEFAULT
                defaultMode = true;
                selectMode = translateMode = modifyMode = drawMode = false;
                break;
            }

            if (modes[m] === REGIONS_MODE['SELECT']) { // SELECT
                selectMode = true;
                drawMode = false; // mutally exclusive
                continue;
            }

            if (modes[m] === REGIONS_MODE['TRANSLATE']) { // TRANSLATE
                selectMode = true; // we need it
                translateMode = true; // set it
                drawMode = false; // mutally exclusive
                continue;
            }

            if (modes[m] === REGIONS_MODE['MODIFY']) { // MODIFY
                selectMode = true; // we need it
                modifyMode = true; // set it
                drawMode = false; // mutally exclusive
                continue;
            }

            if (modes[m] === REGIONS_MODE['DRAW']) { // DRAW
                selectMode = false; // mutally exclusive
                translateMode = false; // mutally exclusive
                modifyMode = false; // mutally exclusive
                drawMode = true; // we set it
                continue;
            }
        }

        // this section here does the interaction registration/deregistration
        let removeModifyInteractions = (keep_select) => {
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
        };

        let removeDrawInteractions = () => {
            if (this.draw_) {
                this.draw_.dispose();
                this.draw_ = null;
            }
        };

        let addSelectInteraction = () => {
            if (this.select_ === null) {
                this.select_ = new Select(this);
                this.viewer_.viewer_.addInteraction(this.select_);
                // we also add muliple (box) select by default
                this.viewer_.addInteraction(
                    "boxSelect",
                    new BoxSelect(this));
            }
        };

        if (defaultMode) { // reset all interactions
            removeDrawInteractions.call(this);
            removeModifyInteractions.call(this);
            this.present_modes_.push(REGIONS_MODE.DEFAULT);
            return;
        }

        if (drawMode) { // remove mutually exclusive interactions
            removeModifyInteractions.call(this);
            if (this.draw_ === null) // no need to do this if we have a draw already
                this.draw_ = new Draw(oldModes, this);
            this.present_modes_.push(REGIONS_MODE.DRAW);
            return;
        }

        // this gets rid of any existing modifies but leaves select
        removeModifyInteractions.call(this, true);
        if (modifyMode) { // remove mutually exclusive interactions
            removeDrawInteractions.call(this);
            addSelectInteraction.call(this);
            if (this.modify_ === null) {
                this.modify_ = new Modify(this);
                this.viewer_.viewer_.addInteraction(this.modify_);
            }
            this.present_modes_.push(REGIONS_MODE.MODIFY);
        }

        if (translateMode) { // remove mutually exclusive interactions
            removeDrawInteractions.call(this);
            addSelectInteraction.call(this);
            if (this.translate_ === null) {
                this.translate_ = new Translate(this);
                this.viewer_.viewer_.addInteraction(this.translate_);
            }
            this.present_modes_.push(REGIONS_MODE.TRANSLATE);
        }

        if (selectMode) { // remove mutually exclusive interactions
            removeDrawInteractions.call(this);
            addSelectInteraction.call(this);
            this.present_modes_.push(REGIONS_MODE.SELECT);
        }
    };

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
    updateRegions = function (request_info) {
        let makeServerRequest = false;
        if (typeof(request_info) === 'boolean') makeServerRequest = request_info;

        if (this.select_)
            this.select_.clearSelection();
        this.viewer_.removeRegions();

        // remember any features we added
        let allFeatures = this.featuresRtree_.getAll();
        for (let f in allFeatures) {
            let feat = allFeatures[f];
            if (feat['state'] === REGIONS_STATE.ADDED &&
                typeof this.new_unsaved_shapes_[feat.getId()] !== 'object')
                this.new_unsaved_shapes_[feat.getId()] = feat;
        }

        this.clear();
        if (makeServerRequest) {
            this.initialize_(this); // simply reinitialize
            return;
        }

        // just take the roi info that we had already (and include orphaned additions)
        let regionsAsFeatures =
            RegionsUtils.createFeaturesFromRegionsResponse(this, true);
        if (!Array.isArray(regionsAsFeatures)) regionsAsFeatures = [];
        if (regionsAsFeatures.length > 0) this.addFeatures(regionsAsFeatures);
    }

    /**
     * Sets the scale text flag
     *
     * @param {boolean} scaleText a flag whether text should be scaled with resolution changes
     */
    setScaleText = function (scaleText) {
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
    setRotateText(rotateText) {
        if (typeof(rotateText) !== 'boolean') return;

        // set member flag
        this.rotate_text_ = rotateText;
        this.changed();
    }

    /**
     * We override the standard implementation to control which features are being
     * rendered.
     *
     * @param {ol.Extent} extent Extent.
     * @param {function} callback for each feature in extent
     * @param {object=} opt_this The object to use as `this` in the callback.
     * @return {S|undefined} The return value from the last call to the callback.
     */
    forEachFeatureInExtent(extent, callback, opt_this) {
        return this.featuresRtree_.forEachInExtent(extent, function (feature) {
            if (this.renderFeature(feature)) callback.call(this, feature);
        }, this);
    };

    /**
     * This method decides whether a feature is being rendered or not
     * using the following criteria
     * - visibility
     * - deleted
     * - presently showing z/t/c (incl. unattached)
     * - (potential) projection range (z)
     *
     * @param {ol.Feature} feature an instance of ol.Feature
     * @return {boolean} true if the feature fulfills the criteria to be rendered
     */
    renderFeature(feature) {
        let projection = this.viewer_.getImage().image_projection_;

        let visible =
            typeof(feature['visible']) !== 'boolean' || feature['visible'];
        let deleted =
            typeof feature['state'] === 'number' &&
            feature['state'] === REGIONS_STATE.REMOVED;

        let shapeT = typeof feature['TheT'] === 'number' ? feature['TheT'] : -1;
        let shapeZ = typeof feature['TheZ'] === 'number' ? feature['TheZ'] : -1;
        let shapeC = typeof feature['TheC'] === 'number' ? feature['TheC'] : -1;
        let viewerT = this.viewer_.getDimensionIndex('t');
        let viewerZ = this.viewer_.getDimensionIndex('z');
        let viewerCs = this.viewer_.getDimensionIndex('c');

        // show only shapes that match the dimensions or are unattached
        // for projection the shapes have to be unattached or be within the
        // projection range
        let belongsToDimension = true;
        let excludeZ = function () {
            if (projection === PROJECTION['INTMAX']) {
                let projectionBounds = this.viewer_.getImage().projection_opts_;
                let lowerBoundZ = projectionBounds ? projectionBounds['start'] : viewerZ;
                let upperBoundZ = projectionBounds ? projectionBounds['end'] : viewerZ;
                return (shapeZ !== -1 && (shapeZ < lowerBoundZ || shapeZ > upperBoundZ));
            } else return (shapeZ !== -1 && shapeZ !== viewerZ);
        }.bind(this);
        if ((shapeC !== -1 && viewerCs.indexOf(shapeC) === -1) ||
            (shapeT !== -1 && shapeT !== viewerT) || excludeZ())
            belongsToDimension = false;

        return (visible && !deleted && belongsToDimension);
    }

    /**
     * Persists modified/added shapes
     *
     * @param {Object} roisAsJsonObject a populated object for json serialization
     * @param {boolean} omit_client_update an optional flag that's handed back to the client
     *                  to indicate that a client side update to the response is not needed
     * @return {boolean} true if peristence request was made, false otherwise
     */
    storeRegions(roisAsJsonObject, omit_client_update) {

        if (typeof omit_client_update !== 'boolean') omit_client_update = false;

        try {
            let postContent = {
                "imageId": this.viewer_.id_,
                "rois": roisAsJsonObject
            };

            // set properties for ajax request
            let properties = {
                "server": this.viewer_.getServer(),
                "uri": this.viewer_.getPrefixedURI(PLUGIN_PREFIX) +
                    '/persist_rois',
                "method": 'POST',
                "content": JSON.stringify(postContent),
                "headers": {"X-CSRFToken": MiscUtils.getCookie("csrftoken")},
                "jsonp": false
            };

            let capturedRegionsReference = this;

            // the success handler for the POST
            properties["success"] = function (data) {
                let params = {
                    "shapes": {},
                    "omit_client_update": omit_client_update
                };

                let errors = [];
                try {
                    data = JSON.parse(data);
                    if (data && typeof data['ids'] === 'object')
                        params['shapes'] = data['ids'];
                    if (data && Array.isArray(data['errors']))
                        errors = data['errors'];
                } catch (parseError) {
                    errors.push("Failed to parse JSON response");
                }

                try {
                    // synchronize ids and states
                    for (let id in params['shapes']) {
                        let f = capturedRegionsReference.idIndex_[id];
                        if (f['state'] === REGIONS_STATE.REMOVED)
                            capturedRegionsReference.removeFeature(f);
                        else {
                            f['state'] = REGIONS_STATE.DEFAULT;
                            f.setId(params['shapes'][id]);
                            if (typeof f['permissions'] !== 'object') {
                                f['permissions'] = {
                                    'canAnnotate': true,
                                    'canEdit': true,
                                    'canDelete': true,
                                }
                            }
                        }
                    }
                    // tag on the newly but immediately deleted shapes
                    for (let i in roisAsJsonObject['new_and_deleted']) {
                        let id = roisAsJsonObject['new_and_deleted'][i];
                        if (typeof capturedRegionsReference.idIndex_[id] === 'object') {
                            capturedRegionsReference.removeFeature(
                                capturedRegionsReference.idIndex_[id]);
                            params['shapes'][id] = id;
                        }
                    }
                    ;
                } catch (err) {
                    errors.push('Failed to sync rois' + err);
                }

                if (errors.length > 0) params['errors'] = errors;
                MiscUtils.sendEventNotification(
                    capturedRegionsReference.viewer_, "REGIONS_STORED_SHAPES", params);
            };

            // the error handler for the POST
            properties["error"] = function (error) {
                let params = {
                    "shapes": [],
                    "errors": [error]
                };
                MiscUtils.sendEventNotification(
                    capturedRegionsReference.viewer_, "REGIONS_STORED_SHAPES", params);
            };

            // send request
            NetUtils.sendRequest(properties, this);
        } catch (requestNotSent) {
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
    setProperty(roi_shape_ids, property, value, callback) {

        if (!Array.isArray(roi_shape_ids) ||
            roi_shape_ids.length === 0 ||
            typeof property !== 'string' ||
            typeof value === 'undefined' ||
            typeof this.idIndex_ !== 'object') return;

        let changedFeatures = [];
        let changedProperties = [];
        let changedValues = [];
        let eventProperty = null;
        for (let r in roi_shape_ids) {
            let s = roi_shape_ids[r];
            let f = this.idIndex_[s];
            if (f instanceof Feature) {
                // we allow to toggle the selected state
                // as well as the state for removed, modified and rollback deletes
                let presentState = null;
                let hasSelect = (this.select_ instanceof Select);
                if (property === 'selected' || property === 'visible') {
                    eventProperty = property;
                    if (hasSelect && !(property === 'visible' && value))
                        this.select_.toggleFeatureSelection(f, value);
                } else if (property === 'state') {
                    presentState = f[property];
                    if (value === REGIONS_STATE.REMOVED) {
                        // check delete permissions
                        if (typeof f['permissions'] === 'object' &&
                            f['permissions'] !== null &&
                            typeof f['permissions']['canDelete'] === 'boolean' &&
                            !f['permissions']['canDelete']) continue;
                        if (hasSelect) this.select_.toggleFeatureSelection(f, false);
                        // we have already done this
                        if (presentState !== REGIONS_STATE.REMOVED &&
                            (typeof f["old_state"] !== 'number' ||
                                f["old_state"] !== REGIONS_STATE.ADDED))
                            f["old_state"] = presentState;
                        eventProperty = "deleted";
                    } else if (value === REGIONS_STATE.MODIFIED) {
                        // check edit permissions
                        if (typeof f['permissions'] === 'object' &&
                            f['permissions'] !== null &&
                            typeof f['permissions']['canEdit'] === 'boolean' &&
                            !f['permissions']['canEdit']) continue;
                        // we are presently deleted
                        // so all we do is remember the modification as the
                        // 'old_state' in case of a rollback
                        if (presentState === REGIONS_STATE.REMOVED) {
                            f["old_state"] = value;
                            continue;
                        } else if (presentState === REGIONS_STATE.ADDED)
                        // we maintain the added state at all times
                            f["old_state"] = presentState;
                        eventProperty = "modified";
                    } else if (value === REGIONS_STATE.ROLLBACK) {
                        // check delete permissions
                        if (typeof f['permissions'] === 'object' &&
                            f['permissions'] !== null &&
                            typeof f['permissions']['canDelete'] === 'boolean' &&
                            !f['permissions']['canDelete']) continue;
                        eventProperty = "rollback";
                    }
                } else eventProperty = property;

                // set new value
                f[property] =
                    (property === 'state' && value === REGIONS_STATE.ROLLBACK) ?
                        (typeof f["old_state"] === 'number' ?
                            f["old_state"] : REGIONS_STATE.DEFAULT) : value;

                // gather info for event response
                changedFeatures.push(s);
                let val = true;
                if (eventProperty === 'rollback') {
                    eventProperty = 'deleted';
                    val = false;
                } else if (eventProperty === 'deleted' ||
                    (property === 'state' && eventProperty === 'modified'))
                    val = true;
                else val = value;
                changedProperties.push(eventProperty);
                changedValues.push(val);
            }
        }
        this.changed();

        MiscUtils.sendEventNotification(
            this.viewer_, "REGIONS_PROPERTY_CHANGED",
            {
                "properties": changedProperties,
                "shapes": changedFeatures,
                "values": changedValues,
                "callback": callback
            }, 25);
    }

    /**
     * Adds an old value/new value pair to the history,
     * returning the id for the entry
     * @param {Array.<ol.Feature>} features an array of features containing the geometries
     * @param {boolean} is_old_value
     *          if true we take the geometries to be the old value, otherwise new
     * @return {number} the id for the history entry
     */
    addHistory(features, is_old_value, hist_id) {
        if (!Array.isArray(features) || features.length === 0) return;

        // get the latest id and increment it, if we don't have an id
        let hist_entry = {};
        if (typeof hist_id !== 'number') {
            hist_id = ++this.history_id_;
            this.history_[hist_id] = hist_entry;
        } else hist_entry = this.history_[hist_id];
        // we have to have either a new(empty) entry or an existing one
        if (typeof hist_entry !== 'object') return;

        // iterate over features and add the geometries to the history
        for (let i = 0; i < features.length; i++) {
            let f = features[i];
            // we have a record per feature id for convenient lookup
            // if we don't have one yet, we ar going to create and add it
            let hist_record = {
                old_state: f['state'],
                new_state: REGIONS_STATE.MODIFIED,
                old_value: null, new_value: null
            };
            if (typeof hist_entry[f.getId()] === 'object')
                hist_record = hist_entry[f.getId()];
            else hist_entry[f.getId()] = hist_record;
            // now set either the old or new value
            let clonedGeometry = f.getGeometry().clone();
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
    doHistory(hist_id, undo) {
        // get the history entry for the given id (if exists)
        if (typeof this.history_[hist_id] !== 'object') return;
        if (typeof undo !== 'boolean') undo = true;
        let hist_entry = this.history_[hist_id];

        // iterate over history records of associated feature ids
        // to then apply the history undo
        for (let f in hist_entry) {
            let hist_record = hist_entry[f];
            // check if we have such as feature
            if (this.idIndex_[f] instanceof Feature) {
                this.idIndex_[f].setGeometry(
                    undo ? hist_record.old_value : hist_record.new_value);
                let newState = undo ? hist_record.old_state : hist_record.new_state;
                if (newState !== this.idIndex_[f]['state']) {
                    this.idIndex_[f]['state'] = newState;
                    this.setProperty(
                        [this.idIndex_[f].getId()], "modified",
                        newState !== REGIONS_STATE.DEFAULT);
                }
            }
        }
    }

    /**
     * Returns the area and length values for a given shape
     *
     * @param {ol.Feature} feature the ol3 feature representing the shape
     * @param {boolean} recalculate flag: if true we redo the measurement (default: false)
     * @return {Object|null} an object containing shape id, area and length or null
     */
    getLengthAndAreaForShape(feature, recalculate) {
        if (!(feature instanceof Feature)) return null;

        if (typeof recalculate !== 'boolean') recalculate = false;

        return Regions.calculateLengthAndArea(
            feature, recalculate,
            this.viewer_.viewer_.getView().getProjection().getMetersPerUnit(),
            this.viewer_.image_info_['pixel_size']['symbol_x'] || 'px'
        );
    }

    /**
     * Clean up
     */
    disposeInternal() {
        this.clear();
        this.featuresRtree_ = null;
        this.loadedExtentsRtree_ = null;
        this.nullGeometryFeatures_ = null;
        this.history_ = {};
        this.regions_info_ = null;
        this.viewer_ = null;
    }
}
