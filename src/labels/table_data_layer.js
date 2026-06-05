
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

// limit of webgateway/table slice, and other endpoints?
const PAGE_SIZE = 1000000;
@customElement('table_data_layer')
@inject(Context, BindingEngine)
export class TableDataLayer {

    /**
     * a reference to the image info  (bound in template)
     * @memberof TableDataLayer
     * @type {TableDataLayer}
     */
    @bindable table_data_layer = null;

    // Assume for now that the label values are in the first column, but we could make this dynamic in future if needed
    label_values_column_index = 0;

    table_columns = [];
    numeric_columns = [];
    row_count = 0
    label_values = [];
    match_count;

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

    async loadTableColumn(columnIndex) {
        let fileId = this.table_data_layer.tableFileId;
        // if totalCount is > 1000000 we need to page this...
        let startRow = 0;
        let endRow = Math.min(startRow + PAGE_SIZE, this.row_count - 1);
        let colValues = [];
        while (startRow < this.row_count) {
            let url = this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
                `/table/${fileId}/slice/?columns=${this.label_values_column_index}&rows=${startRow}-${endRow}`;
            let pageData = await fetch(url).then(response => response.json());
            colValues = colValues.concat(pageData["columns"][0]);
            startRow = endRow + 1;
            endRow = Math.min(startRow + PAGE_SIZE - 1, this.row_count - 1);
        }
        return colValues;
    }

    async loadTableData(fileId) {
        // /api/annotations/?type=file&image=7215&_=1780499269041
        let url = this.context.server;
            url += this.context.getPrefixedURI(WEBGATEWAY) +
                `/table/${fileId}/metadata/`;
        console.log("Requesting ........... url: ", url);

        let jsonData = await fetch(url).then(response => response.json());
        console.log("TABLES RESPONSE: ", jsonData);
        
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
        // clear previous match count
        this.match_count = undefined;
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

        // Build query to get matching rows indices
        // e.g. use /webgateway/table/15908/rows/?query=(_id>=1)%26(_id<4) to get {"rows": [11,13,14]

        let clause_count = columns.length;
        let claws = [];
        for (let i=0; i<clause_count; i++) {
            if (!columns[i] || !operators[i] || !values[i]) {
                alert("Please fill out all fields for each clause");
                return;
            }
            let part = `(${columns[i]}${operators[i]}${values[i]})`;
            claws.push(part);
        }
        let query = claws.join("&");
        // urlencode the query string
        query = encodeURIComponent(query);
        let url = this.context.server + this.context.getPrefixedURI(WEBGATEWAY) +
            `/table/${this.table_data_layer.tableFileId}/rows/?query=${query}`;
        fetch(url).then(response => response.json()).then(jsonData => {
            let matchingLabelValues = jsonData.rows.map(rowIndex => this.label_values[rowIndex]);
            console.log("Matching label values: ", matchingLabelValues);
            this.match_count = matchingLabelValues.length;
            // Trigger event with the whole tableDataLayer, including the new matching label values
            // this.context.publish(LABELS_RDEF_CHANGED, {...this.table_data_layer, matchingLabelValues});
        });
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
                // Add index to each column for easy reference later
                this.table_columns = tableData.columns.map((col, idx) => ({name: col.name, type: col.type, index: idx, description: col.description}));
                // Filter for numeric columns for now, as these are the only ones we can use for table queries...
                this.numeric_columns = this.table_columns.filter(col => ["LongColumn", "DoubleColumn"].includes(col.type));
                console.log("Numeric columns: ", this.numeric_columns);
                this.row_count = tableData.totalCount;

                // We also want to get the Label pixel values for each row. 
                // If we know the NAME of the Label pixel column, we could use that to pick label_values_column_index
                this.loadTableColumn(this.label_values_column_index).then((colValues) => {
                    this.label_values = colValues;
                });
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
