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
import { VIEWER_ELEMENT_PREFIX } from '../utils/constants';

/**
 * A Context Menu for the Viewer/Viewport
 */

@customElement('viewer-context-menu')
@inject(Context, BindingEngine)
export default class ViewerContextMenu {

    /**
     * the list of observers
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
            $('#viewer-context-menu').offset({top: 0, left: 0});
            $('#viewer-context-menu').hide();
            // get selected image config
            this.image_config =
                this.context.getSelectedImageConfig();
            // clean up old ready observer
            if (this.observers.length > 1 &&
                typeof this.observers[1] === 'object' &&
                this.observers[1] !== null) this.observers.pop().dispose();
            // we establish the new context menu once the viewer's ready
            this.observers.push(
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'ready').subscribe(
                        (newValue, oldValue) => this.enableContextMenu()
                    ));
        };
        // listen for image changes
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config')
                    .subscribe((newValue, oldValue) => registerReadyObserver()));
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ViewerContextMenu
     */
    unbind() {
        // get rid of observers
        this.observers.map((o) => {
            if (o) o.dispose();
        });
        this.observers = [];
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof ViewerContextMenu
     */
    attached() {
        // context menu for initial image config
        this.enableContextMenu();
        // we don't allow browser context menu on the context menu itself...
        $('#viewer-context-menu').contextmenu(() => {
            event.stopPropagation();
            event.preventDefault();
            return false;
        });
        // we have to monitor for ol3 full screen change
        // ol3 full screen
        document.onfullscreenchange = (e) => console.info(e);
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

       // a mousedown to prevent right clicks from affecting
       // other mousedown listeners (ol3-viewer ones)
      viewerTarget.mousedown(
           (event) => {
               // suppress click action if we have a context right click
               if (event.buttons === 2 ||
                   (event.buttons === undefined && event.which == 3)) {
                       event.stopPropagation();
                       event.preventDefault();
                       return false;
               };
               // hide context menu
               $('#viewer-context-menu').offset({top: 0, left: 0});
               $('#viewer-context-menu').hide();
           });
       // register context menu listener
      viewerTarget.contextmenu(
           (event) => {
               // prevent browser default context menu
               // and click from bubbling up
               event.stopPropagation();
               event.preventDefault();

               // show context menu
               $('#viewer-context-menu').offset(
                   {left: event.clientX, top: event.clientY});
               $('#viewer-context-menu').show();

               // prevent browser default context menu
               return false;
           });
    }

}
