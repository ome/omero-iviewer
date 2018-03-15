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
import {inject,customElement, BindingEngine} from 'aurelia-framework';
import Context from '../app/context';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import {
    DATASETS_REQUEST_URL, INITIAL_TYPES, IVIEWER,
    WEB_API_BASE, WEBCLIENT, WEBGATEWAY
} from '../utils/constants';
import {REGIONS_STORE_SHAPES, REGIONS_STORED_SHAPES} from '../events/events';
import {THUMBNAILS_UPDATE, EventSubscriber} from '../events/events';

/**
 * Displays the image thumbnails
 *
 * @extends {EventSubscriber}
 */
@customElement('thumbnail-slider')
@inject(Context, Element, BindingEngine)
export default class ThumbnailSlider extends EventSubscriber {
    /**
     * have we been initialized
     * @memberof ThumbnailSlider
     * @type {boolean}
     */
     initialized = false;

     /**
      * click set timeout handle
      * @memberof ThumbnailSlider
      * @type {number}
      */
      click_handle = null;

    /**
     * a reference to the selected image config
     * @memberof ThumbnailSlider
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * the web api base url for requests
     * @memberof ThumbnailSlider
     * @type {string}
     */
    web_api_base = '';

    /**
     * a possible gateway prefix for the urls
     * @memberof ThumbnailSlider
     * @type {string}
     */
    gateway_prefix = '';

    /**
     * observer watching for changes in the selected image
     * @memberof ThumbnailSlider
     * @type {Object}
     */
    selected_image_observer = null;

    /**
     * observer watching for when the image info data is ready
     * @memberof ThumbnailSlider
     * @type {Object}
     */
    image_info_ready_observer = null;

    /**
     * a list of thumbnails objects with a url and an id property each
     * @memberof ThumbnailSlider
     * @type {Array}
     */
    thumbnails = [];

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
    sub_list = [[THUMBNAILS_UPDATE,
                    (params={}) => this.updateThumbnails(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, element, bindingEngine) {
        super(context.eventbus)
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;

        // get webgateway prefix and web api base
        this.web_api_base = this.context.getPrefixedURI(WEB_API_BASE);
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
        // initial image config
        this.onImageConfigChange();
        // register observer for selected image configs and event subscriptions
        this.selected_image_observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config').subscribe(
                    (newValue, oldValue) => this.onImageConfigChange());
        this.subscribe();
    }

    /**
     * Triggered for initialization of thumnnail panel (once only)
     * as well as setting image config reference every time the selected image
     * changes
     *
     * @memberof ThumbnailSlider
     */
    onImageConfigChange() {
        // swap out selected image config
        this.image_config = this.context.getSelectedImageConfig();

        if (this.initialized) {
            if (this.image_config === null) return;
            // scroll to image thumb
            UI.scrollContainer(
                'img-thumb-' + this.image_config.image_info.image_id,
                '.thumbnail-panel');
            // no need to initialize twice
            return;
        }

        if (this.context.initial_type === INITIAL_TYPES.NONE) {
            this.hideMe();
            setTimeout(() =>
                UI.showModalMessage(
                    'Viewer opened without image, dataset or well id!','OK'),
            100);
            return;
        }

        // ready handler
        let imageInfoReady = () => {
            this.initializeThumbnails();
            this.unregisterObservers(true);
        };

        // we don't have a dataset id
        if (this.context.initial_type === INITIAL_TYPES.IMAGES &&
            this.context.initial_ids.length === 1 &&
            this.image_config.image_info.parent_id !== 'number') {
            // have we had all the data already
            if (this.image_config.image_info.ready) {
                // too bad, no dataset id
                this.initialized = true;
                this.hideMe();
                return;
            };
            // wait until we have all the data to check again for the dataset id
            this.image_info_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.image_config.image_info, 'ready').subscribe(
                        (newValue, oldValue) => imageInfoReady());
        } else imageInfoReady();
    }

    /**
     * Unregisters the the observers (image selection and image data ready)
     *
     * @param {boolean} ready_only true if only the image data ready observer is cleaned up
     * @memberof ThumbnailSlider
     */
    unregisterObservers(ready_only = false) {
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
        if (ready_only) return;
        if (this.selected_image_observer) {
            this.selected_image_observer.dispose();
            this.selected_image_observer = null;
        }
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
        this.unregisterObservers();
    }

    /**
     * Initializes thumbnail data depending on what initial type we are
     *
     * @param {boolean} refresh true if the user hit the refresh icon
     * @memberof ThumbnailSlider
     */
    initializeThumbnails(refresh = false) {
        // standard case: we are an image
        if (this.context.initial_type === INITIAL_TYPES.IMAGES) {
            if (this.context.initial_ids.length > 1) {
                // we are a list of images
                this.thumbnails_count = this.context.initial_ids.length;
                this.requestMoreThumbnails();
            } else {
                this.gatherThumbnailMetaInfo(
                        this.image_config.image_info.image_id);
            }
        } else if (this.context.initial_type === INITIAL_TYPES.DATASET ||
                    this.context.initial_type === INITIAL_TYPES.WELL) {
            this.requestMoreThumbnails(true, true, true, refresh);
        }
        this.initialized = true;
    }

    /**
     * Initializes thumbnail count and thumbnails_start_index as well as
     * thumbnails_end_index using /webclient/api/paths_to_object
     * For opening images that have no parent information from somewhere else
     * (e.g. open with) or for images whose parent is a well this method finds
     * the parent id
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
                        if (typeof this.image_config.image_info.parent_id === 'number' &&
                            !isNaN(this.image_config.image_info.parent_id) &&
                            this.image_config.image_info.parent_id > 0) {
                                this.requestMoreThumbnails(true, true, true);
                        } else this.hideMe();
                        return;
                }

                // find type === dataset or type === well
                // dataset has to match the present dataset id
                // to ensure that we handle images in multiple datasets as well
                let path = null;
                let imgInf = this.image_config.image_info;
                for (let i=0; i<response.paths.length; i++) {
                    let p = response.paths[i];
                    for (let j=0; j<p.length; j++)
                        if (typeof p[j].type === 'string' &&
                            p[j].type === 'dataset' &&
                            p[j].id === this.image_config.image_info.parent_id) {
                                if (typeof p[j].childCount === 'number')
                                    path = p[j];
                                imgInf.parent_type = INITIAL_TYPES.DATASET;
                                break;
                        } else if (typeof p[j].type === 'string' &&
                                    p[j].type === 'well') {
                                        imgInf.parent_type = INITIAL_TYPES.WELL;
                                        imgInf.parent_id = p[j].id;
                                        break;
                        }
                }

                if (imgInf.parent_id === null) {
                    this.hideMe();
                    return;
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
     * @param {boolean} refresh true if the user hit the refresh icon
     * @memberof ThumbnailSlider
     */
    requestMoreThumbnails(
        init = false, end = true, skip_decrement = false, refresh = false) {
        if (this.context.initial_type === INITIAL_TYPES.IMAGES &&
            this.context.initial_ids.length > 1) {
            let until =
                this.thumbnails_end_index + this.thumbnails_request_size;
            if (until > this.thumbnails_count) until = this.thumbnails_count;
            let thumbPrefix =
                (this.context.server !== "" ?
                    this.context.server + "/" : "") +
                this.gateway_prefix + "/render_thumbnail/";
            for (let x=this.thumbnails_end_index;x<until;x++) {
                let id = this.context.initial_ids[x];
                this.thumbnails.push({
                    id: id,
                    url: thumbPrefix + id + "/",
                    title: id,
                    revision : 0
                });
                this.thumbnails_end_index++;
            };
            return;
        }
        let parent_id =
            this.context.initial_type === INITIAL_TYPES.DATASET ||
            this.context.initial_type === INITIAL_TYPES.WELL ?
                this.context.initial_ids[0] :
                this.image_config.image_info.parent_id;
        let parent_type =
            this.context.initial_type === INITIAL_TYPES.IMAGES ?
                this.image_config.image_info.parent_type :
                this.context.initial_type;

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

        let url = this.context.server;
        if (this.context.initial_type === INITIAL_TYPES.DATASET ||
            (this.context.initial_type === INITIAL_TYPES.IMAGES &&
            parent_type === INITIAL_TYPES.DATASET)) {
                url += this.web_api_base + DATASETS_REQUEST_URL +
                    '/' + parent_id + '/images/?';
        } else if (this.context.initial_type === INITIAL_TYPES.WELL ||
                    (this.context.initial_type === INITIAL_TYPES.IMAGES &&
                    parent_type === INITIAL_TYPES.WELL)) {
                        url += this.context.getPrefixedURI(IVIEWER) +
                            "/well_images/?id=" + parent_id + "&";
        }
        url += 'offset=' + offset + '&limit=' + limit;

        $.ajax(
            {url : url,
            success : (response) => {
                this.requesting_thumbnail_data = false;
                if (init) {
                    // we want the total count
                    if (typeof response !== 'object' || response === null ||
                        typeof response.meta !== 'object' ||
                        response.meta === null) {
                            this.hideMe();
                            return;
                        }
                    this.thumbnails_count =
                        typeof response.meta.totalCount === 'number' ?
                            response.meta.totalCount : 0;
                    if (this.thumbnails_count === 0) this.hideMe();
                }

                // return if count is null or
                // if data array is not present/zero length
                if (this.thumbnails_count === 0 ||
                    !Misc.isArray(response.data) ||
                    response.data.length === 0) return;

                // add thumnails to the map which will trigger the loading
                this.addThumbnails(response.data, end, skip_decrement);

                // open first image for data/well
                if (init && !refresh &&
                    (this.context.initial_type === INITIAL_TYPES.DATASET ||
                    this.context.initial_type === INITIAL_TYPES.WELL)) {
                    this.onClick(response.data[0]['@id']);
                }
            },
            error : (response) => {
                this.requesting_thumbnail_data = false;
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
                url: thumbPrefix + id + "/",
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
     * Click Handler for single/double clicks to converge on:
     * Opens images in single and multi viewer mode
     *
     * @memberof ThumbnailSlider
     * @param {number} image_id the image id for the clicked thumbnail
     * @param {boolean} is_double_click true if triggered by a double click
     */
    onClicks(image_id, is_double_click = false) {
        let navigateToNewImage = () => {
            this.context.rememberImageConfigChange(image_id);
            let parent_id =
                this.context.initial_type === INITIAL_TYPES.DATASET ||
                this.context.initial_type === INITIAL_TYPES.WELL ?
                    this.context.initial_ids[0] :
                        this.context.initial_type === INITIAL_TYPES.IMAGES &&
                        this.context.initial_ids.length === 1 &&
                        this.image_config !== null &&
                        typeof this.image_config.image_info.parent_id === 'number' ?
                            this.image_config.image_info.parent_id : null;
            let parent_type =
                parent_id === null ? INITIAL_TYPES.NONE :
                    this.context.initial_type === INITIAL_TYPES.IMAGES ?
                        this.image_config.image_info.parent_type :
                        this.context.initial_type;
            // single click in mdi will need to 'replace' image config
            if (this.context.useMDI && !is_double_click) {
                    let oldPosition = Object.assign({}, this.image_config.position);
                    let oldSize = Object.assign({}, this.image_config.size);
                    this.context.removeImageConfig(this.image_config, true);
                    this.context.addImageConfig(image_id, parent_id, parent_type);
                    let selImgConf = this.context.getSelectedImageConfig();
                    if (selImgConf !== null) {
                        selImgConf.position = oldPosition;
                        selImgConf.size = oldSize;
                    }
            } else this.context.addImageConfig(image_id, parent_id, parent_type);
        };

        let modifiedConfs = this.context.useMDI ?
            this.context.findConfigsWithModifiedRegionsForGivenImage(
                image_id) : [];
        let selImgConf = this.context.getSelectedImageConfig();
        let hasSameImageSelected =
            selImgConf && selImgConf.image_info.image_id === image_id;
        // show dialogues for modified rois
        if (this.image_config &&
            this.image_config.regions_info &&
            (this.image_config.regions_info.hasBeenModified() ||
             modifiedConfs.length > 0) &&
             (!is_double_click || (is_double_click && !hasSameImageSelected)) &&
            !Misc.useJsonp(this.context.server) &&
            this.image_config.regions_info.image_info.can_annotate) {
                let modalText =
                    !this.context.useMDI ||
                    this.image_config.regions_info.hasBeenModified() ?
                        'You have new/deleted/modified ROI(s).<br>' +
                        'Do you want to save your changes?' :
                        'You have changed ROI(s) on an image ' +
                        'that\'s been opened multiple times.<br>' +
                        'Do you want to save now to avoid ' +
                        'inconsistence (and a potential loss ' +
                        'of some of your changes)?';
                let saveHandler =
                    !this.context.useMDI ||
                    (!is_double_click &&
                     this.image_config.regions_info.hasBeenModified()) ?
                        () => {
                            let tmpSub =
                                this.context.eventbus.subscribe(
                                    REGIONS_STORED_SHAPES,
                                    (params={}) => {
                                        tmpSub.dispose();
                                        if (params.omit_client_update)
                                            navigateToNewImage();
                                });
                            setTimeout(()=>
                                this.context.publish(
                                    REGIONS_STORE_SHAPES,
                                    {config_id : this.image_config.id,
                                     omit_client_update: true}), 20);
                        } :
                        () => {
                            this.context.publish(
                                REGIONS_STORE_SHAPES,
                                {config_id :
                                    this.image_config.regions_info.hasBeenModified() ?
                                    this.image_config.id : modifiedConfs[0],
                                 omit_client_update: false});
                            navigateToNewImage();
                        };
                UI.showConfirmationDialog(
                    'Save ROIs?', modalText,
                    saveHandler, () => navigateToNewImage());
        } else navigateToNewImage();
    }

    /**
     * hacky solution to allow double - single click distinction
     *
     * @memberof ThumbnailSlider
     * @param {number} image_id the image id for the clicked thumbnail
     */
    onClick(image_id) {
        if (this.click_handle) {
            clearTimeout(this.click_handle);
            this.click_handle = null;
        }
        this.click_handle = setTimeout(() => this.onClicks(image_id), 250);
    }

    /**
     * Double click handler. Triggers mdi if not already in mdi
     *
     * @memberof ThumbnailSlider
     * @param {number} image_id the image id for the clicked thumbnail
     * @param {Object} event the mouse click event
     */
    onDoubleClick(image_id, event) {
        event.stopPropagation();

        if (this.click_handle) {
            clearTimeout(this.click_handle);
            this.click_handle = null;
        }
        this.context.useMDI = true;
        this.onClicks(image_id, true);

        return false;
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

    /**
     * Refresh thumbnail slider contents by reinitialization
     *
     * @memberof ThumbnailSlider
     */
    refreshThumbnails() {
        // we are already requesting
        if (this.requesting_thumbnail_data ||
            this.context.selected_config === null) return;

        // reset
        this.initialized = false;
        this.thumbnails_start_index = 0;
        this.thumbnails_end_index = 0;
        this.thumbnails_count = 0;
        this.thumbnails = [];

        // request again
        this.initializeThumbnails(true);
    }
}
