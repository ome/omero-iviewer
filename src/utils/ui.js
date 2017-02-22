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
                let minWidth = leftSplit ? 25 : 50;
                let maxWidth = parseInt(el.css("max-width"));
                let tolerance =  $(window).width() -
                        (leftSplit ? $('.right-hand-panel').width() :
                            $('.thumbnail-panel').width())-200;
                if (maxWidth > tolerance)
                    maxWidth = tolerance;
                let rightBound = leftSplit ?
                    ($(window).width() - frameWidth) : $(window).width();

                if (x > minWidth && x < maxWidth && e.pageX < rightBound) {
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
                eventbus.publish(IMAGE_VIEWER_RESIZE,
                    {config_id: -1, is_dragging: true, window_resize: false});
            });
        });

        $(document).mouseup((e) => {
            $(document).unbind('mousemove');
            eventbus.publish(IMAGE_VIEWER_RESIZE,
                {config_id: -1, is_dragging: false, window_resize: false});
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
     * @param {object} eventbus the eventbus for publishing
     * @param {string} uri_prefix a uri prefix for resource requests
     * @static
     */
    static bindCollapseHandlers(eventbus, uri_prefix) {
        if (typeof uri_prefix !== 'string') uri_prefix = '';
        $('.left-split img, .right-split img').mousedown(
            (e) => {e.preventDefault(); e.stopPropagation();});

        $('.left-split img, .right-split img').click((e) => {
            let leftSplit =
                $(e.currentTarget).parent().hasClass("left-split");
            let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');

            let minWidth = leftSplit ? 20 : 50;
            let oldWidth = parseInt(el.attr("old-width"));
            let width = el.width();

            let tolerance =  $(window).width() -
                    (leftSplit ? $('.right-hand-panel').width() :
                        $('.thumbnail-panel').width())-200;

            let newWidth = width === 0 ?
                (isNaN(oldWidth) || oldWidth <= 0 ? minWidth : oldWidth) : 0;

            // we do not allow opening sidebars if there is not enough room
            // we try to reduce it to above set minWidth but if that is
            // not good enough, we don't open it
            if (newWidth !== 0 && newWidth > tolerance) {
                if (minWidth > tolerance) return;
                newWidth = tolerance;
            }
            el.attr("old-width", width);

            let url =
                uri_prefix === '' ?
                    Misc.pruneUrlToLastDash($(e.currentTarget).attr("src")) :
                    uri_prefix + "/css/images";
            $(e.currentTarget).attr(
                "src", url + "/collapse-" +
                (leftSplit && newWidth === 0 ||
                    !leftSplit && newWidth !== 0 ? "right" : "left") + ".png");
            el.width(newWidth);
            if (newWidth === 0)
                $(e.currentTarget).parent().css("cursor", "default");
            else
                $(e.currentTarget).parent().css("cursor", "ew-resize");
            if (leftSplit)
                $('.frame').css(
                    {"margin-left": '' + (-newWidth-5) + 'px',
                     "padding-left": '' + (newWidth+10) + 'px'});
            else
                $('.frame').css(
                    {"margin-right": '' + (-newWidth-5) + 'px',
                     "padding-right": '' + (newWidth+15) + 'px'});
            eventbus.publish(IMAGE_VIEWER_RESIZE,
                {config_id: -1, is_dragging: true, window_resize: false});
        });
    }

    /**
     * Registers side bar resize and collapse handlers.
     * It's a convenience method for doing both handlers at the same time-slider
     * as well as unbinding beforehand
     *
     * @param {object} eventbus the eventbus for publishing
     * @param {string} uri_prefix a uri prefix for resource requests
     * @static
     */
    static registerSidePanelHandlers(eventbus, uri_prefix) {
        this.unbindResizeHandlers();
        this.unbindCollapseHandlers();
        this.bindResizeHandlers(eventbus);
        this.bindCollapseHandlers(eventbus, uri_prefix);
    }

    /**
     * Adjusts the sidebars in case of window resize
     *
     * @static
     */
    static adjustSideBarsOnWindowResize() {
        // if we get too small we'll collaps the thumbnail sidebar
        let sideBar = $('.thumbnail-panel');
        let otherSideBar = $('.right-hand-panel');
        let width = sideBar.width();
        let toleranceWidth = 0, origin=null;
        if (width > 0) {
            toleranceWidth = $(window).width() - otherSideBar.width() - 200;
            origin = $('.left-split img');
            if (width > toleranceWidth)
                origin.trigger('click', {currentTarget: origin});
        }
        // if we get even smaller, we'll either resize the right hand panel or
        // collapse it as well
        sideBar = $('.right-hand-panel');
        width = sideBar.width();
        toleranceWidth = $(window).width() - 200;
        origin = $('.right-split img');
        if (width > toleranceWidth) {
            if (toleranceWidth < 50)
                origin.trigger('click', {currentTarget: origin});
            else {
                 $('.right-hand-panel').width(toleranceWidth);
                $('.frame').css(
                    {"margin-right": '' + (-toleranceWidth-5) + 'px',
                     "padding-right": '' + (toleranceWidth+15) + 'px'});
            }
        }
    }

    /**
     * Shows a bootstrap modal message box
     *
     * @param {string} message the title of the dialog
     * @param {boolean} ok_button true will display an ok button, false won't
     * @static
     */
    static showModalMessage(message, ok_button) {
        if (typeof message !== 'string') message = '';
        if (typeof ok_button !== 'boolean') ok_button = false;

        let modal = $('.modal-message');
        if (modal.length === 0) return;

        let footer = modal.find('.modal-footer');
        if (ok_button) footer.show();
        else footer.hide();

        modal.find('.modal-body').html(message);
        modal.modal();
    }

    /**
     * Hides the bootstrap modal message box
     *
     * @static
     */
    static hideModalMessage() {
        let modal = $('.modal-message');
        if (modal.length === 0) return;
        modal.find('.modal-body').html("");
        modal.modal('hide');
    }

    /**
     * Shows a bootstrap modal confirmation dialog
     *
     * @param {string} title the title of the dialog
     * @param {string} content goes into the body of the dialog
     * @param {function} yes a handler that's executed on clicking yes
     * @param {function} no an optional handler that's executed on clicking no
     * @static
     */
     static showConfirmationDialog(title='', content='', yes = null, no = null) {
         if (typeof title !== 'string') title = 'Confirmation';
         if (typeof content !== 'string') content = '';
         if (typeof yes !== 'function') yes = null;
         if (typeof no !== 'function') no = null;

         let dialog = $('.confirmation-dialog');
         if (dialog.length === 0) return;
         dialog.find('.modal-title').html(title);
         dialog.find('.modal-body').html(content);

         // set up handlers and reset routine on close
         dialog.on('hidden.bs.modal', () => Ui.resetConfirmationDialog());
         let handlers = [".yes", ".no"];
         handlers.map((h) => {
             dialog.find(h).on('click', () => {
                 if (h === '.yes' && yes) yes();
                 if (h === '.no' && no) no();
                dialog.modal("hide");
             });
         });

         dialog.modal();
     }

     /**
      * Resets the bootstrap modal confirmation dialog
      *
      * @static
      */
      static resetConfirmationDialog() {
          let dialog = $('.confirmation_dialog');
          if (dialog.length === 0) return;

          dialog.find('.modal-title').html("Confirmation");
          dialog.find('.modal-body').html("");

          dialog.find('.yes').off();
          dialog.find('.no').off();
          dialog.off('hidden.bs.modal');
      }
}
