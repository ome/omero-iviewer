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
// js
import {inject,customElement, BindingEngine} from 'aurelia-framework';
import Context from './context';

/**
 * @classdesc
 *
 * the app header
 */
@customElement('header')
@inject(Context, BindingEngine)
export class Header {
    /**
     * the selected image info
     * @memberof Header
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * observer watching for changes in the selected image
     * @memberof Header
     * @type {Object}
     */
    selected_image_observer = null;

    /**
     * observer watching for when the image info data is ready
     * @memberof Header
     * @type {Object}
     */
    image_info_ready_observer = null;

    /**
     * shorter version of the image name
     * @memberof Header
     * @type {String}
     */
     short_image_name = ""

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Header
     */
    bind() {
        // initial image config
        this.onImageConfigChange();
        // register observer for selected image configs and event subscriptions
        this.selected_image_observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config').subscribe(
                    (newValue, oldValue) => this.onImageConfigChange());
    }

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Handles changes of the selected image config
     *
     * @memberof Header
     */
     onImageConfigChange() {
        if (this.context.getSelectedImageConfig() === null) return;

        this.image_info = this.context.getSelectedImageConfig().image_info;

        let imageInfoReady = () => {
            let fullPath = this.image_info.image_name.replace("\\", "/");
            let fields = fullPath.split("/");
            this.short_image_name = fields[fields.length-1];
        };

        if (this.image_info.ready) {
            imageInfoReady();
            return;
        }

        this.unregisterObservers(true);
        this.image_info_ready_observer =
            this.bindingEngine.propertyObserver(
                this.image_info, 'ready').subscribe(
                    (newValue, oldValue) => imageInfoReady());
     }

     /**
      * Toggles MDI/single image viewing mode
      *
      * @memberof Header
      */
     toggleMDI() {
         if (this.context.useMDI)
             for (let [id, conf] of this.context.image_configs)
                 if (id !== this.context.selected_config)
                      this.context.removeImageConfig(id,conf)
         this.context.useMDI = !this.context.useMDI;
     }

     /**
      * Unregisters the the observers (image selection and image data ready)
      *
      * @param {boolean} ready_only true if only the image data ready observer is cleaned up
      * @memberof Header
      */
     unregisterObservers(ready_only = false) {
         if (this.image_info_ready_observer) {
             this.image_info_ready_observer.dispose();
             this.image_info_ready_observer = null;
         }
         if (ready_only) return;
         if (this.selected_image_observer) {
             this.selected_image_observer.dispose();
             this.selected_image_observer = null;
         }
     }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.unregisterObservers();
    }
}
