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

// import Feature from 'ol/Feature';
import Pointer from 'ol/interaction/Pointer';
import Overlay from 'ol/Overlay.js';
import {featuresAtCoords} from '../utils/Misc';

/**
 * @classdesc
 * Implements a leaner version of the standard open layers select without an extra
 * layer
 *
 * @extends {ol.interaction.Interaction}
 */
class Hover extends Pointer {

    /**
     * @constructor
     * 
     * @param {source.Regions} regions_reference a reference to Regions
     */
    constructor(regions_reference) {

        super({});

        var els = document.querySelectorAll(
            '.hover-popup');
        this.tooltip = els && els.length > 0 ? els[0] : null;
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'hover-popup';
        }

        this.map = regions_reference.viewer_.viewer_;

        this.overlay = new Overlay({
            element: this.tooltip,
            autoPan: false,
          });

        this.map.addOverlay(this.overlay);

    };

    handleMoveEvent(mapBrowserEvent) {
        const map = mapBrowserEvent.map;
        let hits = [];
        map.forEachFeatureAtPixel(mapBrowserEvent.pixel,
            (feature) => hits.push(feature),
            {hitTolerance: 5}
        );
        let hit = featuresAtCoords(hits);
        if (hit) {
            let coords = mapBrowserEvent.coordinate;
            this.overlay.setPosition([coords[0], coords[1] + 20]);
            this.overlay.changed();
            let html = 'ID: ' + hit.getId();
            let textStyle = hit['oldText'];
            let geom = hit.getGeometry();
            if (geom && geom.displayCoords) {
                html += '<br>' + geom.displayCoords().map(kv => `<b>${kv[0]}</b>: ${kv[1]}`).join(', ');
            }
            if (textStyle && textStyle.getText()) {
                html += '<br>' + textStyle.getText();
            }
            this.tooltip.innerHTML = html;
        } else {
            this.overlay.setPosition(undefined);
        }
    }

    /**
     * Tests to see if the given coordinates intersects any of our features.
     * @param {Array.<number>} pixel pixel coordinate to test for intersection.
     * @param {number} tolerance a pixel tolerance/buffer
     * @param {boolean} use_already_selected will only consider already selected
     * @return {ol.Feature} Returns the feature found at the specified pixel
     *                      coordinates.
     */
    featuresAtCoords_(pixel, tolerance, use_already_selected) {
        if (!isArray(pixel) || pixel.length !== 2) return;

        if (typeof tolerance !== 'number') tolerance = 5; // 5 pixel buffer
        if (typeof use_already_selected !== 'boolean') use_already_selected = false;
        var v = this.regions_.viewer_.viewer_;
        var min = v.getCoordinateFromPixel(
                    [pixel[0]-tolerance, pixel[1]+tolerance]);
        var max = v.getCoordinateFromPixel(
                [pixel[0]+tolerance, pixel[1]-tolerance]);
        var extent = [min[0], min[1], max[0], max[1]];
        var hits = [];

        var alreadySelected = this.features_.getArray();
        this.regions_.forEachFeatureInExtent(
            extent, function(feat) {
                if (feat.getGeometry().intersectsExtent(extent)) {
                    if (!use_already_selected ||
                        (use_already_selected &&
                            includes(alreadySelected, feat))) hits.push(feat);
                }
            });

        return featuresAtCoords(hits);
    };

    /**
     * a sort of destructor
     */
    disposeInternal() {
        // this.regions_ = null;
        this.overlay.setPosition(undefined);
        this.map.removeOverlay(this.overlay);
        this.map = null;
    }
}

export default Hover;
