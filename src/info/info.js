// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {WEBCLIENT} from '../utils/constants';

import {inject, customElement, bindable} from 'aurelia-framework';

import {
    IMAGE_CONFIG_UPDATE,
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
     * Formatted acquisition date.
     * @memberof Info
     * @type {String}
     */
    acquisition_date = null;

    /**
     * Formatted pixels size.
     * @memberof Info
     * @type {String}
     */
    pixels_size = "";

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
     * Handles changes of the associated ImageConfig
     *
     * @memberof Header
     * @param {Object} params the event notification parameters
     */
    onImageConfigChange(params = {}) {
        let conf = this.context.getImageConfig(params.config_id);

        if (conf === null) return;
        this.image_info = conf.image_info;
        if (typeof this.image_info.image_pixels_size.x == 'number') {
            this.acquisition_date = new Date(this.image_info.image_timestamp * 1000).toISOString().slice(-25, -14);
        } else {
            this.acquisition_date = "-";
        }
        
        if (typeof this.image_info.image_pixels_size === 'object') {
            if (typeof this.image_info.image_pixels_size.x == 'number') {
                this.pixels_size += Number(this.image_info.image_pixels_size.x).toFixed(2);
            } else {
               this.pixels_size += "-";
            }
            this.pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.y == 'number') {
                this.pixels_size += Number(this.image_info.image_pixels_size.y).toFixed(2);
            } else {
                this.pixels_size += "-";
            }
            this.pixels_size += " x ";
            if (typeof this.image_info.image_pixels_size.z == 'number') {
                this.pixels_size += Number(this.image_info.image_pixels_size.z).toFixed(2);
            } else {
                this.pixels_size += "-";
            }
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