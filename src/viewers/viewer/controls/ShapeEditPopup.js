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
            popup.innerHTML = `<div>
                <input id='shape-popup-edit-text'
                    placeholder='Edit shape comment'
                    value=''/>
                <div id='shape-popup-coords'></div>
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

    showPopupForShape(feature) {
        // Hide any current Hover popup
        this.map.getOverlays().forEach(o => o.setPosition(undefined));

        let geom = feature.getGeometry();
        let extent = geom.getExtent();
        let midX = (getTopLeft(extent)[0] + getTopRight(extent)[0]) / 2;
        let y = getTopLeft(extent)[1];

        let textStyle = feature['oldText'];
        let text = "";
        if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
            text = textStyle.getText();
        }
        this.currentText = text.length > 0 ? text : undefined;

        // so we know which shape we're editing...
        this.shapeId = feature.getId();

        let coordsText = '';
        if (geom.getDisplayCoords) {
            coordsText = geom.getDisplayCoords()
                .map(kv => `<b>${ kv[0] }</b>:
                ${ kv[1].length > 50 ? (kv[1].substr(0, 50) + '...') : kv[1] }`)
            .join(', ');
        }
        document.getElementById('shape-popup-edit-text').value = text;
        document.getElementById('shape-popup-coords').innerHTML = coordsText;
        this.setPosition([midX, y]);
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
        document.getElementById('shape-popup-coords').innerHTML = coordsText;
        this.setPosition([midX, y]);
    }

    // TODO: Needs more work to notify Aurelia UI of changes
    bindListeners() {
        document.getElementById('shape-popup-edit-text').onkeyup = (event) => {
            let value = event.target.value;

            // Handled by Right panel UI, regions-edit.js
            sendEventNotification(
                this.viewer_,
                "IMAGE_COMMENT_CHANGE",
                {
                    shapes: [this.shapeId],
                    Text: value,
                }
            );
        }
    }

    unbindListeners() {
        // TODO: remove all listeners added above
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
