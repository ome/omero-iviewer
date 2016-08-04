import {noView} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {EVENTS} from '../events/events';
import ImageConfig from '../model/image_config';

/**
 * @classdesc
 *
 * This context provides all the information to the application that it shares
 * among its components, in particular it holds ImageConfig instances
 * which represent the data object/model.
 *
 * The individual ImageConfig instances are not 1:1 related to an image so that
 * a kind of multiple document interface is possible, or said differently:
 * the same image can be opened/viewer/interacted with multiple times and
 * potentially independently.
 *
 * The flag that defines if nore than one image can be opened/viewed/interacted with
 * is useMDI.
 */
@noView
export default class Context {
    /**
     * a map for a more convenient key based lookup of an ImageConfig instance
     * @memberof Context
     * @type boolean
     */
    image_configs = new Map();
    /**
     * the key of the presently selected/active ImageConfig
     * this setting gains only importance if useMDI is set to true
     * so that multiple images can be open but only one is active/interacted with
     * @memberof Context
     * @type number
     */
    selected_config = null;
    /**
     * Are we allowed to open/view/interact with more than one image
     * @memberof Context
     * @type boolean
     */
    useMDI = false;

    /**
     * @constructor
     * @param {EventAggregator} eventbus the aurelia event aggregator
     * @param {number} initial_image_id the initial image id
     * @param {string} a server url
     */
    constructor(eventbus = null, initial_image_id=null, server="") {
        if (typeof eventbus instanceof EventAggregator)
            throw "Invalid EventAggregator given!"

        if (typeof server !== 'string' || server.length === 0) {
            server = "";
            console.info("Invalid server value. Using relative paths...");
        }

        this.eventbus = eventbus;
        this.server = server;

        // we set the initial image as the default (if given)
        let initial_image_config = this.addImageConfig(initial_image_id);
        this.selected_config = initial_image_config.id;
    }

    /**
     * Creates and adds an ImageConfig instance by handing it an id of an image
     * stored on the server, as well as making it the selected/active image config.
     *
     * The returned ImageConfig object will have an id set on it by which it
     * can be uniquely identified and retrieved which makes it possible for
     * the same image to be used in multiple ImageConfigs.
     *
     * @memberof Context
     * @param {number} image_id the image id of the server
     * @return {ImageConfig} an ImageConfig object
     */
    addImageConfig(image_id) {
        if (typeof image_id !== 'number' || image_id < 0)
            return null;

        // we do not keep the other configs around unless we are in MDI mode.
        if (!this.useMDI)
            for (let [id, conf] of this.image_configs)
                this.removeImageConfig(id,conf)

        let image_config = new ImageConfig(this, image_id);
        image_config.bind();

        // store the image config in the map and make it the selected one
        this.image_configs.set(image_config.id, image_config);
        this.selectConfig(image_config.id);

        return image_config;
    }

    /**
     * Removes an image config from the internal map.
     * We can hand it either the id or a reference to itself
     *
     * @memberof Context
     * @param {ImageConfig|number} image_config_or_id id or ImageConfig
     */
    removeImageConfig(image_config_or_id) {
        let conf = null;
        if (image_config_or_id instanceof ImageConfig)
            conf = image_config_or_id;
        else if (typeof image_config_or_id === "number")
            conf = this.image_configs.get(image_config_or_id);

        // neither reference nor valid id
        if (!(image_config_or_id instanceof ImageConfig)) return;

        // take out of map
        this.image_configs.delete(conf.id);

        // deselect if we were selected
        let selId = this.getSelectedImageConfig();
        if (selId && selId === conf.id)
            this.selected_config = null;

        // call unbind and wipe reference
        conf.unbind();
        conf = null;
    }

    /**
     * Selects an image config and sends out an event notification
     * This method is really only relevant for MDI mode
     *
     * @memberof Context
     * @param {number} id the ImageConfig id
     */
    selectConfig(id=null) {
        if (typeof id !== 'number' || id < 0 ||
            !(this.image_configs.get(id) instanceof ImageConfig))
            return null;

        this.selected_config = id;

        if (this.useMDI)
            this.publish(
                EVENTS.IMAGE_CONFIG_SELECT,
                { image_config: this.selected_config});
    }

    /**
     * Retrieves an image config given an id. This method will look up existing
     * ImageConfigs in the map and, therefore, not reissue a backend request,
     * unless explicitly told so.
     *
     * @memberof Context
     * @param {number} id the ImageConfig id
     * @return {boolean} forceRequest if true an ajax request is forced to update the data
     */
    getImageConfig(id, forceRequest=false) {
        if (typeof id !== 'number' || id < 0)
            return null;

        // check if we exit
        let image_config = this.image_configs.get(id);
        if (!(image_config instanceof ImageConfig) || image_config === null)
            return null;

        // we are told to request the data from the backend
        if (image_config && forceRequest) image_config.image_info.requestData();

        return image_config;
    }

    /**
     * Returns the active ImageConfig.
     * Unless we operate in MDI mode calling this method is superfluous.
     *
     * @memberof Context
     * @return {ImageConfig|null} returns an ImageConfig or null
     */
    getSelectedImageConfig() {
        if (typeof this.selected_config !== 'number') return null;

        return this.getImageConfig(this.selected_config);
    }

    /**
     * Convenience or short hand way of publishing via the internal eventbus.
     * It will just delegate whatever you hand it as arguments
     *
     * @memberof Context
     */
    publish() {
        this.eventbus.publish.apply(this.eventbus, arguments);
    }
}
