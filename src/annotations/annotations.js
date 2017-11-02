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
import Context from '../app/context';

import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';

@customElement('annotations')
@inject(Context, BindingEngine)
export class Annotations {
    /**
     * a reference to the image annotations  (bound in template)
     * @memberof Annotations
     * @type {ImageAnnotations}
     */
    @bindable image_annotations = null;

    /**
     * listens to image annotations changes
     * @memberof Annotations
     * @type {Object}
     */
    image_annotations_changes = null;

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
     * @memberof Annotations
     */
    bind() {
        if (this.image_annotations === null) return;

        // listen for image annotation changes
        this.image_annotations_changes =
            this.bindingEngine.collectionObserver(
                this.image_annotations.annotations).subscribe(
                    (newValue, oldValue) => {
            // show how observer works by listening to annotations changes
            console.info(newValue);
        });
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Annotations
     */
    unbind() {
        // get rid of observers
        if (this.image_annotations_changes) {
            this.image_annotations_changes.dispose();
        }
    }
}
