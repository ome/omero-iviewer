
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
import {WEBGATEWAY} from '../utils/constants';
import {LABELS_OPACITY_CHANGED, LABELS_VISIBILITY_CHANGED, LABELS_RDEF_CHANGED} from '../events/events';

@customElement('table_data_layer')
@inject(Context, BindingEngine)
export class TableDataLayer {

    /**
     * a reference to the image info  (bound in template)
     * @memberof TableDataLayer
     * @type {TableDataLayer}
     */
    @bindable table_data_layer = null;

    table_columns = [];

    clauses = [
        {
            column: "",
            operator: "",
            value: ""
        }
    ];

    /**
     * the list of observers
     * @memberof TableDataLayer
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

    async loadTableData(fileId) {
        // /api/annotations/?type=file&image=7215&_=1780499269041
        let url = this.context.server;
            url += this.context.getPrefixedURI(WEBGATEWAY) +
                `/table/${fileId}/metadata/`;
        console.log("Requesting ........... url: ", url);

        let jsonData = await fetch(url).then(response => response.json());
        console.log("TABLES RESPONSE: ", jsonData);
        // each ann is {'id': 123, 'file': {'mimetype': 'OMERO.tables', id: 456, name:"my_table", size: 789}, date: "2026-06-03T15:22:25+01:00", ...}
        // let tables = jsonData.annotations.filter(ann => ann.file?.mimetype === "OMERO.tables");
        // console.log("TABLES: ", tables);
        // return tables;
        return jsonData;
    }

    addClause() {
        this.clauses.push({
            column: "",
            operator: "",
            value: ""
        });
    }

    onSubmit(event) {
        console.log("Submitting table data layer form with table data layer: ", event);
        event.preventDefault();
        // form data
        let formData = new FormData(event.target);
        console.log("Form data: ", formData);
        // get all values for column, operator, value
        let columns = formData.getAll("column");
        let operators = formData.getAll("operator");
        let values = formData.getAll("value");
        console.log("Columns: ", columns);
        console.log("Operators: ", operators);
        console.log("Values: ", values);
    }   

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof TableDataLayer
     */
    bind() {

        // Load OMERO.table metadata...
        if (this.table_data_layer.tableFileId) {
            this.loadTableData(this.table_data_layer.tableFileId).then((tableData) => {
                this.table_columns = tableData.columns;
                this.row_count = tableData.totalCount;
            });
        }

        // Listen for Opacity changes....
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.table_data_layer, 'opacity').subscribe(
                    (newOpacity, oldOpacity) => {
                        this.context.publish(LABELS_OPACITY_CHANGED, {id: this.table_data_layer.id, opacity: newOpacity});
                    }));

    }

    /**
     * Label Color picker and 'Auto' checkbox both call this...
     * @param {*} zarrSourceId 
     */
    requestLabelRerender(layerId) {
        // The UI component binds the color and autoColor, so the data should have changed...
        // We can trigger event with the whole zarrSource
        // let zarrSource = this.labels_info.zarrSources.find(src => src.id === zarrSourceId);
        console.log("TODO...requestLabelRerender", layerId, this.table_data_layer);
        this.context.publish(LABELS_RDEF_CHANGED, this.table_data_layer);
    }




    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof TableDataLayer
     */
    unbind() {
        // get rid of observers
        this.observers.map((o) => {
            if (o) o.dispose();
        });
        this.observers = [];
        this.columns = [];
    }
}
