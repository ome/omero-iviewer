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

import {listen} from 'ol/events';
import EventType from 'ol/events/EventType';
import Control from 'ol/control/Control';
import {CLASS_UNSELECTABLE, CLASS_CONTROL } from 'ol/css';
import {easeOut} from 'ol/easing';
import {getTargetId} from '../utils/Misc';

/**
 * @classdesc
 * A custom zoom control that displays the zoom with the possibility to
 * enter a number
 *
 * @extends {ol.control.Control}
 */
class Zoom extends Control {

    /**
     * @constructor
     * @param {ol.control.ZoomOptions=} opt_options Zoom options.
     */
    constructor(opt_options) {
        var options = opt_options ? opt_options : {};

        var element = document.createElement('div');
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

        var cssClasses =
            this.class_name_ + ' ' + CLASS_UNSELECTABLE + ' ' +
                CLASS_CONTROL;

        element.className = cssClasses;
        var buttonGroup = document.createElement('div');
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

        var title = 'Zoom ' + (zoom_in ? 'in' : 'out');
        var element = document.createElement('button');
        element.className =
            this.class_name_ + (zoom_in ? '-in' : '-out') +
            " btn btn-default glyphicon " +
            (zoom_in ? 'glyphicon-plus' : 'glyphicon-minus');
        element.setAttribute('type', 'button');
        element.title = title;

        listen(element, EventType.CLICK, this.handleClick_, this);

        return element;
    }

    /**
     * Adds an input field for entering and displaying zoom values (in percent)
     * @private
     */
    addZoomPercentage_() {
        var zoomDisplayElement = document.createElement('input');
        zoomDisplayElement.className = this.class_name_ + '-display';
        zoomDisplayElement.setAttribute('type', 'input');
        zoomDisplayElement.className = 'form-control ol-zoom-display';
        listen(
            zoomDisplayElement, "keyup",
            function(event) {
                if (event.keyCode === 13)
                    this.changeResolution_(parseInt(zoomDisplayElement.value));
            },this);

        var percent = document.createElement('button');
        percent.className = 'btn btn-default ol-zoom-percent';
        percent.title = 'Click to apply Zoom Value';
        percent.appendChild(document.createTextNode("%"));
        listen(
            percent, "click",
            function() {
                this.changeResolution_(parseInt(zoomDisplayElement.value));
            },this);

        var span = document.createElement('span');
        span.className = "input-group-btn input-group-sm";
        span.appendChild(percent);
        var element = document.createElement('div');
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
        var map = this.getMap();
        var view = map ? map.getView() : null;
        if (view === null) return;

        if (!isNaN(value)) {
            if (value < 0 ) value = 0;
            var constrainedResolution =
                view.constrainResolution(1 / (value / 100), 0, 0);
                view.setResolution(constrainedResolution);
        }
        var targetId = getTargetId(map.getTargetElement());
        var zoomDisplayElement =
            document.getElementById('' + targetId).querySelectorAll(
                '.ol-zoom-display')
        if (zoomDisplayElement.length === 0) return;
        zoomDisplayElement[0].value = Math.round((1 / view.getResolution()) * 100);
    }

    /**
     * Adds a 1:1 zoom button
     * @private
     */
    addOneToOneButton_() {
        var oneToOneElement = document.createElement('button');
        oneToOneElement.className = this.class_name_ + '-1-1' + " btn btn-default";
        oneToOneElement.setAttribute('type', 'button');
        oneToOneElement.title = "Actual Size";
        oneToOneElement.appendChild(document.createTextNode("1:1"));
        listen(oneToOneElement, EventType.CLICK,
            function() {
                var map = this.getMap();
                var view = map ? map.getView() : null;
                if (view === null) return;
                view.setResolution(1);
            }, this);

        return oneToOneElement;
    }

    /**
     * Adds a zoom button that will make the image fit into the viewing extent
     * @private
     */
    addFitToExtentButton_() {
        var oneToOneElement = document.createElement('button');
        oneToOneElement.className =
            this.class_name_ + '-fit' +
            " btn btn-default glyphicon glyphicon-fullscreen";
        oneToOneElement.setAttribute('type', 'button');
        oneToOneElement.title = "Zoom Image to Fit";
        listen(oneToOneElement, EventType.CLICK,
            function() {
                var map = this.getMap();
                var view = map ? map.getView() : null;
                if (view === null) return;

                var ext = view.getProjection().getExtent();
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

        var map = this.getMap();
        var view = map.getView();
        if (!view) return;

        var delta = event.target.className.indexOf("ol-zoom-out") !== -1 ? -1 : 1;
        var currentResolution = view.getResolution();
        if (currentResolution) {
            var newResolution = view.constrainResolution(currentResolution, delta);
            if (this.duration_ > 0) {
                if (view.getAnimating()) {
                view.cancelAnimations();
                }
                view.animate({
                resolution: newResolution,
                duration: this.duration_,
                easing: easeOut
                });
            } else view.setResolution(newResolution);
        }
    }
}

export default Zoom;
