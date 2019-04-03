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

import Overlay from 'ol/Overlay.js';
import {getTopLeft, getTopRight} from 'ol/extent';
import {sendEventNotification} from '../utils/Misc';

/**
 * @classdesc
 * Implements a leaner version of the standard open layers select without an extra
 * layer
 *
 * @extends {ol.interaction.Interaction}
 */
class ShapeEditPopup extends Overlay {

    /**
     * @constructor
     * 
     * @param {source.Regions} regions_reference a reference to Regions
     */
    constructor(regions_reference) {

        var els = document.querySelectorAll('.shape-edit-popup');
        let popup = els && els.length > 0 ? els[0] : null;
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'shape-edit-popup';
            popup.innerHTML = `
            <div>
                <input id='shape-popup-edit-text'
                    placeholder='Edit shape comment'
                    value=''/>
                <div id='shape-popup-coords'></div>
                <a href="#" id="shape-edit-popup-closer" class="shape-edit-popup-closer"></a>
            </div>`;
            // add flag to the event so that the Hover interaction can ignore it
            popup.onpointermove = function(e) {
                e.isOverShapeEditPopup = true;
            };

        }

        super({
            element: popup,
            insertFirst: false,
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            }
        });

        // TODO: Don't need to store all of these!
        this.popup = popup;
        this.regions = regions_reference;
        this.viewer_ = regions_reference.viewer_;
        this.map = regions_reference.viewer_.viewer_;
        // Need to add to map before we can bindListeners() to DOM elements
        this.map.addOverlay(this);
        this.bindListeners();
    };

    /**
     * Shows the popup Overlay above the Feature with text & coordinates
     * from the feature.
     *
     * @param {ol.Feature} feature
     */
    showPopupForShape(feature) {
        // Hide any current Hover popup
        this.map.getOverlays().forEach(o => o.setPosition(undefined));

        let textStyle = feature['oldText'];
        let text = "";
        if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
            text = textStyle.getText();
        }

        // so we know which shape we're editing...
        this.shapeId = feature.getId();

        document.getElementById('shape-popup-edit-text').value = text;

        // show if feature is visible
        if (this.regions.renderFeature(feature)) {
            this.updatePopupCoordinates(feature.getGeometry());
        }
    }

    /**
     * Updates the Text input value in the Popup if current shapeId is in
     * the list of shape_ids (but doesn't show the popup
     * if it's not already visible);
     *
     * @param {Array} shape_ids List of ['roi:shape'] ids
     */
    updatePopupText(shape_ids, text) {
        if (this.shapeId && shape_ids.indexOf(this.shapeId) > -1) {
            document.getElementById('shape-popup-edit-text').value = text;
        }
    }

    /**
     * Update visibility of Popup, according to the current shapeId;
     */
    updatePopupVisibility() {
        if (this.shapeId) {
            let feature = this.regions.getFeatureById(this.shapeId);
            if (feature && this.regions.renderFeature(feature)) {
                this.updatePopupCoordinates(feature.getGeometry());
            } else {
                this.setPosition(undefined);
            }
        }
    }

    /**
     * Hides the popup and clears the shapeId.
     * If shapeId is specified, only hide if this matches current shapeId.
     *
     * @param {string} shapeId Optional: in the form of 'roi:shape' ID
     */
    hideShapeEditPopup(shapeId) {
        if (shapeId === this.shapeId || shapeId === undefined) {
            this.shapeId = undefined;
            this.setPosition(undefined);
        }
    }

    /**
     * When dragging (translating) or modifying we want to update the display
     * and position of the popup.
     *
     * @param {ol.Geometry} geom The shape geometry we're editing
     */
    updatePopupCoordinates(geom) {
        let extent = geom.getExtent();
        let midX = (getTopLeft(extent)[0] + getTopRight(extent)[0]) / 2;
        let y = getTopLeft(extent)[1];

        let coordsText = '';
        if (geom.getDisplayCoords) {
            coordsText = geom.getDisplayCoords()
                .map(kv => `<b>${ kv[0] }</b>:
                    ${ kv[1].length > 50 ? (kv[1].substr(0, 50) + '...') : kv[1] }`)
                .join(', ');
        }

        let areaLength = this.regions.getLengthAndAreaForShape(geom);
        let unit = this.regions.viewer_.image_info_['pixel_size']['symbol_x'] || 'px';
        ['Area', 'Length'].forEach(dim => {
            if (areaLength.hasOwnProperty(dim)) {
                coordsText += `<br/><b> ${ dim }</b>: ${ areaLength[dim] } ${ unit }${ dim == 'Area' ? '&#178;' : ''}`;
            }
        })
        document.getElementById('shape-popup-coords').innerHTML = coordsText;

        if (this.regions.enable_shape_popup) {
            this.setPosition([midX, y]);
        }
    }

    /**
     * Add Listeners for events.
     */
    bindListeners() {
        let textInput = document.getElementById('shape-popup-edit-text');
        let inputTimeout;
        textInput.onkeyup = (event) => {

            // Use a de-bounce to automatically save when user stops typing
            if (inputTimeout) {
                clearTimeout(inputTimeout);
                inputTimeout = undefined;
            }
            inputTimeout = setTimeout(() => {
                let value = event.target.value;
                // Handled by Right panel UI, regions-edit.js
                sendEventNotification(
                    this.viewer_,
                    "IMAGE_COMMENT_CHANGE",
                    {
                        shapeId: this.shapeId,
                        Text: value,
                    }
                );
            }, 500);
        }

        document.getElementById('shape-edit-popup-closer').onclick = (event) => {
            this.setPosition(undefined);
            event.target.blur();
            return false;
        };
    }

    /**
     * Removes listeners added above
     */
    unbindListeners() {
        document.getElementById('shape-popup-edit-text').onkeyup = null;
        document.getElementById('shape-edit-popup-closer').onclick = null;
    }

    /**
     * a sort of destructor - remove the overlay from the map
     */
    disposeInternal() {
        this.unbindListeners();
        this.setPosition(undefined);
        this.map.removeOverlay(this);
        this.map = null;
    }
}

export default ShapeEditPopup;
