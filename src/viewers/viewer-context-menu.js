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
import Context from '../app/context';
import {inject, customElement, BindingEngine} from 'aurelia-framework';
import {IMAGE_VIEWPORT_CAPTURE} from '../events/events';
import Ui from '../utils/ui';
import { VIEWER_ELEMENT_PREFIX } from '../utils/constants';

/**
 * A Context Menu for the Viewer/Viewport
 */

@customElement('viewer-context-menu')
@inject(Context, BindingEngine)
export default class ViewerContextMenu {
    /**
     * the selector for the context menu
     * @memberof ViewerContextMenu
     * @type {string}
     */
    SELECTOR = "#viewer-context-menu";

    /**
     * a prefix for the full screen api methods
     * @memberof ViewerContextMenu
     * @type {string}
     */
    full_screen_api_prefix = null;

    /**
     * the location of the context menu click
     * in ol-viewport 'coordinates' (offsets)
     * @memberof ViewerContextMenu
     * @type {Array.<number>}
     */
    viewport_location = null;

    /**
     * the image config observer
     * @memberof ViewerContextMenu
     * @type {Object}
     */
    image_config_observer = null;

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
     * flag whether the delete option should be shown/enabled
     * @memberof ViewerContextMenu
     * @type {boolean}
     */
    selected_can_delete = true;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
        // set initial image config
        this.image_config = this.context.getSelectedImageConfig();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ViewerContextMenu
     */
    bind() {
        // Watches image config changes to establish new context menu
        // listeneres for the selected image (once ready)
        let registerReadyObserver = () => {
            // hide context menu
            this.hideContextMenu();
            // get selected image config
            this.image_config = this.context.getSelectedImageConfig();
            if (this.image_config === null) return;

            // clean up old observers
            this.unregisterObservers(true);
            // we establish the new context menu once the viewer's ready
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'ready').subscribe(
                        (newValue, oldValue) => this.enableContextMenu()
                    ));
            // we initalialize the regions context menu options once the data is ready
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.regions_info, 'ready').subscribe(
                        (newValue, oldValue) => this.initRegionsContextOptions()
                    ));
        };
        // listen for image changes
        this.image_config_observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config')
                    .subscribe((newValue, oldValue) => registerReadyObserver());
        // initial call
        registerReadyObserver();
    }

    /**
     * Unregisters the the observers (property and regions info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof ViewerContextMenu
     */
    unregisterObservers(property_only = false) {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
        if (property_only) return;
        if (this.image_config_observer) {
            this.image_config_observer.dispose();
            this.image_config_observer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ViewerContextMenu
     */
    unbind() {
        this.unregisterObservers();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof ViewerContextMenu
     */
    attached() {
        // register the fullscreenchange handler
        this.full_screen_api_prefix = Ui.getFullScreenApiPrefix();
        if (this.full_screen_api_prefix)
            document['on' + this.full_screen_api_prefix + 'fullscreenchange'] =
                () => this.onFullScreenChange();
    }

    /**
     * Depending ob the fullscreen change the context menu is included
     * or excluded from the ol3-viewer viewport
     *
     * @memberof ViewerContextMenu
     */
    onFullScreenChange() {
        this.hideContextMenu();
        let isInFullScreen =
            document[this.full_screen_api_prefix + 'isFullScreen'] ||
            document[this.full_screen_api_prefix + 'FullScreen'] ||
            document[this.full_screen_api_prefix + 'FullscreenElement'];

        let contextMenu = this.getElement();
        if (isInFullScreen)
            $('#' + this.image_config.id).append(contextMenu)
        else contextMenu.insertBefore(".center");
    }

    /**
     * Returns the context menu element
     * @return {Object} a jquery object containing the context menu element
     * @memberof ViewerContextMenu
     */
    getElement() {
        return $(this.SELECTOR);
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
        this.image_config = this.context.getSelectedImageConfig();
        let viewerTarget =
            $('#' + VIEWER_ELEMENT_PREFIX + this.image_config.id);
        if (viewerTarget.length === 0) return;

       // hide context menu on regular clicks
      viewerTarget.click((event) => this.hideContextMenu());
       // register context menu listener
      viewerTarget.contextmenu(
           (event) => {
               // prevent browser default context menu
               // and click from bubbling up
               event.stopPropagation();
               event.preventDefault();

               // we don't allow right clicking on ol3-controls
               // i.e. the parent has to have class ol-viewport
               if (!$(event.target).parent().hasClass('ol-viewport')) return false;
               this.viewport_location = [event.offsetX, event.offsetY];

               // show context menu
               this.getElement().offset(
                   {left: event.clientX, top: event.clientY});
               this.getElement().show();

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
     * Initialized the regions context menu options
     *
     * @memberof ViewerContextMenu
     */
    initRegionsContextOptions () {
        // listen to changes in selected shapes which determines the options
        this.observers.push(
            this.bindingEngine.collectionObserver(
                this.image_config.regions_info.selected_shapes).subscribe(
                    (newValue, oldValue) => this.onRoiSelectionChange()));
    }

    /**
     * Reacts to roi selection changes to update the corresponding members
     * such that the template can show/hide/enable/disable the appropriate options
     *
     * @memberof ViewerContextMenu
     */
    onRoiSelectionChange() {
        let numberOfshapesSelected =
            this.image_config.regions_info.selected_shapes.length;
        if (numberOfshapesSelected === 0) return;
        let lastSelected =
            this.image_config.regions_info.getLastSelectedShape("canDelete");
        this.selected_can_delete =
            this.image_config.regions_info.checkShapeForPermission(
                lastSelected, "canDelete");
    }

    /**
     * Copies shapes
     *
     * @memberof ViewerContextMenu
     */
    copyShapes() {
        this.image_config.regions_info.copyShapes();
        // hide context menu
        this.hideContextMenu();
        // prevent link click behavior
        return false;
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
     * Deletes selected shapes (incl. permissions check)
     *
     * @memberof ViewerContextMenu
     */
    deleteShapes(event) {
        this.image_config.regions_info.deleteShapes();
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
            IMAGE_VIEWPORT_CAPTURE, { "config_id": this.image_config.id});
        // hide context menu
        this.hideContextMenu();
        // prevent link click behavior
        return false;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ViewerContextMenu
     */
    unbind() {
        if (this.full_screen_api_prefix !== null &&
            document['on' + fullScreenApiPrefix + 'fullscreenchange'])
                document['on' + fullScreenApiPrefix + 'fullscreenchange'] = null;
    }

}
