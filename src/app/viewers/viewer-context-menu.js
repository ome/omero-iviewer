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

// dependencies
import Context from '../context';
import {inject, customElement, BindingEngine, bindable} from 'aurelia-framework';
import {IMAGE_VIEWPORT_CAPTURE} from '../events/events';
import { VIEWER_ELEMENT_PREFIX } from '../utils/constants';

/**
 * A Context Menu for the Viewer/Viewport
 */

@customElement('viewer-context-menu')
@inject(Context, Element, BindingEngine)
export default class ViewerContextMenu {
    /**
     * the image config reference to work with (bound via template)
     * @memberof Ol3Viewer
     * @type {ImageConfig}
     */
    @bindable image_config = null;

    /**
     * the selector for the context menu
     * @memberof ViewerContextMenu
     * @type {string}
     */
    SELECTOR = ".viewer-context-menu";

    /**
     * the location of the context menu click
     * in ol-viewport 'coordinates' (offsets)
     * @memberof ViewerContextMenu
     * @type {Array.<number>}
     */
    viewport_location = null;

    /**
     * the other property observers
     * @memberof ViewerContextMenu
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the selected image config
     * @memberof ViewerContextMenu
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, element, bindingEngine) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof ViewerContextMenu
     */
    attached() {
        // we establish the new context menu once the viewer's ready
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.image_config.image_info, 'ready').subscribe(
                    (newValue, oldValue) => this.enableContextMenu()
                ));
        // notifies us of an image selection change
        this.observers.push(
             this.bindingEngine.propertyObserver(
                this.context, 'selected_config')
                    .subscribe((newValue, oldValue) => {
                        if (newValue !== this.image_config) {
                            this.hideContextMenu();
                        }
                }));
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof ViewerContextMenu
     */
    detached() {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
    }

    /**
     * Returns the context menu element
     * @return {Object} a jquery object containing the context menu element
     * @memberof ViewerContextMenu
     */
    getElement() {
        return $(this.element).find(this.SELECTOR);
    }

    /**
     * Hides the context menu
     * @memberof ViewerContextMenu
     */
    hideContextMenu() {
        this.getElement().offset({top: 0, left: 0});
        this.getElement().hide();
    }

    /**
     * Enables the context menu (registring the needed listeners)
     *
     * @memberof ViewerContextMenu
     */
    enableContextMenu() {
        let viewerTarget =
            $('#' + VIEWER_ELEMENT_PREFIX + this.image_config.id);
        if (viewerTarget.length === 0) return;

        // hide context menu on regular clicks
        viewerTarget.click((event) => this.hideContextMenu());
        // register context menu listener
        viewerTarget.contextmenu((event) => {
            // prevent browser default context menu
            // and click from bubbling up
            event.stopPropagation();
            event.preventDefault();

            // we don't allow right clicking on ol3-controls
            // i.e. the parent has to have class ol-viewport
            if (!$(event.target).parent().hasClass('ol-viewport')) return false;
            this.viewport_location = [event.offsetX, event.offsetY];

            // show context menu
            this.getElement().show();
            this.getElement().offset(
               {left: event.clientX, top: event.clientY});

            // prevent browser default context menu
            return false;
        });
        // we don't allow browser context menu on the context menu itself...
        this.getElement().off();
        this.getElement().contextmenu((event) => {
            event.stopPropagation();
            event.preventDefault();
            return false;
        });
    }

    /**
     * Paste Shapes
     *
     * @memberof ViewerContextMenu
     */
    pasteShapes() {
        this.image_config.regions_info.pasteShapes(this.viewport_location);
        // hide context menu
        this.hideContextMenu();
        // prevent link click behavior
        return false;
    }

    /**
     * Sends event to captures viewport as png
     *
     * @memberof ViewerContextMenu
     */
    captureViewport() {
        this.context.eventbus.publish(
            IMAGE_VIEWPORT_CAPTURE, {"config_id": this.image_config.id});
    }

}
