import {noView} from 'aurelia-framework';
import ImageInfo from '../model/image_info';
import RegionsInfo from '../model/regions_info';

/**
 * Holds the combined data/model that is relevant to working with an image:
 * ImageInfo and RegionsInfo
 */
@noView
export default class ImageConfig {
    /**
     * @memberof ImageConfig
     * @type ImageInfo
     */
    image_info = null;
    /**
     * @memberof ImageConfig
     * @type RegionsInfo
     */
    regions_info = null;
    /**
     * @memberof ImageConfig
     * @type boolean
     */
    show_regions = false;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} image_id the image id to be queried
     */
    constructor(context, image_id) {
        // for now this should suffice, especially given js 1 threaded nature
        this.id = new Date().getTime();
        // go create the data objects for an image and its associated region
        this.image_info = new ImageInfo(context, this.id, image_id);
        this.regions_info = new RegionsInfo(this.image_info)
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method bind for initialization purposes
     *
     * @memberof ImageConfig
     */
    bind() {
        this.image_info.bind();
        this.regions_info.bind();
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof ImageConfig
     */
    unbind() {
        this.image_info.unbind();
        this.regions_info.unbind();
    }
}
