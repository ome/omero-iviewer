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

        this.regions_ = regions_reference;
        this.map = regions_reference.viewer_.viewer_;

        this.overlay = new Overlay({
            element: this.tooltip,
            insertFirst: false,   // show over other controls
            autoPan: false,
          });

        this.map.addOverlay(this.overlay);
    };

    /**
     * Handle mouse moving on the image. If it moves over a feature and the
     * feature has some text to display, we show a popup.
     *
     * @param {Object} mapBrowserEvent
     */
    handleMoveEvent(mapBrowserEvent) {
        const map = mapBrowserEvent.map;
        let hits = [];
        // First check for features under mouse pointer (0 tolerance)
        map.forEachFeatureAtPixel(mapBrowserEvent.pixel,
            (feature) => hits.push(feature),
            {hitTolerance: 0}
        );
        // If nothing found, check wider
        if (hits.length == 0) {
            map.forEachFeatureAtPixel(mapBrowserEvent.pixel,
                (feature) => hits.push(feature),
                {hitTolerance: 5}
            );
        }
        let hit = featuresAtCoords(hits);
        this.overlay.setPosition(undefined);
        // If the event has come via the ShapeEditPopup or the shape is
        // selected then we ignore it.
        let isOverShapeEditPopup = mapBrowserEvent.originalEvent.isOverShapeEditPopup;
        if (hit && !hit['selected'] && !isOverShapeEditPopup) {
            let coords = mapBrowserEvent.coordinate;
            let textStyle = hit['oldText'];
            if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
                let text = textStyle.getText();
                let width = Math.min(Math.max(100, text.length * 8), 250);
                this.tooltip.innerHTML = `<div style='width: ${width}px'>
                                            ${ textStyle.getText() }
                                        </div>`;
                this.overlay.setPosition([coords[0], coords[1] + 20]);
            }
            // hover effect
            let shapeId = hit.getId();
            // if change in hover
            if (this.regions_.getHoverId() != shapeId) {
                this.regions_.setHoverId(shapeId);
            }
        } else {
            if (this.regions_.getHoverId()) {
                this.regions_.setHoverId(null);
            }
        }
    }

    /**
     * a sort of destructor - remove the overlay from the map
     */
    disposeInternal() {
        this.overlay.setPosition(undefined);
        this.map.removeOverlay(this.overlay);
        this.map = null;
    }
}

export default Hover;
