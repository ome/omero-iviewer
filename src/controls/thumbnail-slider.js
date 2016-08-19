import {inject} from 'aurelia-framework';
import {customElement} from 'aurelia-framework';

import Context from '../app/context';
import Misc from '../utils/misc';
import {IMAGE_CONFIG_UPDATE,EventSubscriber} from '../events/events';

/**
 * Displays the image thumbnails
 *
 * @extends {EventSubscriber}
 */
@customElement('thumbnail-slider')
@inject(Context)
export default class ThumbnailSlider extends EventSubscriber {
    /**
     * a list of thumbnails with a url and an id property each
     * @memberof ThumbnailSlider
     * @type {Array.<Object>}
     */
    thumbnails = [];

    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof ThumbnailSlider
     * @type {Map}
     */
    sub_list = [
        [IMAGE_CONFIG_UPDATE,
            (params={}) => this.requestData(params.dataset_id)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus)
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ThumbnailSlider
     */
    bind() {
        this.subscribe();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ThumbnailSlider
     */
    unbind() {
        this.unsubscribe();
    }

    /**
     * Issues backend request to retrieve thumbnail information
     *
     * @memberof ThumbnailSlider
     * @param {number} dataset_id the dataset id needed for the request
     */
    requestData(dataset_id) {
        if (dataset_id == null) return;

        let url =
            this.context.server +
            "/webgateway/dataset/" + dataset_id + '/children/';

        $.ajax(
            {url : url,
            dataType : "jsonp",
            success : (response) => {
                // we want an array
                if (!Misc.isArray(response)) return;

                // empty what has been there
                this.thumbnails = [];
                 // traverse results and store them internally
                 response.map((item) => {
                     if (typeof item.thumb_url === "string" &&
                            item.thumb_url.length> 0 &&
                            typeof item.id === "number")
                        this.thumbnails.push(
                            {id : item.id, url : item.thumb_url});
                 });
            }
        });

    }

    /**
     * A click handler: sets the image id in the main view
     *
     * @memberof ThumbnailSlider
     * @param {number} image_id the image id for the clicked thumbnail
     */
    onClick(image_id) {
        this.context.addImageConfig(image_id);
    }
}
