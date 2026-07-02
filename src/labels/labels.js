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
import {LABELS_VISIBILITY_CHANGED, LABELS_NEW_LAYERS} from '../events/events';

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
        // init code goes here
    }


    addTableToLabels(zarrSourceId, event) {
        let tableFileId = event.target.value;
        let zarrSource = this.labels_info.zarrSources.find(src => src.id === zarrSourceId);
        console.log("Adding table with file id ", tableFileId, " to labels with zarr source id ", zarrSourceId);
        let tData = zarrSource.tableFiles.find(t => t.id == tableFileId);
        console.log("Found table data: ", tData);
        let newId = Misc.getRandomInteger(0, 100000);
        let color = colors[zarrSource.tableDataLayers.length % colors.length];
        zarrSource.selectedLayerId = newId; // select the newly added layer
        zarrSource.tableDataLayers.push({
            name: tData.name,
            id: newId,
            tableFileId: tableFileId,
            tableFilename: tData.name,
            visible: true,
            opacity: 1.0,
            color: color,
            autoColor: false,
        });
        // Trigger event with all the info we need for new ZarrSource layer...
        let axesNames = zarrSource.axes.map(a => a.name);
        let xAxis = axesNames.indexOf('x');
        let yAxis = axesNames.indexOf('y');
        // expect single tableDataLayers
        let newLayerInfo = {
            id: newId,
            source: zarrSource.source,
            width: zarrSource.shape[xAxis],
            height: zarrSource.shape[yAxis],
            tile_size: {
                width: zarrSource.chunks[xAxis],
                height: zarrSource.chunks[yAxis]
            },
            scales: zarrSource.scales,
            chunks: zarrSource.chunks,
            color: color,
            channelIndex: zarrSource.channelIndex,
        };
        console.log("New layer info to add: ", newLayerInfo);

        this.context.publish(LABELS_NEW_LAYERS, newLayerInfo);

        // set the <select> back to default (placeholder) option
        event.target.value = "";
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
