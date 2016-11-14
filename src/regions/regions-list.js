// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {inject, customElement, bindable} from 'aurelia-framework';
import { REGIONS_SET_PROPERTY, REGIONS_STORED_SHAPES} from '../events/events';

/**
 * Represents the regions list/table in the regions settings/tab
 */
@customElement('regions-list')
@inject(Context)
export default class RegionsList {
    /**
     * a reference to the image config
     * @memberof RegionsList
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

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
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Hide/Shows tegions table
     *
     * @memberof RegionsList
     */
    toggleRegionsTable() {
        if ($('.regions-list').is(':visible')) {
            $('.regions-list').hide();
        } else {
            $('.regions-list').show();
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
     * @param {Object} the th cell that is being resized
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
     * @param {Object} event event object with additional info
     * @memberof RegionsList
     */
    selectShape(id, selected, event) {
        let t = $(event.target);
        if (t.hasClass("shape-show") || t.parent().hasClass("shape-show"))
            return true;

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
     * shape visibility toggler
     *
     * @param {number} id the shape id
     * @param {boolean} visible the visible state
     * @memberof RegionsList
     */
    toggleShapeVisibility(id, visible) {
        this.context.publish(
           REGIONS_SET_PROPERTY, {
               config_id: this.regions_info.image_info.config_id,
               property : "visible",
               shapes : [id], value : visible});
    }
}
