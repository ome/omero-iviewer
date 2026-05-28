//
// Copyright (C) 2026 University of Dundee & Open Microscopy Environment.
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
import Context from '../app/context';

import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {INITIAL_TYPES, WEBCLIENT, IVIEWER, WEBGATEWAY} from '../utils/constants';
import {LABELS_OPACITY_CHANGED} from '../events/events';

@customElement('labels')
@inject(Context, BindingEngine)
export class Labels {

    /**
     * a reference to the image info  (bound in template)
     * @memberof Labels
     * @type {LabelsInfo}
     */
    @bindable labels_info = null;

    /**
     * the list of observers
     * @memberof Info
     * @type {Array.<Object>}
     */
    observers = [];

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
     * @memberof Labels
     */
    bind() {
        console.log('Binding Labels component with labels_info:', this.labels_info);
        // let changeImageConfig = () => {
        //     if (this.labels_info === null) return;

        //     if (this.labels_info.ready) {
        //         console.log('Image info is READY for LABELS:', this.labels_info);
        //         this.onImageConfigChange();
        //         return;
        //     }
        //     // we are not yet ready, wait for ready via observer
        //     if (this.observers.length > 1 &&
        //         typeof this.observers[1] === 'object' &&
        //         this.observers[1] !== null) this.observers.pop().dispose();
        //     ['ready', 'parent_type'].map(
        //         (p) => {
        //             this.observers.push(
        //                 this.bindingEngine.propertyObserver(
        //                     this.labels_info, p).subscribe(
        //                         (newValue, oldValue) => this.onImageConfigChange()));
        //         });
        // };
        
        // listen for changes to labels_info 'zarrSources'
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.labels_info, 'zarrSources').subscribe(
                    (newValue, oldValue) => {
                        console.log('zarrSources CHANGED!:', newValue);
                        // listen to the opacity of each zarr source
                        newValue.map((zarrSource) => {
                            this.observers.push(
                                this.bindingEngine.propertyObserver(
                                    zarrSource, 'opacity').subscribe(
                                        (newOpacity, oldOpacity) => {
                                            console.log(`Opacity for zarr source ${zarrSource.id} changed to:`, newOpacity);
                                            // trigger re-rendering of viewer with new opacity
                                            console.log("Publishing", LABELS_OPACITY_CHANGED, "event for sourceId:", zarrSource.id, " new opacity:", newOpacity, "context:", this.context);
                                            this.context.publish(LABELS_OPACITY_CHANGED, {id: zarrSource.id, opacity: newOpacity});
                                        }));
                        });
                    }));
        // // initial image config
        // changeImageConfig();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Labels
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
     * @memberof Labels
     */
    onImageConfigChange() {
        if (this.labels_info === null) return;
        console.log('Image config changed for LABELS:', this.labels_info);

       
    }
}
