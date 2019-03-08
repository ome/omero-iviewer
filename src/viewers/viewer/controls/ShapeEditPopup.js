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
import {getTopLeft, getTopRight} from 'ol/extent';
import {featuresAtCoords} from '../utils/Misc';

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
            popup.innerHTML = '<div>Edit Me</div>';
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

        this.popup = popup;
        this.map = regions_reference.viewer_.viewer_;
        this.map.addOverlay(this);
    };

    showPopupForShape(feature) {

        let geom = feature.getGeometry();
        let extent = geom.getExtent();
        let midX = (getTopLeft(extent)[0] + getTopRight(extent)[0]) / 2;
        let y = getTopLeft(extent)[1];

        let textStyle = feature['oldText'];
        let text = "";
        if (textStyle && textStyle.getText() && textStyle.getText().length > 0) {
            text = textStyle.getText();
        }

        this.popup.innerHTML = `<div style='width: 300px'>
                                    <input value='${ text }'/>
                                    </div>`;
        this.setPosition([midX, y]);
    }

    /**
     * a sort of destructor - remove the overlay from the map
     */
    disposeInternal() {
        this.setPosition(undefined);
        this.map.removeOverlay(this);
        this.map = null;
    }
}

export default ShapeEditPopup;
