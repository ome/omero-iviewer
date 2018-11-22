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
import {REGIONS_DRAWING_MODE} from './constants';
import Misc from './misc';
import RegionsHistory from '../model/regions_history';

/**
 * Regions Utility Class
 */
@noView
export class Utils {

    /**
     * Extracts the dimension combinations (z/t) for shape propagation,
     * eliminating duplicates and the present T/Z
     *
     * @static
     * @param {RegionsInfo} regions_info a regions info reference
     * @param {number} presentZ the present Z
     * @param {number} presentT the present T
     * @return {Array.<Object>} an array of objects containing a t and a z
     */
     static getDimensionsForPropagation(regions_info, presentZ=1, presentT=-1) {
         // all unattached states as well as the present z/t mode don't need this
         if (regions_info.drawing_mode === REGIONS_DRAWING_MODE.PRESENT_Z_AND_T ||
             (regions_info.drawing_mode > REGIONS_DRAWING_MODE.ALL_T &&
             regions_info.drawing_mode < REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T))
                return [];

        // establish what z/ts we use based on the drawing mode,
        // then form the union minus the present z/t already drawn
        let theDims = [];
        let m = regions_info.drawing_mode;
        let useZs = m === REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T ?
                regions_info.drawing_dims.z : [];
        let useTs = m === REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T ?
                regions_info.drawing_dims.t : [];
        let maxZ = regions_info.image_info.dimensions.max_z;
        let maxT = regions_info.image_info.dimensions.max_t;

        // for drawing modes where we don't have custom selections
        if (m !== REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T) {
            let allZs = Array.from(Array(maxZ).keys());
            let allTs = Array.from(Array(maxT).keys());
            ['z', 't'].map(
                (d) => {
                    if (d === 'z' &&
                        (m === REGIONS_DRAWING_MODE.ALL_Z ||
                         m === REGIONS_DRAWING_MODE.ALL_Z_AND_T))
                            useZs = allZs;
                    if (d === 't' &&
                        (m === REGIONS_DRAWING_MODE.ALL_T ||
                         m === REGIONS_DRAWING_MODE.ALL_Z_AND_T))
                            useTs = allTs;});
        }
        // last but not least, if we have an empty array in one dimension
        // we will use the present value for that from the new shape already
        // drawn, same is going to happen for no dim (-1) and exceeding dims
        // i.e. all z means for present t
        if (useZs.length === 0 ||
            presentZ < 0 || presentZ >= maxZ) useZs.push(presentZ);
        if (useTs.length === 0 ||
            presentT < 0 || presentT >= maxT) useTs.push(presentT);
        // now finally union them ommitting the present z/t of the new shape
        for (let i=0;i<useZs.length;i++) {
            let zIndex = useZs[i];
            for (let j=0;j<useTs.length;j++) {
                let tIndex = useTs[j];
                //if (zIndex === presentZ && tIndex === presentT) continue;
                theDims.push({"z" : zIndex, "t": tIndex});
            }
        }
        return theDims;
    }

    /**
     * Parses a string for dimension input incl. ranges such as 1-3 as
     * well as well as comma delimited input eliminating duplicates
     * as well as values that are below 0 or above max
     *
     * @static
     * @param {string} some_input a string containing dimension info
     * @param {number} max the upper bound for the dimension
     * @return {Array.<number>} an array of numbers
     */
    static parseDimensionInput(some_input, max) {
        if (typeof some_input !== 'string' || typeof max !== 'number' || max <=0)
            return [];
        some_input = some_input.replace(/\s/g, '');
        if (some_input.length === 0) return [];

        let tokens = some_input.split(","); // tokenize by ,
        let vals = [];
        tokens.map((t) => {
            let potentialDashPos = t.indexOf("-");
            if (potentialDashPos === -1) {// single number assumed
                let temp = parseInt(t);
                if (typeof temp === 'number' && !isNaN(temp) &&
                        temp > 0 && temp <= max) vals.push(temp);
            } else { // we might have a range
                let start = parseInt(t.substring(0, potentialDashPos));
                let end = parseInt(t.substring(potentialDashPos+1));
                if (typeof start === 'number' && typeof end === 'number' &&
                    !isNaN(start) && !isNaN(end) && start <= end) {
                        // we do have a 'range'
                        for (let i=start;i<=end;i++)
                            if (i > 0 && i <= max) vals.push(i);
                    }
            }
        });
        // eliminating duplicates and decrement by 1 to get internal dim indices
        vals.sort();
        let previous = -1;
        let ret = [];
        for (let x=0;x<vals.length;x++) {
            let present = vals[x];
            if (present === previous) continue;
            previous = present;
            ret.push(present-1);
        }

        return ret;
     }

    /**
     * Creates a callback function that is intended to be called per shape
     * and modify the properties according to the new values
     *
     * @param {Object} updates contains properties and values to be changed
     * @param {Object} history an optional history instance and id
     * @param {function?} post_update_handler an optional callback after update
     * @param {boolean?} modifies_attachment if true dimension attachment changed
     * @return {function} the update callback
     * @static
     */
     static createUpdateHandler(
         updates = {properties: [], values: []},
         history = {hist: null, hist_id: -1},
         post_update_handler = null, modifies_attachment = false) {
         // we expect 2 non empty arrays of equal length
         if (!Misc.isArray(updates.properties) ||
             updates.properties.length === 0 ||
             !Misc.isArray(updates.values) ||
             updates.values.length !== updates.properties.length) return null;

        let callback = (shape, hasBeenModified) => {
            if (typeof shape !== 'object' || shape === null) return;

            let oldVals = [];
            let allPropertiesEqual = true;
            for (let i=0;i<updates.properties.length;i++) {
                let prop = updates.properties[i];
                let old_value =
                    typeof shape[prop] !== 'undefined' ? shape[prop] : null;
                if (typeof old_value === 'object' &&
                    typeof updates.values[i] === 'object' &&
                    old_value !== null && updates.values[i] !== null) {
                    for (let p in old_value)
                        if (typeof updates.values[i][p] === undefined ||
                            old_value[p] !== updates.values[i][p])
                                allPropertiesEqual = false;
                } else if (old_value !== updates.values[i])
                    allPropertiesEqual = false;
                oldVals.push(old_value);
                shape[prop] = updates.values[i];
            };
            if (history.hist instanceof RegionsHistory && !allPropertiesEqual) {
                if (typeof hasBeenModified === 'boolean') {
                    updates.properties.push("modified");
                    oldVals.push(hasBeenModified);
                    updates.values.push(shape.modified);
                }
                if (typeof history.hist_id !== 'number') history.hist_id = -1;
                history.hist.addHistory(
                    history.hist_id, history.hist.action.PROPERTIES,
                    {
                        shape_id: shape.shape_id,
                        diffs: updates.properties,
                        modifies_attachment: modifies_attachment,
                        old_vals: oldVals,
                        new_vals: updates.values
                    },
                    typeof post_update_handler === 'function' ?
                        post_update_handler : null);
            }
            if (typeof post_update_handler === 'function') post_update_handler();
        }

        return callback;
     }
}
