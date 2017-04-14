// js
//css and images
require('../css/images/link.png');
require('../css/images/close.gif');
import Context from '../app/context';
import Misc from '../utils/misc';
import {WEBCLIENT} from '../utils/constants';

import {inject, customElement, bindable} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE,
    IMAGE_VIEWER_SCALEBAR,
    IMAGE_VIEWER_SPLIT_VIEW,
    REGIONS_SET_PROPERTY,
    VIEWER_IMAGE_SETTINGS,
    EventSubscriber
} from '../events/events';


@customElement('info')
@inject(Context)
export class Info extends EventSubscriber {
    /**
     * events we subscribe to
     * @memberof Header
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

	/**
     * which image config do we belong to (bound in template)
     * @memberof Regions
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * a reference to the image info
     * @memberof Info
     * @type {ImageInfo}
     */
    image_info = null;

	/**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Info
     */
    bind() {
        this.subscribe();
    }

/**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleRegions(event) {
        let flag = event.target.checked;
        let selConfig = this.context.getSelectedImageConfig();
        // should we have requested the regions data successfully before
        // let's do it now
        if (flag && selConfig && selConfig.regions_info.data === null)
            selConfig.regions_info.requestData(true);

        if (flag) {
            $('right-hand-panel .nav a[href="#rois"]').tab("show");
        } else {
            $('right-hand-panel .nav a[href="#info"]').tab("show");
        }

        this.context.publish(
            REGIONS_SET_PROPERTY, {property: "visible", value: flag});
    }

    /**
     * Toggles regions visibility
     *
     * @memberof Header
     */
    toggleScalebar(event) {
        this.context.publish(IMAGE_VIEWER_SCALEBAR,
            {visible: event.target.checked});
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof Header
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         let conf = this.context.getImageConfig(params.config_id);

         if (conf === null) return;
         this.image_info = conf.image_info;

         if (!this.image_info.has_scalebar) {
             this.context.show_scalebar = false;
             $(".has_scalebar").addClass("disabled-color");
             $(".has_scalebar input").prop('disabled', true);
         } else {
            $(".has_scalebar").removeClass("disabled-color");
            $(".has_scalebar input").prop('disabled', false);
        }
        $(".split_channels").val(this.image_info.projection);
        if (!this.image_info.tiled &&
                Misc.isArray(this.image_info.channels) &&
                this.image_info.channels.length > 1) {
            $(".split_channels").removeClass("disabled-color");
            $(".split_channels").prop('disabled', false);
            $(".split_channels").html(
                this.image_info.projection === 'split' ? "Normal" :"Split Channels");
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
         let selConf = this.context.getSelectedImageConfig();
         if (selConf === null) return;

         let callback = ((settings) => {
             let url =
                Misc.assembleImageLink(
                    this.context.server,
                    this.context.getPrefixedURI(WEBCLIENT),
                    this.image_info.image_id,
                    settings);
                // let's add the dataset id if we have one
                if (typeof selConf.image_info.dataset_id === 'number')
                    url += "&dataset=" + selConf.image_info.dataset_id;

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
                let ctx = this.context.getSelectedImageConfig();
                if (ctx === null) return;
                $('right-hand-panel .nav a[href="#setting"]').tab("show");
                this.image_info = ctx.image_info;
                let makeSplit = (value === 'normal');
                $(".split_channels").val(makeSplit ? "split" : "normal");
                $(".split_channels").html(makeSplit ? "Normal" : "Split Channels");
                this.image_info.projection = makeSplit ? "split" : "normal";
                if (makeSplit) {
                    this.context.show_regions = false;
                    ctx.regions_info.requestData(true);
                }
                this.context.publish(
                    IMAGE_VIEWER_SPLIT_VIEW,
                        {config_id : ctx.id, split : makeSplit});
          }
      }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Info
     */
    unbind() {
        this.unsubscribe();
    }
}