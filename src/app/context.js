import {noView} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {EVENTS} from '../events/events';
import ImageConfig from '../model/image_config';

@noView
export default class Context {
    image_configs = new Map();
    selected_config = null;
    show_regions = false;
    useMDI = false;

    constructor(eventbus = null, initial_image_id=null, server="") {
        if (typeof eventbus instanceof EventAggregator)
            throw "Invalid EventAggregator given!"

        if (typeof server !== 'string' || server.length === 0) {
            server = "";
            console.info("Invalid server value. Using relative paths...");
        }

        this.eventbus = eventbus;
        this.server = server;

        let initial_image_config = this.addImageConfig(initial_image_id);
        this.selected_config = initial_image_config.id;
    }

    addImageConfig(image_id) {
        if (typeof image_id !== 'number' || image_id < 0)
            return null;

        if (!this.useMDI)
            for (let [id, conf] of this.image_configs)
                this.removeImageConfig(id, conf)

        let image_config = new ImageConfig(this, image_id);
        image_config.bind();
        this.image_configs.set(image_config.id, image_config);
        this.selectConfig(image_config.id);

        return image_config;
    }

    removeImageConfig(id, conf) {
        conf.unbind();
        conf = null;
        this.image_configs.delete(id);
        if (this.image_configs.size === 0)
            this.selected_config = null;
    }

    selectConfig(id=null) {
        if (typeof id !== 'number' || id < 0)
            return null;

        this.selected_config = id;
        this.publish(EVENTS.SELECTED_CONFIG);
    }

    getImageConfig(id, forceRequest=false) {
        if (typeof id !== 'number' || id < 0)
            return null;

        let image_config = this.image_configs.get(id);
        if (!(image_config instanceof ImageConfig) || image_config === null)
            return null;

        if (image_config && forceRequest) image_config.image_info.requestData();
        return image_config;
    }

    getSelectedImageConfig() {
        if (typeof this.selected_config !== 'number') return null;

        return this.getImageConfig(this.selected_config);
    }

    publish() {
        this.eventbus.publish.apply(this.eventbus, arguments);
    }
}
