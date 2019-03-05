//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

/**
 * Represents the regions planes sub-tab in the right hand panel
 */
@customElement('regions-planes')
@inject(Context, BindingEngine)
export default class RegionsPlanes {
    /**
     * a bound reference to regions_info
     * and its associated change handler
     * @memberof RegionsPlanes
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    @bindable selected_roi_tab = null;

    /**
     * the list of property observers
     * @memberof RegionsPlanes
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * 2D array of [z][t] shapes counts
     */
    plane_shape_counts;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
    }

    requestData() {
        if (typeof refresh !== 'boolean') refresh = false;
        this.ready = false;

        $.ajax({
            url :
                this.context.server + this.context.getPrefixedURI(IVIEWER) +
                "/plane_shape_counts/" + this.regions_info.image_info.image_id + '/',
            success : (response) => {
                console.log('response', response);
            },
            error : (error, textStatus) => {
                if (typeof error.responseText === 'string') {
                    console.error(error.responseText);
                }
            }
        });
    }

     /**
      * Overridden aurelia lifecycle method:
      * called whenever the view is bound within aurelia
      * in other words an 'init' hook that happens before 'attached'
      *
      * @memberof RegionsDrawing
      */
     bind() {
        this.registerObservers();
     }

    /**
     * Registers observers to react to drawing mode & shape_defaults changes
     *
     * @memberof RegionsDrawing
     */
    registerObservers() {
        this.observers.push(
            this.bindingEngine.propertyObserver(this, "selected_roi_tab")
                .subscribe((newValue, oldValue) => {
                    console.log('selected_tab', newValue, oldValue)
                }
            )
        );
    }

    /**
     * Unregisters the the observers (property and regions info ready)
     */
    unregisterObservers() {
        this.observers.forEach((o) => {if (o) o.dispose();});
        this.observers = [];
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     */
    unbind() {
        // this.unsubscribe();
        this.unregisterObservers();
    }
}
