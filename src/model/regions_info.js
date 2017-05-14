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
import RegionsHistory from './regions_history';
import {
    IMAGE_CONFIG_UPDATE, REGIONS_INIT, EventSubscriber
} from '../events/events';
import Misc from '../utils/misc';
import {Converters} from '../utils/converters';
import {
    REGIONS_DRAWING_MODE, REGIONS_MODE, IVIEWER
} from '../utils/constants';

/**
 * Holds region information
 *
 * @extends {EventSubscriber}
 *
 */
@noView
export default class RegionsInfo extends EventSubscriber {
    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof RegionsInfo
     * @type {boolean}
     */
    ready = false;

    /**
     * our internal list of shape objects
     * stored in a map and accessible by id
     * @memberof RegionsInfo
     * @type {Map}
     */
    data = new Map();

    /**
     * a total shape count (exluding new with deleted!)
     * necessary because the data map still needs to include deleted
     * for history reasons (undo/redo) until we save BUT for the show all toggle
     * they do not count.
     * @memberof RegionsInfo
     * @type {number}
     */
    number_of_shapes = 0;

    /**
     * @memberof RegionsInfo
     * @type {RegionsHistory}
     */
    history = null;

    /**
     * a helper array to avoid data iteration. holds ids of selected shapes
     * @memberof RegionsInfo
     * @type {Array.<string>}
     */
    selected_shapes = [];

    /**
     * the balance of individual shape show vs hide toggles
     * a diffing method in a sense with zero equaling showing all,
     * the initial state while a hide will subtract 1 and a show will add 1.
     * probably the less painful method as opposed to a total count tracking
     * which necessitats more variables still as well as more work.
     * @memberof RegionsInfo
     * @type {boolean}
     */
    visibility_toggles = 0;

    /**
     * the json of the copied shapes
     * (which uses also local storage -if supported)
     * @memberof RegionsInfo
     * @type {Array.<objects>}
     */
    copied_shapes = null;

    /**
     * the presently used regions modes
     * @memberof RegionsInfo
     * @type {Array.<number>}
     */
    regions_modes = [
        REGIONS_MODE.SELECT, REGIONS_MODE.MODIFY, REGIONS_MODE.TRANSLATE
    ];

    /**
     * the type of shape that is to be drawn,
     * i.e. a draw interaction is active if non null.
     * @memberof RegionsInfo
     * @type {string|null}
     */
    shape_to_be_drawn = null;

    /**
     * any defaults for shape drawing
     * @memberof RegionsInfo
     * @type {Object}
     */
    shape_defaults = {};

    /**
     * the drawing mode
     * @memberof RegionsInfo
     * @type {number}
     */
    drawing_mode = REGIONS_DRAWING_MODE.PRESENT_Z_AND_T;

    /**
     * the z/t indices that we draw to
     * @memberof RegionsInfo
     * @type {number}
     */
    drawing_dims = { t: [], z: []};

    /**
     * a roi id for new regions (shapes to be combined), strictly negative
     * @memberof RegionsInfo
     * @type {number}
     */
    roi_id = -1;

    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof RegionsInfo
     * @type {Map}
     */
    sub_list = [
        [IMAGE_CONFIG_UPDATE,
            (params={}) => this.handleImageConfigUpdate(params)]];

    /**
     * @constructor
     * @param {ImageInfo} image_info the associated image
     */
    constructor(image_info) {
        super(image_info.context.eventbus);
        this.image_info = image_info;
        // we want history
        this.history = new RegionsHistory(this);

        // try to restore localstorage copied shapes
        try {
            this.copied_shapes =
                JSON.parse(
                    window.localStorage.getItem("omero_iviewer.copied_shapes"));
        } catch(ignored) {}
        // init default shape colors
        this.resetShapeDefaults();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method bind for initialization purposes
     *
     * @memberof RegionsInfo
     */
    bind() {
        this.subscribe();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof RegionsInfo
     */
    unbind() {
        this.unsubscribe();
        this.resetRegionsInfo();
        this.history = null;
    }

    /**
     * Handles received image config updates (IMAGE_CONFIG_UPDATE)
     *
     * @memberof RegionsInfo
     * @param {Object} params the event notification parameters
     */
    handleImageConfigUpdate(params = {}) {
        // we ignore notifications that don't concern us
        if (params.config_id !== this.image_info.config_id ||
            !params.ready) return;

        if (this.image_info.context.isRoisTabActive()) this.requestData(true);
    }

    /**
     * Sets a property for shape(s) according to the new value
     *
     * @memberof RegionsInfo
     * @param {string} id a shape id in format roi:shape-id
     * @param {string} property a property on the shape
     * @param {Object|Array|boolean|string|number} value the new value
     */
    setPropertyForShape(id, property, value) {
        // we need an id and a proper property name, as well as a value
        if (this.data === null || // no regions map is no good either
                typeof id !== 'string' ||
                typeof property !== 'string' ||
                typeof value === 'undefined') return;

        // if we do not find a matching shape for the id => bye
        let shape = this.getShape(id);
        if (shape === null) return;
        let ids = Converters.extractRoiAndShapeId(id);
        let roi = this.data.get(ids.roi_id);

        // if the shape shape has a property of that given name
        // set its new value
        if (typeof shape[property] !== 'undefined') shape[property] = value;
        // modify the selected set for actions that influence it
        if ((property === 'selected' || property === 'visible') && value) {
            if (property === 'visible') this.visibility_toggles++;
            else {
                this.data.get(ids.roi_id).show = true;
                let i = this.selected_shapes.indexOf(id);
                if (i === -1) this.selected_shapes.push(id);
            }
        } else if ((property === 'selected' && !value) ||
                    (property === 'visible' && !value) ||
                    (property === 'deleted' && value)) {
            let i = this.selected_shapes.indexOf(id);
            if (i !== -1) this.selected_shapes.splice(i, 1);
            shape.selected = false;
            if (property === 'deleted' &&
                typeof shape.is_new === 'boolean' && shape.is_new) {
                    roi.deleted++;
                    this.number_of_shapes--;
                    if (!shape.visible) this.visibility_toggles++;
            } else if (property === 'visible') this.visibility_toggles--;
        } else if (property === 'deleted' && !value) {
            roi.deleted--;
            if (typeof shape.is_new === 'boolean' && shape.is_new) {
                    this.number_of_shapes++;
                    if (!shape.visible) this.visibility_toggles--;
                }
        }
    }

    /**
     * Retrieves the regions information needed via ajax and stores it internally
     *
     * @memberof RegionsInfo
     * @param {boolean} forceUpdate if true we always request up-to-date data
     */
    requestData(forceUpdate = false) {
        if (this.ready && !forceUpdate) return;
        // reset regions info data and history
        this.resetRegionsInfo();

        // send request
        $.ajax({
            url : this.image_info.context.server +
                  this.image_info.context.getPrefixedURI(IVIEWER) +
                  "/request_rois/" + this.image_info.image_id + '/',
            success : (response) => {
                try {
                    let count = 0;
                    console.log(response);
                    response.map((roi) => {
                        let shapes = [];

                        // set shape properties and store the object
                        let roiId = roi['@id'];
                        roi.shapes.map((shape) => {
                            let newShape =
                            Converters.amendShapeDefinition(
                                Object.assign({}, shape));
                            let shapeId = newShape['@id']
                            newShape.shape_id = "" + roiId + ":" + shapeId;
                            // we add some flags we are going to need
                            newShape.visible = true;
                            newShape.selected = false;
                            newShape.deleted = false;
                            newShape.modified = false;
                            newShape.id = shapeId;
                            shapes.push(newShape);
                            count++;
                        });
                        shapes.sort(function(s1, s2) {
                            var z1 = parseInt(s1['TheZ']);
                            var z2 = parseInt(s2['TheZ']);
                            var t1 = parseInt(s1['TheT']);
                            var t2 = parseInt(s2['TheT']);
                            if (z1 === z2) {
                                return (t1 < t2) ? -1 : (t1 > t2) ? 1: 0;
                            }
                            return (z1 < z2) ? -1: 1;
                        });
                        this.data.set(roiId, {
                            shapes: shapes,
                            show: false,
                            deleted: 0
                        });
                    });
                    this.number_of_shapes = count;
                    this.ready = true;
                    this.image_info.context.publish(
                        REGIONS_INIT, {data: response});
                } catch(err) {
                    console.error("Failed to load Rois: " + err);
                }
            }, error : (error) => console.error("Failed to load Rois: " + error)
        });
    }

    /**
     * Resets history and data
     * @private
     * @memberof RegionsInfo
\     */
    resetRegionsInfo() {
        this.ready = false;
        if (this.history instanceof RegionsHistory) this.history.resetHistory();
        if (this.data instanceof Map) {
            this.data.forEach((value, key) => value.shapes.clear());
            this.data.clear();
        }
        this.number_of_shapes = 0;
    }

    /**
     * Simply returns an autodecremented roi id for new shapes to be combined
     * @memberof RegionsInfo
     * @return {number} an autoincremented roi id
     */
    getNewRegionsId() {
        return --this.roi_id;
    }

    /**
     * A very simple filtering based on properties and their
     * supposed, corresponding values using an implicit logical AND to chain them
     * If a pre-selected id list is supplied
     * only shapes within that list are considered
     * If no params are given all ids are returned
     *
     * @memberof RegionsInfo
     * @param {Array.<string>} properties an array of property names
     * @param {number|string|Array|boolean|Object} values the values to filter for
     * @param {string} perms the permissions to check, e.g. edit or delete
     * @param {Array.<string>|null} ids an optional array of ids of the form: roi:shape-id
     * @return {Array.<string>} an array of ids that satisfy the filter
     */
    unsophisticatedShapeFilter(properties=[], values=[], perms=[], ids=null) {
        let ret = [];
        if (!Misc.isArray(properties) || !Misc.isArray(values) ||
            !Misc.isArray(perms) || properties.length !== values.length ||
            properties.length !== perms.length) return ret;

        let filter = (value) => {
            for (let i=0;i<properties.length;i++) {
                if (typeof value[properties[i]] === 'undefined') continue;
                // check permission
                if (typeof value['permissions'] === 'object' &&
                    value['permissions'] !== null) {
                        let perm =
                            typeof perms[i] === 'string' &&
                            perms[i].length > 0 ?
                                "can" + perms[i][0].toUpperCase() +
                                perms[i].substring(1).toLowerCase() : null;
                        if (perm &&
                            typeof value['permissions'][perm] === 'boolean' &&
                            !value['permissions'][perm]) return false;
                }
                if (value[properties[i]] !== values[i]) return false;
            }
            return true;
        };

        let hasIdsForFilter = Misc.isArray(ids);
        // iterate over all shapes

        this.data.forEach(
            (value) =>
                value.shapes.forEach(
                    (value) => {
                        let id = value.shape_id;
                        if (hasIdsForFilter &&
                            ids.indexOf(id) !== -1 && filter(value)) ret.push(id);
                        else if (!hasIdsForFilter && filter(value)) ret.push(id);
                    })
        );


        return ret;
    }

    /**
     * Looks up shape by combined roi:shape id
     *
     * @memberof RegionsInfo
     * @param {string} id the id in the format roi_id:shape_id, e.g. 2:4
     * @return {Object|null} the shape object or null if none was found
     */
    getShape(id) {
        if (this.data === null) return null;

        let ids = Converters.extractRoiAndShapeId(id);
        let roi = this.data.get(ids.roi_id);
        if (typeof roi === 'undefined' || !(roi.shapes instanceof Map))
            return null;

        let shape = roi.shapes.get(ids.shape_id);
        return (typeof shape !== 'undefined') ? shape : null;
    }

    /**
     * Any shape modification, addition or deletion results in a history entry.
     * Therefore if our history is empty or the present pointer at the beginning
     * we can say that nothing has changed, otherwise the opposite
     *
     * @memberof RegionsInfo
     * @return {boolean} true if shapes have been modified, otherwise false
     */
    hasBeenModified() {
        return this.history instanceof RegionsHistory && this.history.canUndo();
    }

    /**
     * Returns the last of the selected shapes (taking into account permissions)
     *
     * @return {Object|null} the last selected shape with(out) permission
     *                       or null (if no shapes are selected)
     * @memberof RegionsEdit
     */
    getLastSelectedShape() {
        let len = this.selected_shapes.length;
        if (len === 0) return null;

        let ret =  this.getShape(this.selected_shapes[len-1]);
        if (this.checkShapeForPermission(ret, "canEdit")) return ret;
        // look for the next one that has permissions and return it
        for (let i=len-2;i>=0;i--) {
            let s = this.getShape(this.selected_shapes[i]);
            if (this.checkShapeForPermission(s, "canEdit")) return s;
        }
        return ret;
    }

    /**
     * Resets to default fill/stroke color settings
     *
     * @memberof RegionsEdit
     */
    resetShapeDefaults() {
        this.shape_defaults['StrokeColor'] = -65281;
        this.shape_defaults['FillColor'] = -256;
        this.shape_defaults['StrokeWidth'] = {
            '@type': 'TBD#LengthI',
            'Unit': 'PIXEL',
            'Symbol': 'pixel',
            'Value': 1
        };
    }

    /**
     * Checks if handed in permission is on shape
     *
     * @param {Object} shape the shape object
     * @param {string} permission the permission to check for
     * @param {boolean} true if permission is on given shape, false otherwise
     * @memberof RegionsEdit
     */
    checkShapeForPermission(shape, permission) {
        if (typeof shape !== 'object' || shape === null ||
            typeof permission !== 'string' ||
                (permission !== 'canAnnotate' &&
                permission !== 'canEdit' &&
                permission !== 'canDelete')) return false;

        return this.image_info.can_annotate &&
                !(typeof shape['permissions'] === 'object' &&
                shape['permissions'] !== null &&
                typeof shape['permissions'][permission] === 'boolean' &&
                !shape['permissions'][permission]);
    }

}
