//css and images
require('../../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../css/app.css');
require('../css/images/collapse-left.png');
require('../css/images/collapse-right.png');

// js
import {inject} from 'aurelia-framework';
import Context from './context';
import Misc from '../utils/misc';
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
        this.registerSidebarCollapseHandler();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        $('.left-split div').unbind("mousedown click");
        $('.right-split div').unbind("mousedown click");
        $('.col-splitter').unbind("mousedown mouseup");
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
     * Handles the collapsing of the two side bars (thumbnail + right hand panel)
     *
     * @memberof Index
     */
    registerSidebarCollapseHandler() {

        $('.left-split img, .right-split img').mousedown(
            (e) => {e.preventDefault(); e.stopPropagation();});

        $('.left-split img, .right-split img').click((e) => {
            let leftSplit =
                $(e.currentTarget).parent().hasClass("left-split");
            let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');

            let fullWidth = parseInt(el.css("max-width"));
            let width = el.width();
            let newWidth = width === 0 ? fullWidth : 0;

            let url = Misc.pruneUrlToLastDash($(e.currentTarget).attr("src"));
            $(e.currentTarget).attr(
                "src", url + "/collapse-" +
                (leftSplit && newWidth === 0 ||
                    !leftSplit && newWidth !== 0 ? "right" : "left") + ".png");
            el.width(newWidth);
            if (newWidth === 0)
                $(e.currentTarget).parent().css("cursor", "default");
            else
                $(e.currentTarget).parent().css("cursor", "col-resize");
            if (leftSplit)
                $('.frame').css(
                    {"margin-left": '' + (-newWidth-5) + 'px',
                     "padding-left": '' + (newWidth+10) + 'px'});
            else
                $('.frame').css(
                    {"margin-right": '' + (-newWidth-5) + 'px',
                     "padding-right": '' + (newWidth+15) + 'px'});
        });
    }

    /**
     * Handles the resizing of the two side bars (thumbnail + right hand panel)
     *
     * @memberof Index
     */
    registerSidebarResizeHandler() {

        $('.col-splitter').mousedown((e) => {
            e.preventDefault();
            let leftSplit = $(e.currentTarget).hasClass("left-split");

            $(document).mousemove((e) => {
                e.preventDefault();

                let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');
                if (el.width() === 0) return false;

                let x = leftSplit ? e.pageX - el.offset().left :
                    $(window).width() - e.pageX;
                let frameWidth = $(".frame").width();
                let minWith = leftSplit ? 25 : 50;
                let maxWith = parseInt(el.css("max-width"))
                let rightBound = leftSplit ?
                    ($(window).width() - frameWidth) : $(window).width();

                if (x > minWith && x < maxWith && e.pageX < rightBound) {
                      el.width(x);
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
