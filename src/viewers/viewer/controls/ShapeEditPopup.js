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
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import {getBottomLeft, getBottomRight, getTopLeft, getTopRight} from 'ol/extent';
import Line from '../geom/Line';
import {isArray,
        sendEventNotification} from '../utils/Misc';
import Ui from '../../../utils/ui';

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
        let popup = document.createElement('div');
        popup.className = 'shape-edit-popup';
        popup.innerHTML = `
        <div>
            <input class='shape-popup-edit-text'
                placeholder='Edit shape comment'
                value=''/>
            <div><input readonly class='shape-popup-coords'/></div>
            <div><input readonly class='shape-popup-area'/></div>
            <a href="#" class="shape-edit-popup-closer" class="shape-edit-popup-closer">&times;</a>
        </div>`;
        // add flag to the event so that the Hover interaction can ignore it
        popup.onpointermove = function(e) {
            e.isOverShapeEditPopup = true;
        };

        super({
            element: popup,
            insertFirst: false,
            autoPan: false,
        });

        // TODO: Don't need to store all of these!
        this.popup = popup;
        this.regions = regions_reference;
        this.viewer_ = regions_reference.viewer_;
        this.map = regions_reference.viewer_.viewer_;
        // Need to add to map before we can bindListeners() to DOM elements
        this.map.addOverlay(this);

        this.textInput = this.popup.querySelectorAll('.shape-popup-edit-text')[0];
        this.coordsInput = this.popup.querySelectorAll('.shape-popup-coords')[0];
        this.areaInput = this.popup.querySelectorAll('.shape-popup-area')[0];
        this.popupCloser = this.popup.querySelectorAll('.shape-edit-popup-closer')[0];
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
        let text = "";

        let style = feature.getStyle();
        if (typeof(style) === 'function') style = style(1);
        // we can have an array of styles (due to arrows)
        if (isArray(style))
            style = style[0];
        let textStyle = style instanceof Style ? style.getText() : null;
        // For non-labels (not showing text) we need to use 'oldText'
        if (textStyle === null && feature['oldText'] instanceof Text) {
            textStyle = feature['oldText'];
        }
        if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
            text = textStyle.getText();
        }

        // so we know which shape we're editing...
        this.shapeId = feature.getId();

        this.textInput.value = text;

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
            this.textInput.value = text;
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
        let view = this.map.getView()

        // gotta get opposite coord depending on mirror
        let x = view.values_.flipX ? (getBottomLeft(extent)[0] + getBottomRight(extent)[0]) / 2 : (getTopLeft(extent)[0] + getTopRight(extent)[0]) / 2;
        let y = view.values_.flipY ? getBottomLeft(extent)[1] : getTopLeft(extent)[1];

        // If it's a Line, popup is on upper end of the line
        if (geom instanceof Line) {
            let coords = geom.getLineCoordinates();
            if (coords[1] < coords[3]) {
                x = coords[2];
            } else if (coords[1] > coords[3]) {
                x = coords[0]
            };
        }

        let coordsText = '';
        if (geom.getDisplayCoords) {
            coordsText = geom.getDisplayCoords()
                .map(kv => `${ kv[0] }: ${ kv[1] }`)
                .join(', ');
        }

        let areaText = "";
        let areaLength = this.regions.getLengthAndAreaForShape(geom);
        if (this.regions.viewer_ && areaLength) {
            let unit = this.regions.viewer_.image_info_['pixel_size']['symbol_x'] || 'px';
            ['Area', 'Length'].forEach(dim => {
                if (areaLength.hasOwnProperty(dim)) {
                    areaText += `${ dim }: ${ areaLength[dim] } ${ unit }${ dim == 'Area' ? '²' : ''}`;
                }
            })
        }
        this.coordsInput.value = coordsText;
        this.areaInput.value = areaText;
        
        if (this.regions.viewer_.enable_shape_popup) {
            let viewportPosition = this.map.getViewport().getBoundingClientRect()

            // unfortunately need to convert to pixel and back
            let pixels = this.map.getPixelFromCoordinate([x,y])
            if (view.values_.flipX) pixels[0]=viewportPosition.width-pixels[0]
            if (view.values_.flipY) pixels[1]=viewportPosition.height-pixels[1]
            let coord = this.map.getCoordinateFromPixel(pixels)

            this.setPosition(coord);
        }
    }

    /**
     * Add Listeners for events.
     */
    bindListeners() {
        let inputTimeout;
        this.textInput.onkeyup = (event) => {

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

        this.popupCloser.onclick = (event) => {
            this.setPosition(undefined);
            event.target.blur();

            Ui.showModalMessage(`<p>ROI popups disabled.</p>
            <p>To re-enable popups, right-click on the image and use the context menu.</p>`, "OK");

            sendEventNotification(
                this.viewer_,
                "ENABLE_SHAPE_POPUP",
                {enable: false}
            );
            return false;
        };
    }

    /**
     * Removes listeners added above
     */
    unbindListeners() {
        this.textInput.onkeyup = null;
        this.popupCloser.onclick = null;
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
