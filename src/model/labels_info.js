//
// Copyright (C) 2026 University of Dundee & Open Microscopy Environment.
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

import * as omezarr from 'ome-zarr.js';
import {noView} from 'aurelia-framework';
import Misc from '../utils/misc';
import {
    IVIEWER, REGIONS_DRAWING_MODE, REGIONS_MODE, REGIONS_REQUEST_URL,
    WEB_API_BASE,
} from '../utils/constants';


async function loadZarrLayers(lsids) {

    let newZarrs = [];

    for (const lsid of lsids) {
        const ngffImage = await omezarr.NgffImage.load(lsid);
        const arr0 = await ngffImage.openArray(0);

        console.log("LabelsInfo: Got shape for NGFF image: ", arr0.shape);
        let shape = arr0.shape;
        let chunks = arr0.chunks;
        newZarrs.push({
            id: Misc.getRandomInteger(0, 100000),
            name: "Labels Layer",
            visible: true,
            source: lsid,
            // e.g. [{name: 't', type: 'time'}, {name: 'y', type: 'space'}, {name: 'x', type: 'space'}]
            axes: ngffImage.axes,
            shape: shape,
            chunks: chunks,
            opacity: 1.0,
            // scales is list of scale-shape for each resolution
            // e.g. [[1, 0.5, 0.36, 0.36], [1, 0.5, 0.72, 0.72], ...]
            scales: ngffImage.getScales(),
            layers: [
                {
                    name: "default",
                    channels: ngffImage.omero.channels,
                }
            ],
        });
    };
    return newZarrs;
}

/**
 * Holds region information
 */
@noView
export default class LabelsInfo  {

    /**
     * true if a backend request is pending
     * @memberof LabelsInfo
     * @type {boolean}
     */
    is_pending = false;

    /**
     * a flag that signals whether we have successfully
     * received all backend info or not
     * @memberof LabelsInfo
     * @type {boolean}
     */
    ready = false;

    /**
     * Each zarr URL (e.g. from Shape externalInfo) corresponds to a separate zarr source.
     * Typically we expect just one, but can have more.
     * We may show multiple layers (with different rendering settings) for each zarr source.
     * @memberof LabelsInfo
     * @type {Array}
     */
    zarrSources = [];

    /**
     * @constructor
     * @param {ImageInfo} image_info the associated image
     */
    constructor(image_info) {
        console.log("constructor Creating LabelsInfo for image info: ", image_info);
        this.image_info = image_info;
    }

    /**
     * Even though we are not an Aurelia View we stick to Aurelia's lifecycle
     * terminology and use the method unbind for cleanup purposes
     *
     * @memberof LabelsInfo
     */
    unbind() {
        // this.resetRegionsInfo();
        // this.history = null;
    }

    loadZarr(data) {
        this.is_pending = false;

        // Get the externalInfo Lsid from Shape(s)
        let lsids = [];
        if (data && data.length > 0) {
            data.forEach((roi) => {
                roi.shapes.forEach((shape) => {
                    console.log("Shape: ", shape);
                    if (shape["omero:details"]?.externalInfo?.Lsid) {
                        lsids.push(shape["omero:details"].externalInfo.Lsid);
                    }
                });
            });
        }
        console.log("LabelsInfo: Got LSIDs from shapes: ", lsids);
        if (lsids.length == 0) {
            alert("No externalInfo Lsids found for shapes in ROIs response - cannot load labels data");
            return;
        }

        loadZarrLayers(lsids).then((newZarrs) => {
            this.zarrSources = newZarrs;
            this.ready = true;
        });
    }

    /**
     * Same as the ROIs loading URL - without pagination / projection / Z/T params
     *
     * @memberof LabelsInfo
     * @returns url
     */
    getLabelsUrl() {
        let url = this.image_info.context.server;
        url += this.image_info.context.getPrefixedURI(WEB_API_BASE) +
            REGIONS_REQUEST_URL + '/?image=' + this.image_info.image_id;
        return url;
    }

    /**
     * Retrieves the labels information needed via ajax and stores it internally
     *
     * @memberof LabelsInfo
     * @param {boolean} forceUpdate if true we always request up-to-date data
     */
    requestData(forceUpdate = false) {

        console.log("REQUESTING LABELS INFO FOR IMAGE CONFIG: " + this.image_info.config_id);
        if (this.ready && !forceUpdate) return;
        // if we're busy, but still want to update, remember to try again...
        // otherwise data can end up out-of-sync with Z/T if loading by plane
        if (this.is_pending) {
            if (forceUpdate) {
                this.try_request_again = true;
            }
            return;
        }
        // reset labels info data and history
        this.ready = false;
        // this.resetLabelsInfo();
        this.is_pending = true;

        // send request
        $.ajax({
            url : this.getLabelsUrl(),
            success : (response) => {
                if (this.try_request_again) {
                    this.is_pending = false;
                    this.try_request_again = false;
                    this.requestData();
                } else if (this.is_pending) {
                    this.loadZarr(response.data);
                }
            }, error : (error) => {
                this.is_pending = false;
                console.error("Failed to load Labels: " + error)
            }
        });
    }
}
