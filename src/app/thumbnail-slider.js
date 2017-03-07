// js
import {inject,customElement} from 'aurelia-framework';
import Context from '../app/context';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import {API_PREFIX, WEBGATEWAY} from '../utils/constants';
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
     * the api prefix for requests
     * @memberof ThumbnailSlider
     * @type {string}
     */
    api_prefix = '';

    /**
     * a possible gateway prefix for the urls
     * @memberof ThumbnailSlider
     * @type {string}
     */
    gateway_prefix = '';

    /**
     * a list of thumbnails objects with a url and an id property each
     * @memberof ThumbnailSlider
     * @type {Array}
     */
    thumbnails = [];

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
    thumbnails_request_size = 10;

    /**
     * the start index of the displayed thumbnails
     * @memberof ThumbnailSlider
     * @type {number}
     */
    thumbnails_start_index = 0;

    /**
     * the end index of the displayed thumbnails
     * @memberof ThumbnailSlider
     * @type {number}
     */
    thumbnails_end_index = 0;

    /**
     * the total number of thumbnails
     * @memberof ThumbnailSlider
     * @type {number}
     */
    thumbnails_count = 0;

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

        this.api_prefix = this.context.getPrefixedURI(API_PREFIX);
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

        this.requesting_thumbnail_data = true;
        this.thumbnails = [];

        // TODO: use path_to_object to get initial index for image in dataset
        // request first batch of thumbnails
        this.requestMoreThumbnails(true, true);
    }

    /**
     * Requests next batch of thumbnails
     *
     * @param {boolean} first_fetch true if it is the inital batch request
     * @param {boolean} end if true thumbnails after the end index are requested,
     *                         otherwise before the start index
     * @memberof ThumbnailSlider
     */
    requestMoreThumbnails(first_fetch = false, end = true) {
        let url =
            this.context.server + this.api_prefix + "/datasets/" +
            this.dataset_id + '/images/?offset=' +
            (end ? this.thumbnails_end_index : this.thumbnails_start_index) +
            '&limit=' + this.thumbnails_request_size;

        $.ajax(
            {url : url,
            success : (response) => {
                this.requesting_thumbnail_data = false;
                if (first_fetch) {
                    // we want the total count
                    if (typeof response !== 'object' || response === null ||
                        typeof response.meta !== 'object' ||
                        response.meta === null) {
                            this.dataset_id = null;
                            this.hideMe();
                            return;
                        }
                    this.thumbnails_count =
                        typeof response.meta.totalCount === 'number' ?
                            response.meta.totalCount : 0;
                }

                // return if count is null or
                // if data array is not present/zero length
                if (this.thumbnails_count === 0 ||
                    !Misc.isArray(response.data) ||
                    response.data.length === 0) return;

                // add thumnails to the map which will trigger the loading
                this.addThumbnails(response.data, end);
            },
            error : (response) => {
                this.requesting_thumbnail_data = false;
                this.dataset_id = null;
                if (first_fetch) this.hideMe();
            }
        });
    }

    /**
     * Adds thumbnails to then be loaded.
     *
     * @param {Array.<Object>} thumbnails the thumbnails to be added
     * @param {boolean} append if true thumbnails are appended,
     *                         otherwise inserted at the beginning
     * @memberof ThumbnailSlider
     */
    addThumbnails(thumbnails, append = true) {
        // if we are remote we include the server
        let thumbPrefix =
            (this.context.server !== "" ? this.context.server + "/" : "") +
            this.gateway_prefix + "/render_thumbnail/";

        thumbnails.map((item) => {
            let id = item['@id'];
            let entry = {
                id: id,
                url: thumbPrefix + id + "/" + this.thumbnail_length + "/",
                title: typeof item.Name === 'string' ? item.Name : id,
                revision : 0
            }
            if (append) {
                this.thumbnails.push(entry);
                this.thumbnails_end_index++;
            } else {
                this.thumbnails.unshift(entry);
                this.thumbnails_start_index--;
            }
        });
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
        $('.frame').css('margin-left', '');
        $('.frame').css('padding-left', '');
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
            !Misc.isArray(params.ids) && params.ids.length > 0) return;

        // turn array into object for easier lookup
        let updatedIds = {};
        params.ids.map((id) => updatedIds[id] = null);

        let position = 0;
        // we update in batches
        this.updateHandle = setInterval(
            () => {
                let error = false;
                // affect reload by raising revision number
                try {
                    let updateCount = 0;
                    for (;position<this.thumbnails.length;position++) {
                        let thumb = this.thumbnails[position];
                        let hasBeenLoaded =
                            typeof updatedIds[thumb.id] !== 'undefined';
                        if (!hasBeenLoaded) continue;
                        thumb.revision++;
                        updateCount += 1;
                        if (updateCount >= this.thumbnails_request_size ||
                            updateCount >= params.ids.length) break;
                    }
                } catch(err) {
                    error = true;
                }
                // we are done if we have updated all displayed thumbnails
                if (position >= this.thumbnails.length || error) {
                    clearInterval(this.updateHandle);
                    return;
                }
            }, 2000);
    }
}
