
// based on example at https://embed.plnkr.co/YACDv3/preview
export class SortValueConverter {

    // toView(arr, prop, ascending) {
    toView(rois, sortBy, sortAscending) {
        // Convert Map to an Array of objects...
        let ids = Array.from(rois.keys());
        // Add id to each object so we know it after sorting
        let roiList = ids.map(id => {
            return Object.assign(rois.get(id), {id: id})
        });

        // default - sort by ROI ID
        let getAttr = (roi) => roi.id

        let getShapeText = (roi) => {
            if (!roi.shapes) return "";
            let label = "";
            for (let shape of roi.shapes.values()) {
                if (shape.Text && shape.Text.length > 0) {
                    label = shape.Text;
                    break;
                }
            }
            return label.toLowerCase();
        }

        let getNumberAttr = (attrName) => (roi) => {
            if (!roi.shapes) return -1;
            let val;
            // Return val of first shape
            for (let shape of roi.shapes.values()) {
                val = shape[attrName];
                break;
            }
            return val === undefined ? -1 : val;
        }

        if (sortBy === 'shapeText') {
            getAttr = getShapeText;
        } else if (sortBy === 'theZ') {
            getAttr = getNumberAttr('TheZ');
        } else if (sortBy === 'theT') {
            getAttr = getNumberAttr('TheT');
        }

        let sorted = roiList.sort((a, b) => {
            let aValue = getAttr(a);
            let bValue = getAttr(b);
            if (aValue > bValue) return sortAscending ? 1 : -1;
            if (aValue < bValue) return sortAscending ? -1 : 1;
            return 0;
        });

        // Convert back to dictionary, inserting in the sorted order
        let orderedMap = new Map( sorted.map(r => [r.id, r]));

        return orderedMap;
    }
}
