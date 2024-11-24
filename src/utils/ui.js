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

        // Only support drag-resize on settings panel, not thumbnails
        document.getElementById("col_splitter_right").onpointerdown = (e) => {
            e.preventDefault();
            let leftSplit = $(e.currentTarget).hasClass("left-split");
            let verticalLayout = $(window).width() <= 480;
            console.log("onpointerdown... leftSplit", leftSplit, "verticalLayout", verticalLayout);

            // $(document).mousemove((e) => {
            document.onpointermove = (e) => {
                e.preventDefault();

                let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');
                // mobile layout,. we're dragging vertically
                if (verticalLayout) {
                    let y = leftSplit ? e.pageY : $(window).height() - e.pageY;
                    console.log("y", y);
                    el.css('--panelHeight', y + "px");
                } else {
                    let x = leftSplit ? e.pageX - el.offset().left : $(window).width() - e.pageX;
                    console.log("x", x);
                    el.css('--panelWidth', x + "px");
                }
                eventbus.publish(IMAGE_VIEWER_RESIZE,
                    {config_id: -1, is_dragging: true});
            };

            document.onpointerup = (e) => {
                // $(document).unbind('mousemove');
                // $(document).unbind('mouseup');
                document.onpointermove = null;
                document.getElementById("col_splitter_right").onpointerup = null;
                eventbus.publish(IMAGE_VIEWER_RESIZE,
                    {config_id: -1, is_dragging: false});
            };
        };
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
        $('.collapse-left').unbind("mousedown click");
        $('.collapse-right').unbind("mousedown click");
    }

    /**
     * Binds panel collapse handlers
     *
     * @param {object} context the context for publishing
     * @param {string} uri_prefix a uri prefix for resource requests
     * @static
     */
    static bindCollapseHandlers(context) {
        let self = this;
        $('.collapse-left, .collapse-right').mousedown(
            (e) => {e.preventDefault(); e.stopPropagation();});

        $('.collapse-left, .collapse-right').click((e) => {
            let leftSplit =
                $(e.currentTarget).hasClass("collapse-left");
            self.collapseSidePanel(context.eventbus, leftSplit);
        });

        // collapse depending on context (initial params)
        if (context.collapse_left) {
            self.collapseSidePanel(context.eventbus, true);
        }
        if (context.collapse_right) {
            self.collapseSidePanel(context.eventbus);
        }
    }


    static collapseSidePanel(eventbus, leftSplit) {
            
            let el = leftSplit ? $('.thumbnail-panel') : $('.right-hand-panel');
            let handle = leftSplit ? $('.collapse-left') : $('.collapse-right');

            let width = parseInt(el.css('--panelWidth'));
            let height = parseInt(el.css('--panelHeight'));
            let oldWidth = parseInt(el.attr("old-width") || 0);
            let oldHeight = parseInt(el.attr("old-height") || 0);
            
            // toggle the width/height
            // (regardless of whether the layout is vertical or horizontal)
            let newWidth = width === 0 ? oldWidth : 0;
            let newHeight = height === 0 ? oldHeight : 0;

            // store old sizes to use it when we toggle back
            el.attr("old-width", width);
            el.attr("old-height", height);

            // update css - the appropriate width/height var will be used depending on layout
            el.css('--panelHeight', newHeight + "px");
            el.css('--panelWidth', newWidth + "px");
            // class used to set the collapse-handle icon
            if (leftSplit) {
                if (newHeight > 0) {handle.addClass("arrowsUp");}
                else {handle.removeClass("arrowsUp");}
            } else {
                if (newHeight == 0) {handle.addClass("arrowsUp");}
                else {handle.removeClass("arrowsUp");}
            }
            eventbus.publish(IMAGE_VIEWER_RESIZE, {config_id: -1});
    }

    /**
     * Registers side bar resize and collapse handlers.
     * It's a convenience method for doing both handlers at the same time-slider
     * as well as unbinding beforehand
     *
     * @param {object} context the context for publishing
     * @static
     */
    static registerSidePanelHandlers(context) {
        this.unbindResizeHandlers();
        this.unbindCollapseHandlers();
        this.bindResizeHandlers(context.eventbus);
        this.bindCollapseHandlers(context);
    }

    /**
     * Shows a bootstrap modal message box
     *
     * @param {string} message the title of the dialog
     * @param {string} button_text a button with the given text will be shown
     *                             if a non-empty string is provided
     * @static
     */
    static showModalMessage(message, button_text) {
        if (typeof message !== 'string') message = '';
        if (typeof button_text === 'string')
            button_text = button_text.replace(/\s/g, "")
        else button_text = '';

        let modal = $('.modal-message');
        if (modal.length === 0) return;

        let footer = modal.find('.modal-footer');
        if (button_text) {
            footer.find('button').html(button_text);
            footer.show();
        } else footer.hide();

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
     * @param {boolean} can_close if true we allow closing by esc key and X click
     * @static
     */
     static showConfirmationDialog(
         title='', content='', yes = null, no = null, can_close = true) {
         if (typeof title !== 'string') title = 'Confirmation';
         if (typeof content !== 'string') content = '';
         if (typeof yes !== 'function') yes = null;
         if (typeof no !== 'function') no = null;
         if (typeof can_close !== 'boolean') can_close = true;

         let dialog = $('.confirmation-dialog');
         if (dialog.length === 0) return;

         if (can_close) dialog.find('.modal-header .close').show();
         else dialog.find('.modal-header .close').hide();

         dialog.find('.modal-title').html(title);
         dialog.find('.modal-body').html(content);

         // set up handlers and reset routine on close
         let handlers = [".yes", ".no"];
         handlers.map((h) => {
             dialog.find(h).off();
             dialog.find(h).on('click', () => {
                 dialog.modal("hide");
                 if (h === '.yes' && yes) yes();
                 if (h === '.no' && no) no();
             });
         });

         dialog.modal();
     }

      /**
       * Scrolls a container with a scrollbar in order to
       * put one of its children into the visible part of the container
       * if it cannot be seen already.
       *
       * @param {string} id the id of the child to scroll to
       * @param {string} container the selector for the container element
       * @param {number} header_height optional height of a header
       * @static
       */
      static scrollContainer(id, container, header_height) {
          if (typeof id !== 'string' || typeof container !== 'string') return;

          let el = document.getElementById(id);
          if (el === null) return;

          if (typeof header_height !== 'number' || header_height < 0)
            header_height = 0;
          let contEl = $(container);
          let scrollTop = contEl.scrollTop();
          let scrollBottom = scrollTop + contEl.outerHeight();
          let elTop = el.offsetTop - header_height;
          let elBottom = elTop + el.offsetHeight;
          if (elTop > scrollTop && elBottom < scrollBottom) return;

          let pos =
              elTop - parseInt((contEl.outerHeight() - el.offsetHeight) / 2);
          contEl.scrollTop(pos < 0 ? elTop : pos);
      }

      /**
       * Measures the browser's scrollbar width
       *
       * @static
       */
      static measureScrollbarWidth() {
          let outer = document.createElement("div");
          outer.style.visibility = "hidden";
          outer.style.width = "100px";
          document.body.appendChild(outer);

          let widthNoScroll = outer.offsetWidth;
          outer.style.overflow = "scroll";
          let inner = document.createElement("div");
          inner.style.width = "100%";
          outer.appendChild(inner);
          let widthWithScroll = inner.offsetWidth;
          outer.parentNode.removeChild(outer);

          return widthNoScroll - widthWithScroll;
    }

    /**
     * A helper function to register a list of keyhandlers via the context
     * @param {Context} context a reference to the Context instance
     * @param {Array.<Object>} handler_info array of objects providing key code and handler
     * @param {string} group the group info for registration, default: global
     * @param {Object} scope the scope for the handler function, default: null
     * @static
     */
    static registerKeyHandlers(context, handler_info, group='global', scope=null) {
        handler_info.map(
            (action) =>
                context.addKeyListener(
                    action.key,
                    (event) => {
                        let command =
                            Misc.isApple() ? 'metaKey' : 'ctrlKey';
                            if (context.selected_config === null ||
                                (group !== 'global' &&
                                context.selected_tab !== group) ||
                                ((typeof action.ctrl !== 'boolean' ||
                                  action.ctrl) && !event[command])) return true;
                            try {
                                action.func.apply(scope, action.args);
                            } catch(err) {
                                console.error("Key Handler failed: " + err);
                            }
                            return false;
                }, group, action.ctrl));
    }

    /**
     * Returns the prefix for the full screen api functionality
     * @return {string|null} the prefix or null if no support
     * @static
     */
    static getFullScreenApiPrefix() {
        try {
            let ret = null;

            if (document.body.webkitRequestFullscreen) ret = 'webkit'
            else if (document.body.mozRequestFullScreen) ret = 'moz'
            else if (document.body.msRequestFullscreen) ret = 'ms'
            else if (document.body.requestFullscreen) ret = "";

            // no support
            if (ret === null) return null;

            // now check the corresponding enabled flag
            if (document[ret + 'FullScreenEnabled'] ||
                document[ret + 'FullscreenEnabled']) return ret
        } catch(ignored){}
        return null;
    }
}
