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
         if (regions_info.drawing_mode ===
             REGIONS_DRAWING_MODE.Z_AND_T_VIEWED) return [];

        // establish what z/ts we use based on the drawing mode,
        // then form the union minus the present z/t already drawn
        let theDims = [];
        let m = regions_info.drawing_mode;
        let useZs = m === REGIONS_DRAWING_MODE.SELECTED_Z_AND_T ?
                regions_info.drawing_dims.z : [];
        let useTs = m === REGIONS_DRAWING_MODE.SELECTED_Z_AND_T ?
                regions_info.drawing_dims.t : [];
        // for drawing modes where we don't have custom selections
        if (m !== REGIONS_DRAWING_MODE.SELECTED_Z_AND_T) {
            let maxZ = regions_info.image_info.dimensions.max_z;
            let maxT = regions_info.image_info.dimensions.max_t;
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
        // drawn
        // i.e. all z means for present t
        if (useZs.length === 0) useZs.push(presentZ);
        if (useTs.length === 0) useTs.push(presentT);
        // now finally union them ommitting the present z/t of the new shape
        for (let i=0;i<useZs.length;i++)
            for (let j=0;j<useTs.length;j++) {
                let zIndex = useZs[i];
                let tIndex = useTs[j];
                if (zIndex === presentZ && tIndex === presentT)
                    continue;
                theDims.push({"z" : zIndex, "t": tIndex});
            }
        return theDims;
    }

    /**
     * Creates a callback function that is intended to be called per shape
     * and modify the properties according to the new values
     *
     * @param {Array.<string>} properties the properties to be changed
     * @param {Array.<?>} values the respective values for the properties
     * @param {History?} history an optional History instance
     * @param {number?} hist_id an optional history id
     * @param {function} post_update_handler an optional callback after update
     * @return {function} the update callback
     * @static
     */
     static createUpdateHandler(
         properties = [], values = [], history=null, hist_id=-1,
            post_update_handler = null) {
         // we expect 2 non empty arrays of equal length
         if (!Misc.isArray(properties) || properties.length === 0 ||
                !Misc.isArray(values) || values.length !== properties.length)
            return null;

        let callback = (shape) => {
            if (typeof shape !== 'object' || shape === null) return;

            let oldVals = [];
            let allPropertiesEqual = true;
            for (let i=0;i<properties.length;i++) {
                let prop = properties[i];
                let old_value =
                    typeof shape[prop] !== 'undefined' ? shape[prop] : null;
                if (old_value !== values[i]) allPropertiesEqual = false;
                oldVals.push(old_value);
                shape[prop] = values[i];
            };
            if (history instanceof RegionsHistory && !allPropertiesEqual) {
                if (typeof hist_id !== 'number') hist_id = -1;
                history.addHistory(
                    hist_id, history.action.PROPERTIES,
                    {shape_id: shape.shape_id,
                        diffs: properties,
                        old_vals: oldVals, new_vals: values},
                        typeof post_update_handler === 'function' ?
                            post_update_handler : null);
            }
            if (typeof post_update_handler === 'function') post_update_handler();
        }

        return callback;
     }
}
