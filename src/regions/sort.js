
// based on example at https://embed.plnkr.co/YACDv3/preview
export class SortValueConverter {

    // toView(arr, prop, ascending) {
    toView(rois) {
        // Convert Map to an Array of objects...
        let ids = Array.from(rois.keys());
        // Add id to each object so we know it after sorting
        let roiList = ids.map(id => {
            return Object.assign(rois.get(id), {id: id})
        });

        // Sort e.g. by number of shapes in the ROI
        let prop = 'shapes';
        let sorted = roiList.sort((a, b) => {
            if (a[prop].size > b[prop].size) return 1;
            if (a[prop].size < b[prop].size) return -1;
            return 0;
        });

        // Convert back to dictionary, inserting in the sorted order
        let orderedMap = new Map( sorted.map(r => [r.id, r]));

        // return ascending ? sorted : sorted.reverse();
        return orderedMap;
    }
}
