import {noView} from 'aurelia-framework';
import {REGIONS_DRAWING_MODE} from '../utils/constants';

/**
 * Regions Utility Class
 */
@noView
export default class Regions {

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
}
