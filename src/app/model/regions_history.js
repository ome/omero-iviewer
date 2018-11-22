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
import Misc from '../utils/misc';
import {Utils} from '../utils/regions';
import {
    REGIONS_SET_PROPERTY, REGIONS_HISTORY_ACTION,
    REGIONS_MODIFY_SHAPES, EventSubscriber
} from '../events/events';

/**
 * a history specifically for Regions/Shapes user interaction
 */
@noView
export default class RegionsHistory {
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
     * @see checkIfHistoryHasOnlyNewlyDeleted
     * @memberof History
     * @type {boolean}
     */
    hasOnlyNewlyDeleted = true;

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

        this.checkIfHistoryHasOnlyNewlyDeleted();
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
        this.checkIfHistoryHasOnlyNewlyDeleted();
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
        this.checkIfHistoryHasOnlyNewlyDeleted();
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
                let shape = this.regions_info.getShape(rec.shape_id);
                if (shape === null) continue;
                let updates = {
                    properties: rec.diffs,
                    values: undo ? rec.old_vals : rec.new_vals
                };
                this.affectHistoryPropertyChange(
                    shape, updates,
                    entry.post_update_handler, rec.modifies_attachment);
            } else if (entry.action === this.action.SHAPES) {
                let generate = undo ? rec.old_vals : rec.new_vals;
                if (generate) { // we recreate them
                    rec.diffs.map((shape) => {
                        imgInfo.context.publish(
                            REGIONS_SET_PROPERTY,
                                {config_id : imgInfo.config_id,
                                    property: 'state',
                                    shapes : [shape.shape_id],
                                    value: 'undo'});
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
     *
     * @param {Object} shape a shape definition
     * @param {Object} updates the properties and values to be updated
     * @param {function} post_update_handler a callback after update
      @param {boolean} modifies_attachment true if attachment properties changed
     * @memberof History
     */
    affectHistoryPropertyChange(
        shape, updates, post_update_handler = null, modifies_attachment = false) {
        if (typeof this.regions_info !== 'object') return;

        let def = {type: shape.type};
        for (let j=0;j<updates.properties.length;j++)
            def[updates.properties[j]] = updates.values[j];
        let callback =
            Utils.createUpdateHandler(
                updates, { hist: null, hist_id: -1},
                post_update_handler, modifies_attachment);

        let image_info = this.regions_info.image_info;
        image_info.context.publish(
           REGIONS_MODIFY_SHAPES, {
           config_id:image_info.config_id,
           shapes : [shape.shape_id],
           modifies_attachment: modifies_attachment,
           definition: def,
           callback: callback});
    }

    /**
     * Sets the hasOnlyNewlyDeleted flag if we are at the beginning
     * of the history or the history contains deletes of new shapes only
     * @memberof History
     */
    checkIfHistoryHasOnlyNewlyDeleted() {
        this.hasOnlyNewlyDeleted = true;
        if (this.historyPointer < 0) return;
        let new_shapes = new Map();
        for (let i=0;i<=this.historyPointer;i++) {
            let entry = this.history[i];
            if (!Misc.isArray(entry.records)) continue;
            for (let r in entry.records) {
                let rec = entry.records[r];
                switch(entry.action) {
                    // ol3 actions constitute change unless for new shapes
                    case this.action.OL_ACTION:
                        for (let s in rec.shape_ids)
                            if (new_shapes.get(rec.shape_ids[s]) !== null) {
                                this.hasOnlyNewlyDeleted = false;
                                return;
                            }
                        break;
                    // property actions constitute change unless for new shapes
                    case this.action.PROPERTIES:
                        if (new_shapes.get(rec.shape_id) !== null) {
                            this.hasOnlyNewlyDeleted = false;
                            return;
                        }
                        break;
                    default:
                        if (!Misc.isArray(rec.diffs)) break;
                        // deletes are changes unless for new shapes
                        for (let d in rec.diffs) {
                            let shape_id = rec.diffs[d].shape_id;
                            let is_new = typeof rec.diffs[d]['is_new'] === 'boolean';
                            if (!rec.new_vals) {
                                if (is_new) new_shapes.delete(shape_id);
                                else {
                                    this.hasOnlyNewlyDeleted = false;
                                    return;
                                }
                            } else if (is_new) new_shapes.set(shape_id, null);
                        }
                }
            }
        }
        // if we have come that far, there were no changes
        // other than to newly created shapes
        // should they all have been deleted we set the flag accordingly
        this.hasOnlyNewlyDeleted = new_shapes.size === 0;
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
       this.hasOnlyNewlyDeleted = true;
       this.historyPointer = -1;
    }
}
