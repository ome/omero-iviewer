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
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {
    REGIONS_SET_PROPERTY, IMAGE_VIEWER_RESIZE, EventSubscriber
} from '../events/events';

/**
 * Represents the regions list/table in the regions settings/tab
 * @extend {EventSubscriber}
 */
@customElement('regions-list')
@inject(Context, BindingEngine)
export default class RegionsList extends EventSubscriber {
    /**
     * a bound reference to regions_info
     * and its associated change handler
     * @memberof RegionsEdit
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;
    regions_infoChanged(newVal, oldVal) {
        this.waitForRegionsInfoReady();
    }

    /**
     * the column showing (only one - mutually exclusive for now)
     * @memberof RegionsList
     * @type {number}
     */
     active_column = 'comments';

     /**
      * selected row (id) for multi-selection with shift
      * @memberof RegionsList
      * @type {string}
      */
      selected_row = '';

    /**
     * the list of property observers
     * @memberof RegionsList
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the regions info ready observers
     * @memberof RegionsList
     * @type {Object}
     */
    regions_ready_observer = null;

    /**
     * events we subscribe to
     * @memberof RegionsList
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_VIEWER_RESIZE,
                    (params={}) => setTimeout(() => this.setHeaderWidth(), 50)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        super(context.eventbus);
        this.context = context;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof RegionsList
     */
    bind() {
        this.waitForRegionsInfoReady();
    }

    /**
     * Makes sure that all regions info data is there
     *
     * @memberof RegionsList
     */
    waitForRegionsInfoReady() {
        if (this.regions_info === null) return;

        let onceReady = () => {
            if (this.regions_info === null) return;
            // register observer
            this.registerObservers();
            // event subscriptions
            this.subscribe();
            setTimeout(() => this.setTableHeight(), 50);
        };

        // tear down old observers
        this.unregisterObservers();
        if (this.regions_info.ready) {
            onceReady();
            return;
        }

        // we are not yet ready, wait for ready via observer
        if (this.regions_ready_observer === null)
            this.regions_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.regions_info, 'ready').subscribe(
                        (newValue, oldValue) => onceReady());
    }

    /**
     * Registers property observers
     *
     * @memberof RegionsList
     */
    registerObservers() {
        this.observers.push(
            this.bindingEngine.collectionObserver(
                this.regions_info.selected_shapes).subscribe(
                    (newValue, oldValue) => this.actUponSelectionChange()));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.regions_info, 'number_of_shapes').subscribe(
                    (newValue, oldValue) =>
                        setTimeout(() => this.setHeaderWidth(), 50)));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.context, 'selected_tab').subscribe(
                    (newValue, oldValue) =>
                        setTimeout(() => this.setTableHeight(), 50)));
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.regions_info, 'visibility_toggles').subscribe(
                    (newValue, oldValue) =>
                        $('#shapes_visibility_toggler').prop(
                            'checked', newValue === 0)));
    }

    /**
     * Unregisters the the observers (property and regions info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof RegionsList
     */
    unregisterObservers(property_only = false) {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
        if (property_only) return;
        if (this.regions_ready_observer) {
            this.regions_ready_observer.dispose();
            this.regions_ready_observer = null;
        }
    }

    /**
     * Scrolls to selected row
     *
     * @memberof RegionsList
     */
     actUponSelectionChange() {
         if (this.regions_info.selected_shapes.length === 0) return;

         let nrOfSelShapes = this.regions_info.selected_shapes.length;
         let idOflastEntry = this.regions_info.selected_shapes[nrOfSelShapes-1];
         let lastSelShape = this.regions_info.getLastSelectedShape();
         if (lastSelShape === null) return;
         let lastCanEdit =
            this.regions_info.checkShapeForPermission(lastSelShape, "canEdit");

         // exception: mixed permissions - don't scroll for canEdit=false
         if (idOflastEntry !== lastSelShape.shape_id && !lastCanEdit) return;

         Ui.scrollContainer(
             'roi-' + lastSelShape.shape_id, '.regions-table',
            $('.regions-header').outerHeight());
     }

    /**
     * Hide/Shows tegions table
     *
     * @memberof RegionsList
     */
    toggleRegionsTable() {
        if ($('.regions-list').is(':visible')) {
            $('.regions-list').hide();
            $('.regions-list-toggler').removeClass('collapse-up');
            $('.regions-list-toggler').addClass('expand-down');
        } else {
            $('.regions-list').show();
            $('.regions-list-toggler').removeClass('expand-down');
            $('.regions-list-toggler').addClass('collapse-up');
        }
    }

    /**
     * Gives the header the row width to avoid scalebar adjustment nonsense
     * @memberof RegionsList
     */
    setHeaderWidth() {
        $('.regions-header').width($('.regions-table-first-row').width());
    }

    /**
     * Sets the table height
     * @memberof RegionsList
     */
    setTableHeight() {
        if (!this.context.isRoisTabActive()) return;

        this.setHeaderWidth();
        $(".regions-table").css(
            'max-height', 'calc(100% - ' +
                ($(".regions-tools").outerHeight() +
                $("#panel-tabs").outerHeight()) + 'px)');
    }

    /**
     * Select shapes handler
     *
     * @param {number} id the shape id
     * @param {boolean} selected the selected state
     * @param {Event} event the browser's event object
     * @param {boolean} is_rois_row is a roi containing shapes
     * @memberof RegionsList
     */
    selectShape(id, selected, event, is_rois_row=false) {
        if (event.target.tagName.toUpperCase() === 'INPUT' ||
            (is_rois_row &&
                (event.target.className.indexOf("roi_id") !== -1 ||
                event.target.parentNode.className.indexOf("roi_id") !== -1)))
                    return true;

        // see if cmd/ctrl or shift was used (for multiselection)
        let cmdKey = Misc.isApple() ? 'metaKey' : 'ctrlKey';
        let ctrl = typeof event[cmdKey] === 'boolean' && event[cmdKey];
        let shift = event.shiftKey;

        // initialize selection params
        id += '';
        let ids = [id];
        let multipleSelection = ctrl;
        let deselect = multipleSelection && selected;

        // rois rows
        let roi_shapes = [];
        let all_shapes_selected = false;
        if (is_rois_row) {
            let roi = this.regions_info.data.get(parseInt(id));
            if (typeof roi === 'object' && roi.shapes instanceof Map) {
                let selectableShapes = 0;
                let selectedShapes = 0;
                roi.shapes.forEach((s) => {
                    if (!(s.is_new && s.deleted)) {
                        selectableShapes++;
                        if (s.selected) selectedShapes++;
                        roi_shapes.push(s.shape_id);
                    }
                });
                all_shapes_selected = (selectedShapes >= selectableShapes);
            }
            if (multipleSelection && all_shapes_selected) deselect = true;
            else deselect = false;
            ids = roi_shapes;
        }

        if (!is_rois_row && this.selected_row.indexOf(':') !== -1 &&
            this.regions_info.selected_shapes.indexOf(
                this.selected_row) === -1) this.selected_row = '';
        if (shift && this.selected_row !== '' &&
            this.selected_row !== id) {
            deselect = false;
            // gather ids by means of row search
            let start = false;
            ids = [];
            let addRoiShapes = (el) => {
                let subId = el.id.substring("roi-".length);
                if (subId.indexOf(":") === -1) {
                    let roi = this.regions_info.data.get(parseInt(subId));
                    if (typeof roi === 'object' && roi.shapes instanceof Map) {
                        roi.shapes.forEach((s) => {
                            if (!(s.is_new && s.deleted)) ids.push(s.shape_id);
                        });
                    }
                } else ids.push(subId);
            }
            $('.regions-table-row').each((idx, el) => {
                if (el && typeof el.id === 'string' &&
                    el.id.indexOf('roi-') === 0) {
                    if ((el.id === 'roi-' + id) ||
                        (el.id === 'roi-' + this.selected_row)) {
                        addRoiShapes(el);
                        if (!start) start = true
                        else return false;
                    } else if (start) addRoiShapes(el);
                }
            });
        } else {
            let selLen = this.regions_info.selected_shapes.length;
            if (!deselect) this.selected_row = id;
            else if (deselect && this.selected_row === id && selLen > 0) {
                    this.selected_row =
                        this.regions_info.selected_shapes[selLen-1];
                    if (this.selected_row === id && selLen > 1)
                        this.selected_row =
                            this.regions_info.selected_shapes[selLen-2];
            }
        }

        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property: 'selected',
               shapes : ids, clear: !multipleSelection,
               value : !deselect, center : !multipleSelection});
    }

    /**
     * Select shapes for roi
     *
     * @param {number} roi_id the roi id
     * @param {Event} event the browser's event object
     * @memberof RegionsList
     */
    selectShapes(roi_id, event) {
        event.stopPropagation();
        if (event.target.className.indexOf("roi_id") !== -1 ||
            event.target.parentNode.className.indexOf("roi_id") !== -1)
                return true;

        let roi = this.regions_info.data.get(roi_id);
        if (typeof roi === 'undefined') return;

        let ids = [];
        roi.shapes.forEach((s) => ids.push(s.shape_id));
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property: 'selected',
               shapes : ids, clear: true, value : true, center : true});
    }

    /**
     * shape visibility toggler
     *
     * @param {number} id the shape id
     * @param {Object} event the mouse event object
     * @memberof RegionsList
     */
    toggleShapeVisibility(id, event) {
        event.stopPropagation();
        event.preventDefault();
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property : "visible",
               shapes : [id], value : event.target.checked});
        return false;
    }

    /**
     * Show/Hide shapes within roi
     *
     * @param {number} roi_id the roi id
     * @param {Event} event the browser's event object
     * @memberof RegionsList
     */
    expandOrCollapseRoi(roi_id, event) {
        event.stopPropagation();

        let roi = this.regions_info.data.get(roi_id);
        if (typeof roi === 'undefined') return;
        roi.show = !roi.show;

        setTimeout(() => this.setHeaderWidth(), 25);
    }

    /**
     * Show/Hide all shapes
     *
     * @param {Object} event the mouse event object
     * @memberof RegionsList
     */
    toggleAllShapesVisibility(event) {
        // IMPORTANT (and enforced through a template show.bind as well):
        // we cannot have the initial state altered, the method of toggle diffs
        // won't work any more.
        event.stopPropagation();
        let show = event.target.checked;
        if (this.regions_info.number_of_shapes === 0) return;
        let ids = [];
        this.regions_info.data.forEach(
            (roi) =>
                roi.shapes.forEach(
                    (shape) => {
                        if (shape.visible !== show &&
                            !(shape.deleted &&
                            typeof shape.is_new === 'boolean' && shape.is_new))
                                ids.push(shape.shape_id);
                    })
        );
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property : "visible",
               shapes : ids, value : show});
    }

    /**
     * Selects column (mutally exclusive for now)
     *
     * @param {string} which the column name
     * @memberof RegionsList
     */
    showColumn(which) {
        if (typeof which !== 'string' || which.length === 0 ||
            which === this.active_column) return;
        this.active_column = which;
    }

    /**
     * Evaluates whether permission(s) are missing for a given shape
     * (Helper method for template only!)
     *
     * @private
     * @param {Object} shape a shape
     * @return {boolean} if true user has full permissions, otherwise not
     * @memberof RegionsList
     */
    hasPermissions(shape) {
        return !(shape && shape.permissions) ||
           (shape.permissions &&
            shape.permissions.canAnnotate &&
            shape.permissions.canEdit &&
            shape.permissions.canDelete);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RegionsList
     */
    unbind() {
        this.unsubscribe();
        this.unregisterObservers();
    }
}
