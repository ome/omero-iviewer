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
import Misc from '../utils/misc';

import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {INITIAL_TYPES, WEBCLIENT, IVIEWER, WEBGATEWAY} from '../utils/constants';
import {LABELS_OPACITY_CHANGED, LABELS_VISIBILITY_CHANGED, LABELS_RDEF_CHANGED} from '../events/events';

let colors = [
    "#ffff00", "#00ff00", "#ff0000", "#ff00ff", "#ffffff",
]
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
        // console.log('Binding Labels component with labels_info:', this.labels_info);
        
        // listen for changes to labels_info 'zarrSources'
        // this.observers.push(
        //     this.bindingEngine.propertyObserver(
        //         this.labels_info, 'zarrSources').subscribe(
        //             (newValue, oldValue) => {
        //                 console.log('zarrSources CHANGED!:', newValue);
        //                 // listen to the opacity of each zarr source
        //                 newValue.map((zarrSource) => {
                            /** change opacity of a zarr labels layer */
                            // this.observers.push(
                            //     this.bindingEngine.propertyObserver(
                            //         zarrSource, 'opacity').subscribe(
                            //             (newOpacity, oldOpacity) => {
                            //                 this.context.publish(LABELS_OPACITY_CHANGED, {id: zarrSource.id, opacity: newOpacity});
                            //             }));
                            // /** change visibility of a zarr labels layer */
                            // this.observers.push(
                            //     this.bindingEngine.propertyObserver(
                            //         zarrSource, 'visible').subscribe(
                            //             (newVisibility, oldVisibility) => {
                            //                 this.context.publish(LABELS_VISIBILITY_CHANGED, {id: zarrSource.id, visibility: newVisibility});
                            //             }));
    //                     });
    //                 }));
    }


    addTableToLabels(zarrSourceId, tableFileId) {
        console.log("Adding table with file id ", tableFileId, " to labels with zarr source id ", zarrSourceId);
        let tData = this.labels_info.omeroTables.find(t => t.file.id == tableFileId);
        console.log("Found table data: ", tData);
        let zarrSource = this.labels_info.zarrSources.find(src => src.id === zarrSourceId);
        let newId = Misc.getRandomInteger(0, 100000);
        zarrSource.selectedLayerId = newId; // select the newly added layer
        zarrSource.tableDataLayers.push({
            name: tData.file.name,
            id: newId,
            tableFileId: tableFileId,
            tableFilename: tData.file.name,
            visible: true,
            opacity: 1.0,
            color: colors[zarrSource.tableDataLayers.length % colors.length],
            autoColor: false,
        });
    }

    handleLayerVisibilityChange(layerId, visibility) {
        this.context.publish(LABELS_VISIBILITY_CHANGED, {id: layerId, visibility: visibility});
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
