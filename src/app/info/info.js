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
import Context from '../context';
import OpenWith from '../utils/openwith';

import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {INITIAL_TYPES, WEBCLIENT, IVIEWER, WEBGATEWAY} from '../utils/constants';

@customElement('info')
@inject(Context, BindingEngine)
export class Info {

    /**
     * a reference to the image info  (bound in template)
     * @memberof Info
     * @type {ImageInfo}
     */
    @bindable image_info = null;

    /**
     * the open with links
     * @memberof Info
     * @type {Array.<>}
     */
    open_with_links = [];

    /**
     * the associated dataset info
     * @memberof Info
     * @type {Object}
     */
    dataset_info = null;

    /**
     * the list of observers
     * @memberof Info
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * Values to display
     * @memberof Info
     */
    columns = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Info
     */
    bind() {
        let changeImageConfig = () => {
            if (this.image_info === null) return;

            if (this.image_info.ready) {
                this.onImageConfigChange();
                return;
            }
            // we are not yet ready, wait for ready via observer
            if (this.observers.length > 1 &&
                typeof this.observers[1] === 'object' &&
                this.observers[1] !== null) this.observers.pop().dispose();
            ['ready', 'parent_type'].map(
                (p) => {
                    this.observers.push(
                        this.bindingEngine.propertyObserver(
                            this.image_info, p).subscribe(
                                (newValue, oldValue) => this.onImageConfigChange()));
                });
        };
        // listen for image info changes
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this, 'image_info').subscribe(
                    (newValue, oldValue) => changeImageConfig()));
        // initial image config
        changeImageConfig();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Info
     */
    unbind() {
        // get rid of observers
        this.observers.map((o) => {
            if (o) o.dispose();
        });
        this.observers = [];
        this.columns = [];
    }

    /**
     * Handles changes of the seleccted ImageConfig
     *
     * @memberof Header
     */
    onImageConfigChange() {
        if (this.image_info === null) return;

        let pixels_size = "";
        let pixels_size_label = "Pixels Size (XYZ)";
        if (typeof this.image_info.image_pixels_size === 'object' &&
            this.image_info.image_pixels_size !== null) {
            let symbol = '\xB5m'; // microns by default
            let unit = 'MICROMETER';
            let count = 0;
            let set = false;
            if (typeof this.image_info.image_pixels_size.unit_x == 'number') {
                pixels_size += this.image_info.image_pixels_size.unit_x.toFixed(2);
                symbol = this.image_info.image_pixels_size.symbol_x;
                set = true;
            } else {
               pixels_size += "-";
               count++;
            }
            pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.unit_y == 'number') {
                pixels_size += this.image_info.image_pixels_size.unit_y.toFixed(2);
                if (!set) {
                    symbol = this.image_info.image_pixels_size.symbol_y;
                    set = true;
                }
            } else {
                pixels_size += "-";
                count++;
            }
            pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.unit_z == 'number') {
                pixels_size += this.image_info.image_pixels_size.unit_z.toFixed(2);
                if (!set) {
                    symbol = this.image_info.image_pixels_size.symbol_z;
                    set = true;
                }
            } else {
                pixels_size += "-";
                count++;
            }
            if (count === 3) {
                pixels_size = "Not available"
            } else {
                if (set) {
                     pixels_size_label += " ("+symbol+")";
                }
            }
        }
        pixels_size_label += ":";
        let size_xy = this.image_info.dimensions.max_x+" x "+this.image_info.dimensions.max_y
        this.columns = [
            {"label": "Owner:",
             "value": this.image_info.author,
            }
        ];
        if (this.image_info.acquisition_date) {
            this.columns.push(
                {"label": "Acquisition Date:",
                 "value": this.image_info.acquisition_date});
        };
        this.columns = this.columns.concat([
            {"label": "Import Date:",
             "value": this.image_info.import_date
            },
            {"label": "Dimension (XY):",
             "value": size_xy
            },
            {"label": "Pixels Type:",
             "value": this.image_info.image_pixels_type
            },
            {"label": pixels_size_label,
             "value": pixels_size
            },
            {"label": "Z-sections:",
             "value": this.image_info.dimensions.max_z
            },
            {"label": "Timepoints:",
             "value": this.image_info.dimensions.max_t
            }
        ]);
        if (typeof this.image_info.parent_id === 'number') {
            let isWell =
                this.context.initial_type === INITIAL_TYPES.WELL ||
                this.image_info.parent_type === INITIAL_TYPES.WELL;
            this.parent_info = {
                title: isWell ? "Well" : "Dataset",
                url: this.context.server +
                        this.context.getPrefixedURI(WEBCLIENT) +
                        '/?show=' + (isWell ? 'well' : 'dataset') +
                        '-' + this.image_info.parent_id,
                name: isWell ?
                        this.image_info.parent_id :
                        this.image_info.dataset_name === 'Multiple' ?
                            this.image_info.parent_id :
                            this.image_info.dataset_name
            }
        } else this.parent_info = null;

        this.updateOpenWithLinks();
    }

    /**
     * Updates open with links
     *
     * @memberof Header
     */
     updateOpenWithLinks() {
         let image_id = this.image_info.image_id;
         let image_name = this.image_info.image_name;
         let iviewer_url = this.image_info.context.getPrefixedURI(IVIEWER);
         let webgateway_url = this.image_info.context.getPrefixedURI(WEBGATEWAY);

         this.open_with_links.splice(
             0, this.open_with_links.length,
             ...OpenWith.getOpenWithLinkParams(image_id, image_name, iviewer_url, webgateway_url));
     }
}
