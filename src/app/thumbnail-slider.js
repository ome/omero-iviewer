// js
import {inject,customElement} from 'aurelia-framework';
import Context from '../app/context';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import {WEBGATEWAY} from '../utils/constants';
import {REGIONS_STORE_SHAPES, REGIONS_STORED_SHAPES} from '../events/events';
import {
    IMAGE_CONFIG_UPDATE, THUMBNAILS_UPDATE, EventSubscriber
} from '../events/events';

/**
 * Displays the image thumbnails
 *
 * @extends {EventSubscriber}
 */
@customElement('thumbnail-slider')
@inject(Context, Element)
export default class ThumbnailSlider extends EventSubscriber {
    /**
     * the present dataset id to see if we need to reissue a request
     * @memberof ThumbnailSlider
     * @type {number}
     */
    dataset_id = null;

    /**
     * a possible gateway prefix for the urls
     * @memberof ThumbnailSlider
     * @type {string}
     */
    gateway_prefix = '';

    /**
     * the list of thumbnails we received from the backend
     * @memberof ThumbnailSlider
     * @type {Array.<Object>}
     */
    thumbnails_response = null;

    /**
     * a list of thumbnails with a url and an id property each
     * @memberof ThumbnailSlider
     * @type {Map}
     */
    thumbnails = new Map();

    /**
     * the default thumbnail length
     * @memberof ThumbnailSlider
     * @type {Array.<Object>}
     */
    thumbnail_length = 80;

    /**
     * the number of thumnails we request in one go
     * @memberof ThumbnailSlider
     * @type {number}
     */
    thumbnails_request_size = 20;

    /**
     * the update handle of the setInterval
     * @memberof ThumbnailSlider
     * @type {number}
     */
    updateHandle = null;

    /**
     * did we send the request for the thumbnail urls of a dataset
     * necessary because the request itself can take longer
     * @memberof ThumbnailSlider
     * @type {boolean}
     */
    requesting_thumbnail_data = false;

    /**
     * our list of events we subscribe to via the EventSubscriber
     * @memberof ThumbnailSlider
     * @type {Map}
     */
    sub_list = [
        [IMAGE_CONFIG_UPDATE,
            (params={}) => this.init(params.dataset_id)],
        [THUMBNAILS_UPDATE,
            (params={}) => this.updateThumbnails(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context, element) {
        super(context.eventbus)
        this.context = context;
        this.element = element;

        this.gateway_prefix = this.context.getPrefixedURI(WEBGATEWAY);
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
        if (this.updateHandle) clearInterval(this.updateHandle);
        this.unsubscribe();
    }

    /**
     * Issues backend request to retrieve thumbnail information
     *
     * @memberof ThumbnailSlider
     * @param {number} dataset_id the dataset id needed for the request
     */
    init(dataset_id) {
        // we don't have a dataset id => hide us
        if (typeof dataset_id !== 'number') {
            this.hideMe();
            return;
        }

        // undo some hiding that might have been done prior
        this.showMe();

        // same id => we don't need to do anything...
        if (dataset_id  === this.dataset_id) return;
        this.dataset_id = dataset_id;

        let url =
            this.context.server + this.gateway_prefix + "/dataset/" +
                dataset_id + '/children/';

        $.ajax(
            {url : url,
            success : (response) => {
                this.requesting_thumbnail_data = false;
                // we want an array
                if (!Misc.isArray(response)) return;

                // empty what has been there
                this.thumbnails.clear();
                this.thumbnails_response = response;
                // add thumnails to the map which will trigger the loading
                this.addThumbnails();
            },
            error : (response) => {
                this.requesting_thumbnail_data = false;
                this.dataset_id = null;
                this.thumbnails_response = null;
                this.hideMe();
            }
        });
        this.requesting_thumbnail_data = true;
    }

    /**
     * Adds thumbnails to then be loaded.
     * We limit ourselves to {@link thumbnails_request_size}.
     *
     * @memberof ThumbnailSlider
     */
    addThumbnails() {
        if (this.thumbnails_response === null ||
            this.thumbnails_response.length === 0) return;

        let toBeLoaded =
            this.thumbnails_response.splice(0, this.thumbnails_request_size);

        toBeLoaded.map((item) => {
            if (typeof item.thumb_url === "string" &&
                   item.thumb_url.length> 0 &&
                   typeof item.id === "number") {
               // for dev/remote server we take out the prefix
               // because the thumb url includes it as well
               let thumbUrl = item.thumb_url;
               if (this.context.server !== "") {
                   let prefixStart = thumbUrl.indexOf(this.gateway_prefix);
                   if (prefixStart > 0)
                       thumbUrl = thumbUrl.substring(prefixStart);
               }
               this.thumbnails.set(
                   item.id,
                   {
                       url: thumbUrl + this.thumbnail_length + "/",
                       title:
                           typeof item.name === 'string' ? item.name : item.id,
                       requested: false,
                       revision : 0
                   });
            }
        });

        return;
    }

    /**
     * Hides thumbnail slider including resize bar
     *
     * @memberof ThumbnailSlider
     */
    hideMe() {
        $(this.element).hide();
        $('.col-splitter.left-split').css('visibility', 'hidden');
        $('.frame').addClass('left-hand-panel-hidden');
    }

    /**
     * Shows thumbnail slider including resize bar
     *
     * @memberof ThumbnailSlider
     */
    showMe() {
        $(this.element).css('visibility', 'visible');
        $('.col-splitter.left-split').css('visibility', 'visible');
        $('.frame').removeClass('left-hand-panel-hidden');
        let w =  $(this.element).width();
        $('.frame').css('margin-left', '' + (-w-5) + 'px');
        $('.frame').css('padding-left', '' + (w+10) + 'px');
    }

    /**
     * A click handler: sets the image id in the main view
     *
     * @memberof ThumbnailSlider
     * @param {number} image_id the image id for the clicked thumbnail
     */
    onClick(image_id) {
        let navigateToNewImage = () => {
            this.context.rememberImageConfigChange(image_id, this.dataset_id);
            this.context.addImageConfig(image_id, this.dataset_id);
        };

        let conf = this.context.getSelectedImageConfig();
        // pop up dialog to ask whether user wants to store rois changes
        // if we have a regions history, we have modifications
        // and are not cross domain
        if (conf && conf.regions_info &&
                conf.regions_info.hasBeenModified() &&
                !Misc.useJsonp(this.context.server)) {
            let saveHandler = () => {
                let tmpSub =
                    this.context.eventbus.subscribe(
                        REGIONS_STORED_SHAPES,
                        (params={}) => {
                            tmpSub.dispose();
                            navigateToNewImage();
                    });
                this.context.publish(
                    REGIONS_STORE_SHAPES,
                    {config_id : conf.id, selected: false, omit_client_update: true});
            };

            UI.showConfirmationDialog(
                'Save ROIS?',
                'You have new/deleted/modified ROI(S).<br>' +
                'Do you want to save your changes?',
                saveHandler, () => navigateToNewImage());
            return;
        } else navigateToNewImage();
    }

    /**
     * Updates one or more thumbnails
     *
     * @memberof ThumbnailSlider
     * @param {Object} params the parameter object received by the event
     */
    updateThumbnails(params = {}) {
        if (typeof params !== 'object' ||
            !Misc.isArray(params.ids)) return;

        let position = 0;
        let accUpdateCount = 0;
        // we update in batches
        this.updateHandle = setInterval(
            () => {
                let error = false;
                // affect reload by raising revision number
                try {
                    let updateCount = 0;
                    while (updateCount < this.thumbnails_request_size &&
                           position < params.ids.length) {
                        let thumb = this.thumbnails.get(params.ids[position]);
                        position++;
                        if (thumb && typeof thumb.revision === 'number') {
                            thumb.revision++;
                            updateCount++;
                        }
                    }
                    accUpdateCount += updateCount;
                } catch(err) {
                    error = true;
                }
                // we are done if we have updated all displayed thumbnails
                // (which need not be all thumbnails that have been updated!)
                // or traversed all thumbnails that need updating
                if (position >= params.ids.length ||
                    accUpdateCount >= this.thumbnails.size || error) {
                    clearInterval(this.updateHandle);
                    return;
                }
            }, 2000);
    }
}
