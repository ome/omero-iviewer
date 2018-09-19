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

/**
 * Keeps track of object changes to be able to undo/redo.
 * The idea is to make any class that needs a 'history' extend this one,
 * and then call record on it handing it the properties that have changed
 * as well as the old values (for redo). This way we keep only track of what has
 * changed.
 */
@noView
export default class History {
    /**
     * @memberof History
     * @type {boolean}
     */
    debug = true;

    /**
     * a flag that determines whether undo/redo are enabled
     * @memberof History
     * @type {boolean}
     */
    undo_redo_enabled = true;

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
     * Records an action that relates to a property remembering its old value,
     * it's new value and, optionally (but highly recommended), the type that
     * the property is.
     * Note that the root for the property is the instance of the class
     * that we extended with History ('this') hence the need to for extension
     * In other words if you specify prop: ['bla', 'hey'], the 'fully qualified'
     * property name will be: this.bla.hey. Should this property not exist in the
     * actual instance, we fail silently or emit a debug message if the debug flag
     * is set to true
     *
     * @param {Object|Array.<Object>} record an object (see default value) or array of objects
     * @memberof History
     */
     addHistory(record =
            {scope: null, prop: ['null'], old_val: null, new_val: null, type: 'object'}) {
         let entries = [];
         if (Misc.isArray(record)) entries = record;
         else entries.push(record);
         if (entries.length === 0) return;

         // loop over entries
        entries.map((action) => {
             // we conduct some preliminary checks to see if we received
             // what was expected and mandatory
             if (typeof action !== 'object' || action === null ||
                    !Misc.isArray(action.prop) || action.prop.length === 0) {
                if (this.debug) console.debug(
                    "History.record requires an action object pointing to a property!");
                return;
             }

             // check old_val, new_val in regards to its type
             let t =
                typeof action.type === 'string' && action.type.length > 0 ?
                    action.type : 'undefined'
             let actT = typeof action.old_val;
             if ((t !== 'undefined' && actT !== t) ||
                    t === 'undefined' && actT === t) {
                if (this.debug) console.debug(
                    "History.record requires an action object with old_val and new_val ");
                return;
             }

             if (!this.checkProperty(action.prop, action.scope)) {
                 if (this.debug) console.debug(
                     "History.record: given property does not exist!");
                 return;
             }
         });
         // add entries now
         this.history.splice(
             this.historyPointer+1,
             this.history.length-this.historyPointer, entries);
         this.historyPointer++;
     }

    /**
     * At a minimum this method checks whether a property for the given strings
     * exists or not. If a callback function is given as the second parameter
     * it can be used to set the value of the property for instance (or do other stuff)
     * @private
     * @param {Array.<string>} path an array of strings determining the 'path' to the property
     * @param {Object=} scope an optional scope, otherwise this is assumed
     * @param {function=} callback an optional callback function
     *
     * @memberof History
     * @return {boolean} true if the property was found, false otherwise
    */
    checkProperty(path = [], scope = null, callback = null) {
        if (!Misc.isArray(path) || path.length === 0) return false;

        scope = scope ? scope : this;
        let accPath = scope;
        let lastBit = null;
        for (let i=0;i<path.length;i++) {
            // path is empty or not a string
            if (typeof path[i] !== 'string' || path[i].length === 0) return false;
            if (i>0) accPath = accPath[path[i-1]]; // accumulate the path
            // check if the new addition is defined
            if (typeof accPath[path[i]] === 'undefined') return false;
            lastBit = path[i];
        }
        if (typeof callback === 'function') callback.call(scope, accPath, lastBit);
        return true;
    }

    /**
     * Undoes the last action
     * @memberof History
     */
    undoHistory() {
        if (!this.canUndo()) return;

        let entries = this.history[this.historyPointer];
        entries.map(action => {
            let undo = (path, lastBit) => path[lastBit] = action.old_val;
            if (!this.checkProperty(action.prop, action.scope, undo)) {
                if (this.debug) console.debug("Failed to undo history");
                return;
        }});
        //adjust pointer
        this.historyPointer--;
    }

    /**
     * Redoes the last action
     * @memberof History
     */
     redoHistory() {
         if (!this.canRedo()) return;

         let entries = this.history[this.historyPointer+1];
         entries.map(action => {
             let redo = (path, lastBit) => path[lastBit] = action.new_val;
             if (!this.checkProperty(action.prop, action.scope, redo)) {
                 if (this.debug) console.debug("Failed to redo history");
                 return;
         }});
         //adjust pointer
         this.historyPointer++;
     }

      /**
       * @return {boolean} true if we are not at the end of the history
       * @memberof History
       */
       canRedo() {
           return this.hasHistory() && this.undo_redo_enabled &&
                        this.historyPointer < this.history.length-1;
       }

       /**
        * @return {boolean} true if we are not at the beginning of the history
        * @memberof History
        */
        canUndo() {
            return this.hasHistory() && this.undo_redo_enabled &&
                        this.historyPointer >= 0;
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
