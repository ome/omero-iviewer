//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import TileGrid from 'ol/tilegrid/TileGrid.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import {getTopLeft} from 'ol/extent';

import {isArray,
    featuresAtCoords,
    sendEventNotification} from '../utils/Misc';
import {PLUGIN_PREFIX} from '../globals';
import OmeJSON from '../format/OmeJSON';

export const ROI_TILE_SIZE = 256;

class OmeVectorTileSource extends VectorTileSource {

    constructor(viewerReference) {

        let image_info_ = viewerReference.image_info_;
        let projection = viewerReference.proj_;

        var zoomLevelScaling = null;
        var dims = image_info_['size'];
        if (image_info_['zoomLevelScaling']) {
            var tmp = [];
            for (var r in image_info_['zoomLevelScaling'])
                tmp.push(1 / image_info_['zoomLevelScaling'][r]);
            zoomLevelScaling = tmp.reverse();
        }
        var zoom = zoomLevelScaling ? zoomLevelScaling.length : -1;
        var extent = [0, -dims['height'], dims['width'], 0];
        var tile_size = image_info_['tile_size']
        var tile_width = tile_size ? tile_size.width : ROI_TILE_SIZE;
        var tile_height = tile_size ? tile_size.height : ROI_TILE_SIZE;
        var tgOpts = {
            tileSize: [tile_width, tile_height],
            extent: extent,
            origin: getTopLeft(extent),
            resolutions: zoom > 1 ? zoomLevelScaling : [1],
        }
        var tileGrid = new TileGrid(tgOpts);

        super({
            tileGrid: tileGrid,
        })

        // Load ROIs by tile
        this.setTileUrlFunction((tileCoord) => {
            var viewerT = this.viewer_.getDimensionIndex('t');
            var viewerZ = this.viewer_.getDimensionIndex('z');

            let x = tileCoord[1];
            let y = -tileCoord[2] - 1;
            var zoom = zoomLevelScaling ? zoomLevelScaling.length - tileCoord[0] - 1 : 0;
            var tile = + zoom  + ',' + tileCoord[1] + ',' + (-tileCoord[2]-1);
            tile = tile + ',' + tile_width + ',' + tile_height;
            let iviewer = viewerReference.getPrefixedURI(PLUGIN_PREFIX);
            return `${ iviewer }/shapes_by_region/${ image_info_.id }/${ viewerZ }/${ viewerT }/?tile=${ tile }`;
        });

        // Format is responsible for creating Features from JSON response shapes
        // It needs reference to viewer/regions because Features need to
        // know viewer state to update their Style
        let omeFormat = new OmeJSON({
            regions: this,
            projection: projection
        });
        this.format_ = omeFormat;

        /**
         * Keep track of selected features.
         * 'roiIdshapId': True
         *
         * See https://openlayers.org/en/latest/examples/vector-tile-selection.html
         */
        this.selectedFeatures_ = {};

        /**
         * Keep track of hidden features.
         * 'roiIdshapId': True
         */
        this.hiddenFeatures_ = {};

        /**
         * a flag that tells us if we'd like for the text to be scaled with resolution
         * changes of the view. Defaults to true.
         * NB: No setScaleText() function since it's never used
         * @type {boolean}
         */
        this.scale_text_ = false;

        /**
         * the viewer reference
         *
         * @type {Viewer}
         * @private
         */
        this.viewer_ = viewerReference;
    }

    /**
     * This overrides the parent class, which otherwise tries to create a
     * tileGrid for some reason and this doesn't match what we need.
     */
    getTileGridForProjection() {
        return this.tileGrid;
    }

    /**
     * Marks given shapes as selected, clearing any previously selected if
     * clear flag is set.
     *
     * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
     * @param {boolean} selected flag whether we should (de)select the rois
     * @param {boolean} clear flag whether we should clear existing selection beforehand
     */
    selectShapes(roi_shape_ids, selected, clear) {

        if (clear) {
            let toDeselect = [];
            let properties = [];
            let values = [];
            for (let id in this.selectedFeatures_) {
                toDeselect.push(id);
                properties.push('selected');
                values.push(false);
            }
            if (toDeselect.length > 0) {
                sendEventNotification(
                    this.viewer_, "TILED_REGIONS_PROPERTY_CHANGED",
                    {
                        "properties" : properties,
                        "shapes": toDeselect,
                        "values": values,
                    }, 0);
            }
            this.selectedFeatures_ = {};
        }

        if (!isArray(roi_shape_ids)) return;

        let properties = [];
        let values = [];
        roi_shape_ids.forEach(id => {
            properties.push('selected');
            values.push(selected);
            if (selected) {
                // Store {'roi:shape' : true}
                // Need to keep 'roi:shape' to notify of deselections
                this.selectedFeatures_[id] = true;
            } else if (this.selectedFeatures_[id]) {
                delete this.selectedFeatures_[id];
            }
        });

        sendEventNotification(
            this.viewer_, "TILED_REGIONS_PROPERTY_CHANGED",
            {
                "properties" : properties,
                "shapes": roi_shape_ids,
                "values": values
            }, 25);
    }

    /**
     * Return True if this feature is selected
     *
     * @param {ol.Feature} feature The feature
     */
    isFeatureSelected(feature) {
        let roi_shape_id = feature.getId();
        return this.selectedFeatures_[roi_shape_id];
    }

    /**
     * Toggles the visibility of the regions.
     *
     * @param {boolean} visible visibitily flag (true for visible)
     * @param {Array<string>} roi_shape_ids a list of string ids of the form: roi_id:shape_id
     */
    setRegionsVisibility(roi_shape_ids, visible) {
        let properties = [];
        let values = [];
        roi_shape_ids.forEach(id => {
            properties.push('visible');
            values.push(visible);
            if (!visible) {
                // Store {'roi:shape' : true}
                this.hiddenFeatures_[id] = true;
            } else if (this.hiddenFeatures_[id]) {
                delete this.hiddenFeatures_[id];
            }
        });

        // this isn't currently used but is consistent behaviour
        sendEventNotification(
            this.viewer_, "TILED_REGIONS_PROPERTY_CHANGED",
            {
                "properties" : properties,
                "shapes": roi_shape_ids,
                "values": values
            }, 25);
    }

    /**
     * Return True if this feature is visible
     *
     * @param {ol.Feature} feature The feature
     */
    isFeatureVisible(feature) {
        let roi_shape_id = feature.getId();
        return !this.hiddenFeatures_[roi_shape_id];
    }
}

export default OmeVectorTileSource;
