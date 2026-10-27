
import {Utils} from '../utils/regions';

// based on example at https://embed.plnkr.co/YACDv3/preview
export class SortValueConverter {

    // toView(arr, prop, ascending) {
    toView(rois, sortBy, sortAscending, roiTags) {
        if (!rois) {
            return new Map();
        }
        return Utils.sortRois(rois, sortBy, sortAscending, roiTags);
    }
}

// Sorts a copy of the tags (same order as the ROI tag sort) without mutating the observed array
export class SortTagsValueConverter {

    toView(tags, sortAscending) {
        if (!tags) {
            return [];
        }
        return [...tags].sort((a, b) => {
            let txtA = (a.textValue || '').toLowerCase();
            let txtB = (b.textValue || '').toLowerCase();
            if (txtA > txtB) return sortAscending ? 1 : -1;
            if (txtA < txtB) return sortAscending ? -1 : 1;
            return 0;
        });
    }
}
