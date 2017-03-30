// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {
    EventSubscriber,
    REGIONS_SET_PROPERTY, REGIONS_STORED_SHAPES, REGIONS_PROPERTY_CHANGED
} from '../events/events';

/**
 * Represents the regions list/table in the regions settings/tab
 */
@customElement('regions-list')
@inject(Context, BindingEngine)
export default class RegionsList extends EventSubscriber {
    /**
     * a reference to the image config
     * @memberof RegionsList
     * @type {RegionsList}
     */
    @bindable regions_info = null;

    /**
     * events we subscribe to
     * @memberof RegionsList
     * @type {Array.<string,function>}
     */
    sub_list = [[REGIONS_PROPERTY_CHANGED,
                (params={}) => this.actUponSelectionChange(params)]];

    /**
     * a flag for the regions list interaction
     * @memberof RegionsList
     * @type {boolean}
     */
    is_dragging = false;

    /**
     * the start position for regions list interaction
     * @memberof RegionsList
     * @type {number}
     */
    dragging_start = null;

    /**
     * @memberof RegionsList
     * @type {boolean}
     */
    initial_load = true;

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
        this.subscribe();
        this.registerObserver();
    }

    /**
     * Registers observers to watch whether we are in drawing mode or not
     *
     * @memberof RegionsList
     */
    registerObserver() {
        this.unregisterObserver();

        let createObserver = () => {
            this.observer = this.bindingEngine.propertyObserver(
                this.regions_info, 'shape_to_be_drawn').subscribe(
                    (newValue, oldValue) => {
                        if (newValue === null) {
                            $(".regions-table").removeClass("disabled-color");
                            $(".regions-table").prop("disabled", false);
                        } else {
                            $(".regions-table").addClass("disabled-color");
                            $(".regions-table").prop("disabled", true);
                        }
            });
        };

        if (this.regions_info === null) {
            this.observer =
                this.bindingEngine.propertyObserver(this, 'regions_info')
                    .subscribe((newValue, oldValue) => {
                        if (oldValue === null && newValue) {
                            this.observer.dispose();
                            createObserver();
                        }
                });
        } else createObserver();
    }

    /**
     * Unregisters observer
     *
     * @memberof RegionsList
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
    }

    /**
     * Generates shape for both, pasting and propagation
     *
     * @param {Object} params the event notification parameters
     * @memberof RegionsList
     */
     actUponSelectionChange(params = {}) {
         //we want only notifications that concern us
         // and select=true notifications with at least one shape
         let imgConf = this.context.getSelectedImageConfig();
         if (imgConf === null || imgConf.id !== params.config_id ||
             typeof params.properties !== 'string' ||
             params.properties !== 'selected' ||
             !Misc.isArray(params.shapes) || params.shapes.length === 0 ||
             typeof params.values !== 'boolean' || !params.values) return;

         let id = params.shapes[0];
         let el = document.getElementById('roi-' + id);
         let regTable = $('.regions-table');
         let scrollTop = regTable.scrollTop();
         let scrollBottom = scrollTop + regTable.outerHeight();
         let elTop = el.offsetTop;
         let elBottom = elTop + el.offsetHeight;
         if (elTop > scrollTop && elBottom < scrollBottom) return;

         let scroll = () => regTable.scrollTop(el.offsetTop);
         setTimeout(scroll,
             el.className.indexOf("aurelia-hide") !== -1 ? 100 : 0);
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
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RegionsList
     */
    attached() {
        // this keeps the header aligned with the table on horizontal scroll
        $(".regions-table").on("scroll", (e) => {
                $('.regions-header').css(
                    "margin-left", "-" +
                     e.currentTarget.scrollLeft + "px");
        });
        // the hover detects the border and enables the column resize handling
        // as well as changes the cursor symbol
        $('.regions-header th').hover((e) => {
            let cell = $(e.target);

            let index = null;
            try {
                index =
                    cell.prop("tagName").toLowerCase() === 'th' ?
                        cell.attr("id").substring("reg-col-".length) :
                        cell.parent().attr("id").substring("reg-col-".length);
            } catch(noindex) {
                index = -1;
            }
            var border = parseInt(cell.css('border-top-width'));
            if (isNaN(border)) return;

            // we allow right hand border dragging
            if(!this.is_dragging &&
                e.offsetX > 0 &&
                e.offsetX <= border &&
                e.offsetY > 0 &&
                e.offsetY < cell.outerHeight()) {
                    if (index > 0) {
                        cell.css("cursor", "col-resize");
                        cell = $("#reg-col-" + (index-1));
                        this.enableColumnResize(cell);
                    }
            } else if(!this.is_dragging &&
                e.offsetX >= cell.innerWidth() &&
                e.offsetX <= cell.outerWidth() &&
                e.offsetY > 0 &&
                e.offsetY < cell.outerHeight()) {
                    cell.css("cursor", "col-resize");
                    this.enableColumnResize(cell);
             } else cell.css("cursor", "default");
        });
        this.adjustColumnWidths();
    }

    /**
     * Establishes and tears down the handlers for column resize
     *
     * @param {Object} cell the cell that is being resized
     * @memberof RegionsList
     */
    enableColumnResize(cell) {
        // we need a mouse-down to start dragging
        cell.mousedown((e) => {
            e.preventDefault();
            cell.unbind('mousedown');

            this.is_dragging = true;
            this.dragging_start = e.pageX;

            // we need a mouse-move while dragging
            $(".regions-header").mousemove((e) => {
                e.preventDefault();

                let delta = e.pageX - this.dragging_start;
                let minWidth = parseInt(cell.css("min-width"));
                let newWidth = cell.width() + delta;
                // each column has a minimum width and won't go below
                if (isNaN(minWidth) ||
                        newWidth < minWidth) {
                    this.is_dragging = false;
                    return;
                }

                // remember new start and set column widh
                this.dragging_start = e.pageX;
                let clazz = "." + cell.attr("class");
                $(clazz).width(newWidth);
                $(clazz + " *").width(newWidth);
            });
        });

        // the mouse-up event determines the end of the dragging action
        $(".regions-list").on(
            'mouseup',(e) => {
                // reset states and unbind handlers
                this.is_dragging = false;
                this.dragging_start = null;
                cell.css("cursor", "default");
                $(".regions-header").unbind('mousemove');
                $(".regions-list").unbind('mouseup');
                this.adjustColumnWidths();
        });
    }

    /**
     * Adjusts the combined column width after individual colum resizing
     * we add some more so that we have room for dragging
     *
     * @memberof RegionsList
     */
    adjustColumnWidths() {
        let combinedWidth = 0;
        let hits = $(".regions-header th");

        // we have to go through all header columns
        for (let i=0;i<hits.length;i++){
            let outW = parseInt($(hits[i]).outerWidth());
            let border = parseInt($(hits[i]).css("border-left-width"));
            if (!isNaN(outW) && !isNaN(border))
                combinedWidth += (outW + border);

        };

        if (combinedWidth !== 0) {
            combinedWidth += 100;
            $(".regions-header tr, .regions-table tr").width(combinedWidth);
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof RegionsList
     */
    detached() {
        $(".regions-table").off("scroll");
    }

    /**
     * Select shapes handler
     *
     * @param {number} id the shape id
     * @param {boolean} selected the selected state
     * @param {Event} event the browser's event object
     * @memberof RegionsList
     */
    selectShape(id, selected, event) {
        if (event.target.tagName.toUpperCase() === 'INPUT') return true;
        let multipleSelection =
            typeof event.ctrlKey === 'boolean' && event.ctrlKey;
        let deselect = multipleSelection && selected;

        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property: 'selected',
               shapes : [id], clear: !multipleSelection,
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
        if (event.target.className.indexOf("roi_id") !== -1 ||
            event.target.parentNode.className.indexOf("roi_id") !== -1 )
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
     * @param {boolean} visible the visible state
     * @param {Event} event the browser's event object
     * @memberof RegionsList
     */
    toggleShapeVisibility(id, visible, event) {
        event.stopPropagation();
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property : "visible",
               shapes : [id], value : visible});
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
    }

    /*
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RegionsList
     */
    unbind() {
        this.unsubscribe();
        this.unregisterObserver();
    }
}
