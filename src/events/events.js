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

/** whenever an image config has been updated */
export const IMAGE_CONFIG_UPDATE = "IMAGE_CONFIG_UPDATE";
/** whenever the image viewer needs to be resized */
export const IMAGE_VIEWER_RESIZE = "IMAGE_VIEWER_RESIZE";
/** whenever the image viewer split view is turned on/off */
export const IMAGE_VIEWER_SPLIT_VIEW = "IMAGE_VIEWER_SPLIT_VIEW";
/** whenever the image rendering settings change: channel, model, projection*/
export const IMAGE_SETTINGS_CHANGE = "IMAGE_SETTINGS_CHANGE";
/** whenever an image dimension (c,t,z) changes */
export const IMAGE_DIMENSION_CHANGE = "IMAGE_DIMENSION_CHANGE";
/** whenever the dimension play should be started/stopped */
export const IMAGE_DIMENSION_PLAY = "IMAGE_DIMENSION_PLAY";
/** to initialize the regions (after a request) */
export const REGIONS_INIT = "REGIONS_INIT";
/** to set rois/shape properties such as visibility and selection */
export const REGIONS_SET_PROPERTY = "REGIONS_SET_PROPERTY";
/** whenever a region property change is received, e.g. selection, modification */
export const REGIONS_PROPERTY_CHANGED = "REGIONS_PROPERTY_CHANGED";
/** whenever a new shape has been drawn */
export const REGIONS_DRAW_SHAPE = "REGIONS_DRAW_SHAPE";
/** whenever a new shape has been generated/drawn */
export const REGIONS_SHAPE_GENERATED = "REGIONS_SHAPE_GENERATED";
/** whenever the modes ought to be changed */
export const REGIONS_CHANGE_MODES = "REGIONS_CHANGE_MODES";
/** whenever comments ought to be shown/hidden */
export const REGIONS_SHOW_COMMENTS = "REGIONS_SHOW_COMMENTS";
/** whenever shapes ought to be generated */
export const REGIONS_GENERATE_SHAPES = "REGIONS_GENERATE_SHAPES";
/** whenever shapes are stored */
export const REGIONS_STORE_SHAPES = "REGIONS_STORE_SHAPES";
/** after modified/new/deleted shapes were stored */
export const REGIONS_STORED_SHAPES = "REGIONS_STORED_SHAPES";
/** whenever the styling of shapes is to be changed */
export const REGIONS_MODIFY_SHAPES = "REGIONS_MODIFY_SHAPES";
/** Retrieves the viewer image settings */
export const VIEWER_IMAGE_SETTINGS = "VIEWER_IMAGE_SETTINGS";
/** whenever the ol3 viewer has made a history entry */
export const REGIONS_HISTORY_ENTRY = "REGIONS_HISTORY_ENTRY";
/** whenever we want to affect an ol3 viewer history undo/redo */
export const REGIONS_HISTORY_ACTION = "REGIONS_HISTORY_ACTION";
/** whenever we want to copy selected shape definitions */
export const REGIONS_COPY_SHAPES = "REGIONS_COPY_SHAPES";
/** whenever the histogram range was updated */
export const HISTOGRAM_RANGE_UPDATE = "HISTOGRAM_RANGE_UPDATE";
/** whenever thumbnails are supposed to be updated */
export const THUMBNAILS_UPDATE = "THUMBNAILS_UPDATE";

/**
 * Facilitates recurring event subscription
 * by providing subscribe and unsubscribe methods so that any class
 * that wishes use the eventbus just needs to inherit from it and
 * override/add to the sub_list array.
 *
 */
export class EventSubscriber {
    /**
     * our internal subscription handles (for unsubscribe)
     * @memberof EventSubscriber
     * @type {Array.<Object>}
     */
    subscriptions = [];
    /**
     * the list of events that we loop over to un/subscribe
     * consisting of an array with 2 entries:
     * the first one an EVENTS constant (see above) to denote the type
     * the second is a function/handler to be called, e.g.
     * [EVENTS.IMAGE_CONFIG_UPDATE, (params) => handleMe()]
     *
     * @memberof EventSubscriber
     * @type {Array.<string,function>}
     */
    sub_list = [];

    /**
     * @constructor
     * @param {EventAggregator} eventbus the event aggregator
     */
    constructor(eventbus) {
        this.eventbus = eventbus;
    }

    /**
     * Iterate over sub_list and subscribe to the given events
     * @memberof EventSubscriber
     */
    subscribe() {
        this.unsubscribe();
        this.sub_list.map(
            (value) => this.subscriptions.push(
                this.eventbus.subscribe(value[0], value[1])
            ));
    }

    /**
     * Iterate over sub_list and unsubscribe from all subscriptions
     * @memberof EventSubscriber
     */
    unsubscribe() {
        if (this.subscriptions.length === 0) return;
        while (this.subscriptions.length > 0)
            this.subscriptions.pop().dispose();
    }
}
