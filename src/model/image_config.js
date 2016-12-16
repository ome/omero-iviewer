import {noView} from 'aurelia-framework';
import ImageInfo from '../model/image_info';
import RegionsInfo from '../model/regions_info';
import Misc from '../utils/misc';
import {WEBGATEWAY} from '../utils/constants';
import History from './history';

/**
 * Holds the combined data/model that is relevant to working with an image:
 * ImageInfo and RegionsInfo
 */
@noView
export default class ImageConfig extends History {
    /**
     * revision for history
     * @memberof ImageConfig
     * @type {ImageInfo}
     */
    old_revision = 0;

    /**
     * revision for history
     * @memberof ImageConfig
     * @type {number}
     */
    revision = 0;

    /**
     * @memberof ImageConfig
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * @memberof ImageConfig
     * @type {RegionsInfo}
     */
    regions_info = null;

    /**
     * @memberof ImageConfig
     * @type {Map}
     */
    luts = null;

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {number} image_id the image id to be queried
     */
    constructor(context, image_id) {
        super(); // for history
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
        this.requestLookupTables();
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

    /**
     * Returns whether the revisions align or there has been a change
     * @memberof ImageConfig
     * @return {boolean} true if the revisions changed, i.e. if we need to save to history
     */
    hasChanged() {
        return this.old_revision !== this.revision;
    }

    /**
     * Marks a change, i.e. makes revision differ from old revision
     * @memberof ImageConfig
     */
    changed() {
        this.revision++;
    }

    /**
     * Retrieves the lookup tables via ajax
     *
     * @param {function} callback a callback for success
     * @memberof ImageConfig
     */
    requestLookupTables(callback = null) {
        if (this.luts) {
            if (typeof callback === 'function') callback(this.luts);
            return;
        }

        let server = this.image_info.context.server;
        let uri_prefix =  this.image_info.context.getPrefixedURI(WEBGATEWAY);
        $.ajax(
            {url : server + uri_prefix + "/luts/",
            dataType : Misc.useJsonp(server) ? "jsonp" : "json",
            cache : false,
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    !Misc.isArray(response.luts)) return;

                this.luts = new Map();
                let i=0;
                response.luts.map(
                    (l) => {
                        let mapValue =
                            Object.assign({
                                nice_name :
                                    l.name.replace(/.lut/g, "").replace(/_/g, " "),
                                index : i++
                            }, l);
                        this.luts.set(mapValue.name, mapValue);
                    });
                if (typeof callback === 'function') callback(this.luts);
            }
        });
    }

    /**
     * Queries whether a lut by the given name is in our map
     *
     * @param {string} name the lut name
     * @memberof ImageConfig
     */
    hasLookupTable(name) {
        if (this.luts === null || typeof name !== 'string') return false;

        let lut = this.luts.get(name);
        return typeof lut === 'object';
    }
}
