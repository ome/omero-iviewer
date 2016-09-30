//css and images
require('../css/images/link.png');
require('../css/images/close.gif');
// js
import {inject,customElement} from 'aurelia-framework';
import Context from './context';
import Misc from '../utils/misc';
import {
    IMAGE_CONFIG_UPDATE,
    IMAGE_VIEWER_SCALEBAR,
    IMAGE_VIEWER_SPLIT_VIEW,
    IMAGE_REGIONS_VISIBILITY,
    VIEWER_IMAGE_SETTINGS,
    EventSubscriber
} from '../events/events';

/**
 * @classdesc
 *
 * the app header
 * @extends EventSubscriber
 */
@customElement('header')
@inject(Context)
export class Header extends EventSubscriber {
    /**
     * events we subscribe to
     * @memberof Header
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Header
     */
    bind() {
        this.subscribe();
    }

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleRegions() {
        this.context.publish(IMAGE_REGIONS_VISIBILITY,
            {visible: this.context.show_regions});
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleScalebar() {
        this.context.publish(IMAGE_VIEWER_SCALEBAR,
            {visible: this.context.show_scalebar});
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof Header
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         if (this.context.getImageConfig(params.config_id) === null) return;
         let image_info =
             this.context.getImageConfig(params.config_id).image_info;

         if (!image_info.has_scalebar) {
             this.context.show_scalebar = false;
             $(".has_scalebar").addClass("disabled-color");
             $(".has_scalebar input").prop('disabled', true);
         } else {
            $(".has_scalebar").removeClass("disabled-color");
            $(".has_scalebar input").prop('disabled', false);
        }
        $(".split_channels").val("normal");
        if (!image_info.tiled &&
                Misc.isArray(image_info.channels) &&
                image_info.channels.length > 1) {
            $(".split_channels").removeClass("disabled-color");
            $(".split_channels").prop('disabled', false);
            $(".split_channels").html("Split Channels");
        } else {
            $(".split_channels").addClass("disabled-color");
            $(".split_channels").prop('disabled', true);
            $(".split_channels").html("Normal");
        }
     }

     /**
      * Displays link to present image (with present settings)
      *
      * @memberof Header
      */
     displayLink() {
         if (this.context.getSelectedImageConfig() === null) return;
         let callback = ((settings) => {
             let url =
                Misc.assembleImageLink(
                    this.context.server,
                    this.context.getSelectedImageConfig().image_info.image_id,
                    settings);
                // show link and register close button
                $('.link-url button').blur();
                let linkDiv = $('.link-url div');
                let linkInput = linkDiv.children('input').get(0);
                linkInput.value = url;
                linkDiv.show();
                linkInput.focus();
                if (linkInput && linkInput.setSelectionRange)
                    linkInput.setSelectionRange(0, linkInput.value.length);
                $('.link-url img').on("click",
                    () => {linkDiv.hide(); $('.link-url img').off("click")});
                linkDiv.show();
         });

         // fetch settings and execute callback once we have them
         this.context.publish(
             VIEWER_IMAGE_SETTINGS,
            {config_id : this.context.selected_config,
             callback :callback});
     }

     /**
      * Toggles the view: split channels or normal
      *
      * @memberof Header
      */
      toggleSplitChannels() {
          let value = $(".split_channels").val();
          if (typeof value === 'string' &&
                (value === 'split' || value === 'normal')) {
               let makeSplit = (value === 'normal');
               $(".split_channels").val(makeSplit ? "split" : "normal");
               $(".split_channels").html(makeSplit ? "Normal" : "Split Channels");
              this.context.publish(
                  IMAGE_VIEWER_SPLIT_VIEW,
                 {config_id : this.context.selected_config, split : makeSplit});
          }
      }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.unsubscribe();
    }
}
