import {noView} from 'aurelia-framework';

import Misc from './misc';
import {IMAGE_VIEWER_RESIZE} from '../events/events';

/**
 * A utility class with various static helper methods for the ui
 */
@noView
export default class Ui {
    /**
     * Binds panel resize handlers
     *
     * @param {object} eventbus the eventbus for publishing
     * @static
     */
    static bindResizeHandlers(eventbus) {
        if (typeof eventbus !== 'object' ||
            typeof eventbus.publish !== 'function') return;

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
            eventbus.publish(IMAGE_VIEWER_RESIZE, {config_id: -1});
        });
    }

    /**
     * Unbinds panel resize handlers
     *
     * @static
     */
    static unbindResizeHandlers() {
        $('.col-splitter').unbind("mousedown mouseup");
    }

    /**
     * Unbinds panel collapse handlers
     *
     * @static
     */
    static unbindCollapseHandlers() {
        $('.left-split img').unbind("mousedown click");
        $('.right-split img').unbind("mousedown click");
    }

    /**
     * Binds panel collapse handlers
     *
     * @static
     */
    static bindCollapseHandlers() {
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
     * Registers side bar resize and collapse handlers.
     * It's a convenience method for doing both handlers at the same time-slider
     * as well as unbinding beforehand
     *
     * @param {object} eventbus the eventbus for publishing
     * @static
     */
    static registerSidePanelHandlers(eventbus) {
        this.unbindResizeHandlers();
        this.unbindCollapseHandlers();
        this.bindResizeHandlers(eventbus);
        this.bindCollapseHandlers();
    }
}
