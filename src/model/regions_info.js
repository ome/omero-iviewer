import {noView} from 'aurelia-framework';
import {
    IMAGE_CONFIG_UPDATE, REGIONS_MODIFY_SHAPES,
    REGIONS_SET_PROPERTY,REGIONS_GENERATE_SHAPES, REGIONS_HISTORY_ACTION,
    EventSubscriber} from '../events/events';
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import {REGIONS_MODE} from '../utils/constants';
import {REGIONS_DRAWING_MODE} from '../utils/constants';

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
    data = null;

    /**
     * @memberof RegionsInfo
     * @type {History}
     */
    history = null;

    /**
     * a helper array to avoid data iteration. holds ids of selsected shapes
     * @memberof RegionsInfo
     * @type {Array.<string>}
     */
    selected_shapes = [];

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
    regions_modes = [REGIONS_MODE.SELECT, REGIONS_MODE.TRANSLATE];

    /**
     * the drawing mode
     * @memberof RegionsInfo
     * @type {number}
     */
    drawing_mode = REGIONS_DRAWING_MODE.Z_AND_T_VIEWED;

    /**
     * the z/t indices that we draw to
     * @memberof RegionsInfo
     * @type {number}
     */
    drawing_dims = { t: [], z: []};

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
        this.history = new History(this);

        // try to restore localstorage copied shapes
        try {
            this.copied_shapes =
                JSON.parse(
                    window.localStorage.getItem("omero_viewerng.copied_shapes"));
        } catch(ignored) {}
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
        if (this.data instanceof Map) this.data.clear();
        this.history = null;
        this.image_info = null;
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

        this.requestData(true);
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
        let shape = this.data.get(id);
        if (typeof shape !== 'object') return;

        // if the shape shape has a property of that given name
        // set its new value
        if (typeof shape[property] !== 'undefined') shape[property] = value;
        // modify the selected set for actions that influence it
        if (property === 'selected' && value) this.selected_shapes.push(id);
        else if ((property === 'selected' && !value) ||
                    (property === 'deleted' && value)) {
            let i = this.selected_shapes.indexOf(id);
            if (i !== -1) this.selected_shapes.splice(i, 1);
        }
        // for deleted shapes that were new, we remove them instantly
        if (property === 'deleted' && value &&
                typeof shape.is_new !== 'undefined') this.data.delete(id);
    }

    /**
     * Retrieves the regions information needed via ajax and stores it internally
     *
     * @memberof RegionsInfo
     * @param {boolean} forceUpdate if true we always request up-to-date data
     */
    requestData(forceUpdate = false) {
        if ((this.ready || !this.image_info.showRegions()) &&
                !forceUpdate) return;
        // reset history
        this.history.resetHistory();

        // assmeble url
        let url = this.image_info.context.server + "/webgateway/get_rois_json/" +
         this.image_info.image_id + '/';
        let dataType = "json";
        if (Misc.useJsonp(this.image_info.context.server)) dataType += "p";

        $.ajax(
            {url : url,
            dataType : dataType,
            cache : false,
            success : (response) => {
                // we want an array
                if (!Misc.isArray(response)) return;

                this.data = new Map();
                // traverse results and stuff them into the map
                response.map((item) => {
                     // shapes have to be arrays as well
                     if (Misc.isArray(item.shapes)) {
                          // set shape properties and store the object
                          item.shapes.map((shape) => {
                              let newShape = Object.assign({}, shape);
                              newShape.shape_id = "" + item.id + ":" + shape.id;
                              // we add some flags we are going to need
                              newShape.visible = true;
                              newShape.selected = false;
                              newShape.deleted = false;
                              newShape.modified = false;
                              this.data.set(newShape.shape_id, newShape);
                          });
                      }});
                this.ready = true;
                }, error : (error) => this.ready = false
        });
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
     * @param {Array.<ids>|null} an optional array of ids of the form: roi:shape-id
     * @return {Array.<ids>} an array of ids for shapes that satisfy the filter
     */
    unsophisticatedShapeFilter(properties=[], values=[], ids=null) {
        let ret = [];
        if (!Misc.isArray(properties) || !Misc.isArray(values) ||
                properties.length !== values.length) return ret;

        let filter = (value) => {
            for (let i=0;i<properties.length;i++) {
                if (typeof value[properties[i]] === 'undefined') continue;
                if (value[properties[i]] !== values[i]) return false;
            }
            return true;
        };

        let hasIdsForFilter = Misc.isArray(ids);
        // iterate over all shapes
        this.data.forEach(
            (value, key) => {
                if (hasIdsForFilter && ids.indexOf(key) !== -1 && filter(value))
                    ret.push(key);
                else if (!hasIdsForFilter && filter(value)) ret.push(key);
        });

        return ret;
    }
}

/**
 * a history specifically for Regions/Shapes user interaction
 */
@noView
export class History {
    /**
     * we need a more fine grained history (compared to the settings)
     * for which we need to distinguish a certain type of action the history
     * record is for:
     * e.g. 'PROPERTIES' for a shape definition's property changes/diffs
     * e.g. 'SHAPES' for entire shape object changes (drawing/propagation/deletion)
     * e.g. 'OL_ACTION' for modifiction/translation of geometries
     * @memberof History
     * @type {Object}
     */
    action = {
        PROPERTIES : 0,
        SHAPES : 1,
        OL_ACTION : 2
    };

    /**
     * a simple autoincrement property
     * @memberof History
     * @type {number}
     */
    hist_id = 0;

    /**
     * @memberof History
     * @type {Array.<Object>}
     */
    history = [];

    /**
     * @memberof History
     * @type {number}
     */
    historyPointer = -1;

    /**
     * a reference to RegionsInfo
     * @memberof History
     * @type {RegionsInfo}
     */
    regions_info = null;

    /**
     * @constructor
     * @param {RegionsInfo} regions_info a reference to RegionsInfo
     */
     constructor(regions_info) {
         this.regions_info = regions_info
     }

     /**
      * Increments and returns the next history id
      * @return {number} the next number up
      * @memberof History
      */
      getHistoryId() {
          return this.hist_id++;
      }

    /**
     * Add 1-n history records for a given action (and id)
     * @param {number} hist_id a history id
     * @param {number} action an action to categorize the history entry
     * @param {Object|Array.<Object>} record an object (see default value) or array of objects
     * @param {function} post_update_handler a function that is stored with the history for post update
     * @memberof History
     */
     addHistory(
         hist_id = -1, action = 0,
         record = {shape_id: null, diffs: [], old_vals: [], new_vals: []},
            post_update_handler = null) {
         // we allow since records as well as arrays
         let entries = [];
         if (Misc.isArray(record)) entries = record;
         else entries.push(record);
         if (entries.length === 0) return;

         // set hist_id if not given and check action
         if (action !== this.action.PROPERTIES &&
             action !== this.action.SHAPES &&
             action !== this.action.OL_ACTION) return;

        // we allow appending to existing history entries
        let existingEntry = null;
         if (typeof hist_id !== 'number' || hist_id < 0) {
            hist_id = this.getHistoryId();
        } else // find existing entry
            this.history.map((e) => {
                if (e.hist_id === hist_id) existingEntry = e;
            });


         // loop over entries
         let tmp = [];
         for (let i=0; i<entries.length;i++) {
             let rec = entries[i];

             if (action === this.action.PROPERTIES) {
                 // some basic checks
                 // we have to have an array of diffs and old and new vals
                 // with a respective length
                 if (!Misc.isArray(rec.diffs) || rec.diffs.length === 0 ||
                        !Misc.isArray(rec.old_vals) ||
                        !Misc.isArray(rec.new_vals) ||
                        rec.old_vals.length !== rec.diffs.length ||
                        rec.new_vals.length !== rec.diffs.length ||
                        typeof rec.shape_id !== 'string') continue;
                tmp.push(rec);
            } else if (action === this.action.SHAPES) {
                if (!Misc.isArray(rec.diffs) || rec.diffs.length === 0 ||
                    typeof rec.old_vals !== 'boolean' ||
                    typeof rec.new_vals !== 'boolean') continue;
                tmp.push(rec);
            } else if (action === this.action.OL_ACTION) {
                if (typeof rec.hist_id !== 'number') continue;
                tmp.push(rec);
            }
        }

        // append to existing entry or add an own entry
        if (existingEntry)
            existingEntry.records = existingEntry.records.concat(tmp);
        else {
            let opts = {hist_id : hist_id, action: action, records: tmp};
            if (typeof post_update_handler === 'function')
                opts.post_update_handler = post_update_handler;
            // add entries now
            this.history.splice(
                this.historyPointer+1,
                this.history.length-this.historyPointer, opts);
            this.historyPointer++;
        }
     }

    /**
     * Undoes the last action
     * @memberof History
     */
    undoHistory() {
        if (!this.canUndo()) return;

        let entry = this.history[this.historyPointer];
        // converge
        this.doHistory(entry, true);
        //adjust pointer
        this.historyPointer--;
    }

    /**
     * Redoes the last action
     * @memberof History
     */
    redoHistory() {
        if (!this.canRedo()) return;

        let entry = this.history[this.historyPointer+1];
        // converge
        this.doHistory(entry, false);
        //adjust pointer
        this.historyPointer++;
    }

    /**
     * common code undo and redo converge on
     * @private
     * @param {Object} entry a history entry
     * @param {boolean} undo undo if true, redo otherwise
     * @memberof History
     */
    doHistory(entry, undo) {
        // loop over entries
        let imgInfo = this.regions_info.image_info;
        for (let i=0; i<entry.records.length;i++) {
            let rec = entry.records[i];
            if (entry.action === this.action.PROPERTIES) {
                let shape = this.regions_info.data.get(rec.shape_id);
                if (typeof shape === 'undefined') continue;
                this.affectHistoryPropertyChange(
                    shape, rec.diffs,
                    undo ? rec.old_vals : rec.new_vals,
                    entry.post_update_handler);
            } else if (entry.action === this.action.SHAPES) {
                let generate = undo ? rec.old_vals : rec.new_vals;
                if (generate) { // we recreate them
                    rec.diffs.map((shape) => {
                        if (shape.deleted)
                            imgInfo.context.publish(
                                REGIONS_SET_PROPERTY,
                                    {config_id : imgInfo.config_id,
                                        property: 'state',
                                        shapes : [shape.shape_id],
                                        value: 'undo'});
                        else
                            imgInfo.context.publish(
                                REGIONS_GENERATE_SHAPES,
                                {config_id : imgInfo.config_id,
                                 shapes : [shape], number : 1, random : false,
                                 theDims : [{z: shape.theZ, t: shape.theT}],
                                 add_history : false})
                         });
                } else { // we delete them
                    let ids = [];
                    rec.diffs.map((shape) => ids.push(shape.shape_id));
                    imgInfo.context.publish(
                        REGIONS_SET_PROPERTY,
                            {config_id : imgInfo.config_id,
                             property: 'state', shapes : ids, value: 'delete'});
                }
            } else if (entry.action === this.action.OL_ACTION) {
                imgInfo.context.publish(
                    REGIONS_HISTORY_ACTION,
                        {config_id : imgInfo.config_id,
                         hist_id: rec.hist_id, undo: undo});
            }
        }
    }

    /**
     * Affects a property change based on the desired history values
     * by triggering the corresponding shape modification event
     * @param {Object} shape a shape definition
     * @param {Array.<string>} props the properties of the shape to be affected
     * @param {Array.<?>} vals the values that the properties should take on
     * @memberof History
     */
    affectHistoryPropertyChange(shape, props, vals, post_update_handler) {
        if (typeof this.regions_info !== 'object') return;

        let def = {type: shape.type};
        for (let j=0;j<props.length;j++)
            def[props[j]] = vals[j];
        let callback =
            Utils.createUpdateHandler(
                props, vals, null, -1, post_update_handler);

        let image_info = this.regions_info.image_info;
        image_info.context.publish(
           REGIONS_MODIFY_SHAPES, {
           config_id:image_info.config_id,
           shapes : [shape.shape_id],
           definition: def,
           callback: callback});
    }

    /**
    * @return {boolean} true if we are not at the end of the history
    * @memberof History
    */
    canRedo() {
       return this.hasHistory() && this.historyPointer < this.history.length-1;
    }

    /**
    * @return {boolean} true if we are not at the beginning of the history
    * @memberof History
    */
    canUndo() {
        return this.hasHistory() && this.historyPointer >= 0;
    }

    /**
    * @return {boolean} true if we have at least one record, false otherwise
    * @memberof History
    */
    hasHistory() {
       return this.history.length > 0;
    }

    /**
    * Resets history
    * @memberof History
    */
    resetHistory() {
       this.history = [];
       this.historyPointer = -1;
    }
}
