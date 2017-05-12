//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

// js
import {inject,customElement} from 'aurelia-framework';
import Context from '../app/context';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import {API_PREFIX, WEBCLIENT, WEBGATEWAY} from '../utils/constants';
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
     * the id of the present image showing
     * @memberof ThumbnailSlider
     * @type {number}
     */
    image_showing = null;

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
            (params={}) => this.init(params.dataset_id, params.image_id)],
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
     * @param {number} dataset_id the dataset id used for initialization
     * @param {number} image_id the id of the image in the dataset
     */
    init(dataset_id, image_id) {
        this.image_showing = image_id;
        // we don't have a dataset id => hide us
        if (typeof dataset_id !== 'number' || typeof image_id !== 'number') {
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

        this.gatherThumbnailMetaInfo(image_id);
    }

    /**
     * Initializes thumbnail count and thumbnails_start_index as well as
     * thumbnails_end_index using /webclient/api/paths_to_object
     *
     * @param {number} image_id the id of the image in the dataset
     * @param {boolean} is_top_thumbnail if true image appears first
     * @memberof ThumbnailSlider
     */
    gatherThumbnailMetaInfo(image_id, is_top_thumbnail = false) {
        let webclient_prefix = this.context.getPrefixedURI(WEBCLIENT);
        let url =
            this.context.server + webclient_prefix + "/api/paths_to_object/?" +
            "image=" + image_id + "&page_size=" + this.thumbnails_request_size;

        $.ajax(
            {url : url,
            success : (response) => {
                // we need the paths property
                if (typeof response !== 'object' || response === null ||
                    !Misc.isArray(response.paths) ||
                    response.paths.length === 0) {
                        this.dataset_id = null;
                        this.hideMe();
                        return;
                }

                // find type === dataset
                // dataset has to match the present dataset id
                // to ensure that we handle images in multiple datasets as well
                let path = null;
                for (let i=0; i<response.paths.length; i++) {
                    let p = response.paths[i];
                    for (let j=0; j<p.length; j++)
                        if (typeof p[j].type === 'string' &&
                            p[j].type === 'dataset' &&
                            p[j].id === this.dataset_id) {
                                if (typeof p[j].childCount === 'number')
                                    path = p[j];
                                break;
                        }
                }

                let initialize = (path === null);
                if (path) {
                    // set count, start and end indices (if count > limit)
                    this.thumbnails_count = path.childCount;
                    if (this.thumbnails_count > this.thumbnails_request_size) {
                        this.thumbnails_start_index =
                            is_top_thumbnail ?
                                path.childIndex :
                                    (path.childPage - 1) *
                                        this.thumbnails_request_size;
                    }

                    this.thumbnails_end_index =
                        this.thumbnails_start_index +
                        this.thumbnails_request_size;
                }
                this.requestMoreThumbnails(initialize, initialize, true);
            },
            error : (response) => this.requestMoreThumbnails(true, true)
        });
    }

    /**
     * Requests next batch of thumbnails
     *
     * @param {boolean} init if true we have to perform some init tasks/checks
     * @param {boolean} end if true thumbnails after the end index are requested,
     *                         otherwise before the start index
     * @param {boolean} skip_decrement if true we don't decrement (first fetch)
     * @memberof ThumbnailSlider
     */
    requestMoreThumbnails(init = false, end = true, skip_decrement = false) {
        let offset =
            end ? this.thumbnails_end_index :
                skip_decrement ? this.thumbnails_start_index :
                    this.thumbnails_start_index - this.thumbnails_request_size;
        let limit = this.thumbnails_request_size;
        if (offset < 0) {
            // we want to go beyond the beginning...
            // only request as much as gets us to the very beginning
            limit = this.thumbnails_request_size + offset;
            offset = 0;
        }
        let url =
            this.context.server + this.api_prefix + "/datasets/" +
            this.dataset_id + '/images/?offset=' + offset + '&limit=' + limit;

        $.ajax(
            {url : url,
            success : (response) => {
                this.requesting_thumbnail_data = false;
                if (init) {
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
                this.addThumbnails(response.data, end, skip_decrement);
            },
            error : (response) => {
                this.requesting_thumbnail_data = false;
                this.dataset_id = null;
                if (init) this.hideMe();
            }
        });
    }

    /**
     * Adds thumbnails to then be loaded.
     *
     * @param {Array.<Object>} thumbnails the thumbnails to be added
     * @param {boolean} append if true thumbnails are appended,
     *                         otherwise inserted at the beginning
     * @param {boolean} skip_decrement if true we don't decrement (first fetch)
     * @memberof ThumbnailSlider
     */
    addThumbnails(thumbnails, append = true, skip_decrement = false) {
        // if we are remote we include the server
        let thumbPrefix =
            (this.context.server !== "" ? this.context.server + "/" : "") +
            this.gateway_prefix + "/render_thumbnail/";
        if (!append) thumbnails.reverse();

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
                if (!skip_decrement) this.thumbnails_start_index--;
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
            this.image_showing = image_id;
        };

        let conf = this.context.getSelectedImageConfig();
        // pop up dialog to ask whether user wants to store rois changes
        // if we have a regions history, we have modifications
        // and are not cross domain
        if (conf &&
            conf.regions_info &&
            conf.regions_info.hasBeenModified() &&
            !Misc.useJsonp(this.context.server) &&
            conf.regions_info.image_info.can_annotate) {
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
                    while (position < this.thumbnails.length &&
                           updateCount < this.thumbnails_request_size &&
                           updateCount < params.ids.length) {
                        let thumb = this.thumbnails[position++];
                        let hasBeenLoaded =
                            typeof updatedIds[thumb.id] !== 'undefined';
                        if (!hasBeenLoaded) continue;
                        thumb.revision++;
                        updateCount += 1;
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
