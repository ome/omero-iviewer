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
import {inject,customElement, BindingEngine, TaskQueue} from 'aurelia-framework';
import Context from '../app/context';
import Misc from '../utils/misc';
import UI from '../utils/ui';
import {
    DATASETS_REQUEST_URL, INITIAL_TYPES, IVIEWER,
    WEB_API_BASE, WEBCLIENT, WEBGATEWAY
} from '../utils/constants';
import {REGIONS_STORE_SHAPES, REGIONS_STORED_SHAPES,
        IMAGE_VIEWER_RESIZE} from '../events/events';
import {THUMBNAILS_UPDATE, EventSubscriber} from '../events/events';

/**
 * Displays the image thumbnails
 *
 * @extends {EventSubscriber}
 */
@customElement('thumbnail-slider')
@inject(Context, Element, BindingEngine, TaskQueue)
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
     * webclient prefix for the urls
     * @memberof ThumbnailSlider
     * @type {string}
     */
    webclient_prefix = '';

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
     * size of thumbnails in slider (height + margin)
     * @memberof ThumbnailSlider
     * @type {number}
     */
    thumbnail_size = 90;

    /**
     * height of slider, so we which thumbs have scrolled into view
     * @memberof ThumbnailSlider
     * @type {number}
     */
    slider_height = 90;

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
                    (params={}) => this.updateThumbnails(params)],
                [IMAGE_VIEWER_RESIZE,
                    (params={}) => this.resizeViewer(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, element, bindingEngine, taskQueue) {
        super(context.eventbus)
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
        this.taskQueue = taskQueue;

        // get webgateway prefix and web api base
        this.web_api_base = this.context.getPrefixedURI(WEB_API_BASE);
        this.webclient_prefix = this.context.getPrefixedURI(WEBCLIENT);
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
     * Overridden aurelia lifecycle method:
     * Used to get initial height of panel
     *
     * @memberof ThumbnailSlider
     */
    attached() {
        this.slider_height =
            document.querySelector('.thumbnail-scroll-panel').clientHeight;
    }

    /**
     * Handle resize of the browse window.
     * Updates height of panel
     *
     * @memberof ThumbnailSlider
     */
    resizeViewer() {
        this.slider_height =
            document.querySelector('.thumbnail-scroll-panel').clientHeight;
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
        console.log("initializeThumbnails", refresh, this.context.initial_type);
        if (this.context.initial_type === INITIAL_TYPES.IMAGES) {
            if (this.context.initial_ids.length > 1) {
                // we are a list of images
                this.setThumbnailsFromImageIds(this.context.initial_ids);
            } else {
                this.gatherThumbnailMetaInfo(
                        this.image_config.image_info.image_id);
            }
        } else if (this.context.initial_type === INITIAL_TYPES.DATASET ||
                    this.context.initial_type === INITIAL_TYPES.WELL) {
            this.requestMoreThumbnails(true, refresh);
        }
        this.initialized = true;
    }

    /**
     * Finds parents of current image with /webclient/api/paths_to_object
     * For opening images that have no parent information from somewhere else
     * (e.g. open with) or for images whose parent is a well this method finds
     * the parent id
     *
     * @param {number} image_id the id of the image in the dataset
     * @memberof ThumbnailSlider
     */
    gatherThumbnailMetaInfo(image_id) {
        console.log("gatherThumbnailMetaInfo", image_id);
        let url =
            this.context.server + this.webclient_prefix + "/api/paths_to_object/?" +
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
                                this.requestMoreThumbnails(true);
                        } else this.hideMe();
                        return;
                }

                // find type === dataset or type === well
                // dataset has to match the present dataset id
                // to ensure that we handle images in multiple datasets as well
                let pid = this.image_config.image_info.parent_id;

                let matching_parents = response.paths.map(containers => {
                    let parents = containers.filter(c => c.type === 'well' || (c.type === 'dataset' && c.id === pid));
                    return parents.length > 0 ? parents[0] : null;
                }).filter(parent => parent);

                let parent = matching_parents.length ? matching_parents[0] : null
                let imgInf = this.image_config.image_info;

                if (parent) {
                    if (parent.type === 'dataset') {
                        imgInf.parent_type = INITIAL_TYPES.DATASET
                    } else if (parent.type === 'well') {
                        imgInf.parent_type = INITIAL_TYPES.WELL;
                        imgInf.parent_id = parent.id;
                    }
                }

                console.log("imgInf.parent_type, imgInf.parent_id", imgInf.parent_type, imgInf.parent_id);

                if (imgInf.parent_id === null) {
                    this.hideMe();
                    return;
                }

                // let initialize = (parent === null);
                // TODO: why would initialize not be true here?
                let initialize = true;
                console.log('parent', parent);

                let start_index = 0;
                if (parent) {
                    // set count, start and end indices (if count > limit)
                    // this.setThumbnailsCount(parent.childCount);  --
                    // if (this.thumbnails.length > this.thumbnails_request_size) {
                        // start_index = (parent.childPage - 1) * this.thumbnails_request_size;
                        start_index = parent.childIndex;
                        console.log('parent.childIndex', parent.childIndex);
                    // }
                }
                this.requestMoreThumbnails(initialize, false, start_index);
            },
            error : (response) => this.requestMoreThumbnails(true)
        });
    }

    /**
     * If we have the ImageIDs in hand, we can generate thumbnails without
     * having to load them.
     *
     * @param {list} list of IDs
     * @memberof ThumbnailSlider
     */
    setThumbnailsFromImageIds(imageIds) {
        this.setThumbnailsCount(imageIds.length);
        let to_add = imageIds.map(id => ({
            '@id': id,
            Name: 'image: ' + id
        }));
        this.addThumbnails(to_add, 0);
    }

    /**
     * Loads unloaded thumbnails that scrolled into the thumbnail panel
     *
     * @param {number} scrollTop Current scroll position of the panel
     * @memberof ThumbnailSlider
     */
    loadVisibleThumbnails(scrollTop, init = false, refresh = false) {
        if (scrollTop === undefined) {
            const panel = document.querySelector('.thumbnail-scroll-panel');
            if (panel)
            scrollTop = panel.scrollTop;
        }
        console.log('loadVisibleThumbnails scrollTop:', scrollTop);

        let thumb_start_index = parseInt(scrollTop / this.thumbnail_size);
        let thumb_end_index = parseInt((scrollTop + this.slider_height) / this.thumbnail_size);
        console.log('this.thumbnail_size', this.slider_height);
        console.log('scrolled to thumb_index...', thumb_start_index, thumb_end_index);

        let unloaded = [];
        for (var idx=thumb_start_index; idx<=thumb_end_index; idx++){
            if (idx < this.thumbnails.length && !this.thumbnails[idx].id) {
                unloaded.push(idx);
            }
        }
        if (unloaded.length > 0) {
            thumb_start_index = unloaded[0];
            thumb_end_index = unloaded[unloaded.length-1];
            console.log('unloaded thumbs: thumb_start_index, thumb_end_index', thumb_start_index, thumb_end_index);
            this.requestMoreThumbnails(init, refresh, thumb_start_index, thumb_end_index);
        }
    }

    /**
     * Requests next batch of thumbnails
     *
     * @param {boolean} init if true we have to perform some init tasks/checks
     * @param {boolean} refresh true if the user hit the refresh icon
     * @param {number} thumb_start_index Index of first thumbnail. Selected
     * @param {number} thumb_end_index Optional. Otherwise use request_size
     * @memberof ThumbnailSlider
     */
    requestMoreThumbnails(init = false, refresh = false,
                          thumb_start_index = 0, thumb_end_index) {
        let parent_id =
            this.context.initial_type === INITIAL_TYPES.DATASET ||
            this.context.initial_type === INITIAL_TYPES.WELL ?
                this.context.initial_ids[0] :
                this.image_config.image_info.parent_id;
        let parent_type =
            this.context.initial_type === INITIAL_TYPES.IMAGES ?
                this.image_config.image_info.parent_type :
                this.context.initial_type;

        let offset = parseInt(thumb_start_index / this.thumbnails_request_size) * this.thumbnails_request_size;
        let limit = this.thumbnails_request_size;
        if (thumb_end_index !== undefined) {
            // load all thumbs in the range. Batches are multiples of request_size
            thumb_end_index = Math.ceil(thumb_end_index / this.thumbnails_request_size) * this.thumbnails_request_size;
            limit = thumb_end_index - offset;
        }

        console.log("requestMoreThumbnails... offset, limit", offset, limit);

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
                console.log("...requestMoreThumbnails init", init, this.thumbnails.length);
                if (init) {
                    // we want the total count
                    if (typeof response !== 'object' || response === null ||
                        typeof response.meta !== 'object' ||
                        response.meta === null) {
                            this.hideMe();
                            return;
                        }
                    this.setThumbnailsCount(response.meta.totalCount);
                    if (this.thumbnails.length === 0) this.hideMe();
                }

                // return if count is null or
                // if data array is not present/zero length
                if (this.thumbnails.length === 0 ||
                    !Misc.isArray(response.data) ||
                    response.data.length === 0) return;

                // add thumnails to the map which will trigger the loading
                this.addThumbnails(response.data, offset);
                if (init) {
                    if (thumb_start_index > 0) {
                        // Scrolling will trigger loading of any unloaded thumbs
                        this.scrollToThumbnail(thumb_start_index);
                    } else {
                        // but if we don't need to scroll, trigger manually...
                        this.loadVisibleThumbnails();
                    }
                }

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
     * Adds thumbnails with Image IDs to this.thumbnails array.
     * We create a new list from old, replacing the thumbnails (instead of
     * modifying the old list) to make sure the changes is observed and
     * UI updates.
     *
     * @param {Array.<Object>} thumbnails the thumbnails to be added
     * @param {number} start_index Index to start replacing
     * @memberof ThumbnailSlider
     */
    addThumbnails(thumbnails, start_index) {
        console.log('addThumbnails...');
        // if we are remote we include the server
        let thumbPrefix =
            (this.context.server !== "" ? this.context.server + "/" : "") +
            this.webclient_prefix + "/render_thumbnail/";

        let new_index = 0;
        this.thumbnails = this.thumbnails.map((thumb, idx) => {
            if ((idx === start_index + new_index) && (new_index < thumbnails.length)) {
                let t = thumbnails[new_index];
                new_index++;
                return {
                    id: t['@id'],
                    url: thumbPrefix + t['@id'] + "/",
                    title: typeof t.Name === 'string' ? t.Name : t['@id'],
                    revision : 0
                }
            } else {
                return thumb;
            }
        });
    }

    /**
     * Adds thumbnails with Image IDs to this.thumbnails array.
     * We create a new list from old, replacing the thumbnails (instead of
     * modifying the old list) to make sure the changes is observed and
     * UI updates.
     *
     * @param {Array.<Object>} thumbnails the thumbnails to be added
     * @param {number} start_index Index to start replacing
     * @memberof ThumbnailSlider
     */
    scrollToThumbnail(index) {
        // https://github.com/aurelia/templating/issues/79
        console.log("SCROLLING to ", index);
        this.taskQueue.queueMicroTask(() => {
            const target = (index) * this.thumbnail_size;

            // If we didn't do ajax call to load thumbnails, ?image=1&image=2
            // the scroll-panel might not be ready yet.
            console.log('scroll to top...', target)
            let scroll_panel = document.querySelector('.thumbnail-scroll-panel');
            if (scroll_panel) {
                scroll_panel.scrollTop = target;
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

    handleScrollEvent(event) {

        console.log('scroll', event.target.scrollTop, this.thumbnail_size, event.target.scrollTop / this.thumbnail_size)
        // find index of any visible thumbnails that aren't loaded...

        this.loadVisibleThumbnails(event.target.scrollTop);
    }

    /**
     * Updates one or more thumbnails
     *
     * @memberof ThumbnailSlider
     * @param {Object} params the parameter object received by the event
     */
    updateThumbnails(params = {}) {
        console.log('updateThumbnails', params);
        if (typeof params !== 'object' ||
            !Misc.isArray(params.ids) && params.ids.length > 0) return;

        // turn array into object for easier lookup
        let updatedIds = {};
        params.ids.forEach((id) => updatedIds[id] = null);

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

    setThumbnailsCount(count) {
        console.log('setThumbnailsCount:', count, 'was:', this.thumbnails.length);
        if (typeof count !== 'number') {
            count = 0;
        }
        this.thumbnails.length = count;
        // IE doesn't support fill()
        for (let i=0; i<count; i++) {
            this.thumbnails[i] = {'version': 0, 'title': 'unloaded'};
        }
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
        this.setThumbnailsCount(0);

        // request again
        this.initializeThumbnails(true);
    }
}
