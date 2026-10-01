
import {Utils} from '../utils/regions';

// based on example at https://embed.plnkr.co/YACDv3/preview
export class SortValueConverter {

    // toView(arr, prop, ascending) {
    toView(rois, sortBy, sortAscending) {
        if (!rois) {
            return new Map();
        }
        return Utils.sortRois(rois, sortBy, sortAscending);
    }
}
