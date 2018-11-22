//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
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
import Control from "ol/control/control";
import EventType from 'ol/events/eventtype';
import CSS from "ol/css";
import Events from "ol/events";
import Easing from "ol/easing";
import ol from "ol";

import * as MiscUtils from '../utils/Misc';

/**
 * @classdesc
 * A custom zoom control that displays the zoom with the possibility to
 * enter a number
 *
 * @constructor
 * @extends {ol.control.Control}
 * @param {olx.control.ZoomOptions=} opt_options Zoom options.
 */
export default class Zoom extends Control {

    /**
     *
     * @param {olx.control.ZoomOptions=} opt_options
     */
    constructor(opt_options) {
        let options = opt_options ? opt_options : {};
        let element = document.createElement('div');
        let buttonGroup = document.createElement('div');

        super({
            element: element,
            target: options.target
        });

        /**
         * @type {number}
         * @private
         */
        this.duration_ = options.duration !== undefined ? options.duration : 0;

        /**
         * @type {number}
         * @private
         */
        this.delta_ = options.delta === 'number' ? options.delta : 1;

        /**
         * @type {string}
         * @private
         */
        this.class_name_ =
            options.className === 'string' ? options.className : 'ol-zoom';

        // Setup elements
        element.className = `${this.class_name_} ${CSS.CLASS_UNSELECTABLE} ${CSS.CLASS_CONTROL}`;
        buttonGroup.className = "btn-group btn-group-sm ol-zoom-buttons";
        buttonGroup.appendChild(this.addZoomButton_(false));
        buttonGroup.appendChild(this.addZoomButton_(true));
        buttonGroup.appendChild(this.addFitToExtentButton_());
        buttonGroup.appendChild(this.addOneToOneButton_());
        element.appendChild(buttonGroup);
        element.appendChild(this.addZoomPercentage_());
    }

    /**
     * Adds both, zoom in and out buttons
     * @param {boolean} zoom_in the in zoom button is added if true, otherwise out
     * @private
     */
    addZoomButton_(zoom_in) {
        if (typeof zoom_in !== 'boolean') zoom_in = false;

        let title = 'Zoom ' + (zoom_in ? 'in' : 'out');
        let element = document.createElement('button');
        element.className =
            this.class_name_ + (zoom_in ? '-in' : '-out') +
            " btn btn-default glyphicon " +
            (zoom_in ? 'glyphicon-plus' : 'glyphicon-minus');
        element.setAttribute('type', 'button');
        element.title = title;

        Events.listen(element, EventType.CLICK,
            ome.ol3.controls.Zoom.prototype.handleClick_,
            this);

        return element;
    };

    /**
     * Adds an input field for entering and displaying zoom values (in percent)
     * @private
     */
    addZoomPercentage_() {
        let zoomDisplayElement = document.createElement('input');
        zoomDisplayElement.className = this.class_name_ + '-display';
        zoomDisplayElement.setAttribute('type', 'input');
        zoomDisplayElement.className = 'form-control ol-zoom-display';
        Events.listen(zoomDisplayElement, "keyup", (event) => {
            if (event.keyCode === 13)
                this.changeResolution_(parseInt(zoomDisplayElement.value));
        }, this);

        let percent = document.createElement('button');
        percent.className = 'btn btn-default ol-zoom-percent';
        percent.title = 'Click to apply Zoom Value';
        percent.appendChild(document.createTextNode("%"));
        Events.listen(percent, "click", (event) => {
            this.changeResolution_(parseInt(zoomDisplayElement.value));
        }, this);

        let span = document.createElement('span');
        span.className = "input-group-btn input-group-sm";
        span.appendChild(percent);
        let element = document.createElement('div');
        element.className = "input-group ol-zoom-percentage";
        element.appendChild(zoomDisplayElement);
        element.appendChild(span);

        return element;
    }

    /**
     * Changes the resolution to the given value
     * @param {number} value the new value
     * @private
     */
    changeResolution_(value) {
        let map = this.getMap();
        let view = map ? map.getView() : null;
        if (view === null) return;

        if (!isNaN(value)) {
            if (value < 0) value = 0;
            let constrainedResolution =
                view.constrainResolution(1 / (value / 100), 0, 0);
            view.setResolution(constrainedResolution);
        }
        let targetId = MiscUtils.getTargetId(map.getTargetElement());
        let zoomDisplayElement =
            document.getElementById('' + targetId).querySelectorAll(
                '.ol-zoom-display');
        if (zoomDisplayElement.length === 0) return;
        zoomDisplayElement[0].value = Math.round((1 / view.getResolution()) * 100);
    }

    /**
     * Adds a 1:1 zoom button
     * @private
     */
    addOneToOneButton_() {
        let oneToOneElement = document.createElement('button');
        oneToOneElement.className = this.class_name_ + '-1-1' + " btn btn-default";
        oneToOneElement.setAttribute('type', 'button');
        oneToOneElement.title = "Actual Size";
        oneToOneElement.appendChild(document.createTextNode("1:1"));
        Events.listen(oneToOneElement, EventType.CLICK, () => {
            let map = this.getMap();
            let view = map ? map.getView() : null;
            if (view === null) return;
            view.setResolution(1);
            let ext = view.getProjection().getExtent();
            view.setCenter([(ext[2] - ext[0]) / 2, -(ext[3] - ext[1]) / 2]);
        }, this);

        return oneToOneElement;
    };

    /**
     * Adds a zoom button that will make the image fit into the viewing extent
     * @private
     */
    addFitToExtentButton_() {
        let oneToOneElement = document.createElement('button');
        oneToOneElement.className =
            this.class_name_ + '-fit' +
            " btn btn-default glyphicon glyphicon-fullscreen";
        oneToOneElement.setAttribute('type', 'button');
        oneToOneElement.title = "Zoom Image to Fit";
        Events.listen(oneToOneElement, EventType.CLICK,
            () => {
                let map = this.getMap();
                let view = map ? map.getView() : null;
                if (view === null) return;

                let ext = view.getProjection().getExtent();
                view.fit([ext[0], -ext[3], ext[2], ext[1]]);
            }, this);

        return oneToOneElement;
    };

    /**
     * @param {Event} event The event to handle
     * @private
     */
    handleClick_(event) {
        event.preventDefault();

        let map = this.getMap();
        let view = map.getView();
        if (!view) return;

        let delta = event.target.className.indexOf("ol-zoom-out") !== -1 ? -1 : 1;
        let currentResolution = view.getResolution();
        if (currentResolution) {
            let newResolution = view.constrainResolution(currentResolution, delta);
            if (this.duration_ > 0) {
                if (view.getAnimating()) {
                    view.cancelAnimations();
                }
                view.animate({
                    resolution: newResolution,
                    duration: this.duration_,
                    easing: Easing.easeOut
                });
            } else view.setResolution(newResolution);
        }
    }


}
