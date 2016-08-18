//css
require('../../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../css/app.css');

// js
import {inject} from 'aurelia-framework';
import Context from './context';
import {IMAGE_VIEWER_RESIZE,IMAGE_REGIONS_VISIBILITY} from '../events/events';

/**
 * @classdesc
 *
 * The index view/page so to speak
 */
@inject(Context)
export class Index  {

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Index
     */
    attached() {
        window.onresize =
        () => this.context.publish(IMAGE_VIEWER_RESIZE, {config_id: -1});
        this.registerSidebarResizeHandler();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        $('.col-splitter').unbind("mousedown");
        window.onresize = null;
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Index
     */
    toggleRegions() {
        let val = $("#toggle_regions").prop("checked");

        for (let [id,conf] of this.context.image_configs)
            conf.show_regions = val;

        this.context.publish(IMAGE_REGIONS_VISIBILITY, {visible: val});
    }

    /**
     * Handles the resizing of the two side bars (thumbnail + right)
     *
     * @memberof Index
     */
    registerSidebarResizeHandler() {
        $('.col-splitter').mousedown((e) => {
            e.preventDefault();
            var leftSplit = $(e.currentTarget).hasClass("left-split");

            $(document).mousemove((e) => {
                e.preventDefault();

                let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');
                let x = leftSplit ? e.pageX - el.offset().left :
                    $(window).width() - e.pageX;
                let frameWidth = $(".frame").width();
                let maxWith = parseInt(el.css("max-width"))
                let rightBound = leftSplit ?
                    ($(window).width() - frameWidth) : $(window).width();

                if (x > 0 && x < maxWith && e.pageX < rightBound) {
                      el.css("width", x);
                      if (leftSplit)
                          $('.frame').css(
                              {"margin-left": '' + (-x-5) + 'px',
                               "padding-left": '' + (x+10) + 'px'});
                      else
                          $('.frame').css(
                              {"margin-right": '' + (-x-5) + 'px',
                               "padding-right": '' + (x+15) + 'px'});
                }
            });
        });

        $(document).mouseup((e) => {
            $(document).unbind('mousemove');
            this.context.publish(IMAGE_VIEWER_RESIZE, {config_id: -1});
        });
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Index
     */
    unbind() {
        this.context = null;
    }
}
