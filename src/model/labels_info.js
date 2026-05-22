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

import {noView} from 'aurelia-framework';
import Misc from '../utils/misc';
import {
    IVIEWER, REGIONS_DRAWING_MODE, REGIONS_MODE, REGIONS_REQUEST_URL,
    WEB_API_BASE,
} from '../utils/constants';

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

    /**
     * Retrieves the labels information needed via ajax and stores it internally
     *
     * @memberof LabelsInfo
     * @param {boolean} forceUpdate if true we always request up-to-date data
     */
    requestData(forceUpdate = false) {

        console.log("REQUESTING LABELS INFO FOR IMAGE CONFIG: " + this.image_info.config_id);
        // if (this.ready && !forceUpdate) return;
        // // if we're busy, but still want to update, remember to try again...
        // // otherwise data can end up out-of-sync with Z/T if loading by plane
        // if (this.is_pending) {
        //     if (forceUpdate) {
        //         this.try_request_again = true;
        //     }
        //     return;
        // }
        // // reset labels info data and history
        // this.ready = false;
        // // this.resetLabelsInfo();
        // this.is_pending = true;

        // // send request
        // $.ajax({
        //     url : this.getLabelsUrl(),
        //     success : (response) => {
        //         if (this.try_request_again) {
        //             this.is_pending = false;
        //             this.try_request_again = false;
        //             this.requestData();
        //         } else if (this.is_pending) {
        //             this.setData(response.data);
        //             this.roi_count_on_current_plane = response.meta.totalCount;
        //         }
        //     }, error : (error) => {
        //         this.is_pending = false;
        //         console.error("Failed to load Labels: " + error)
        //     }
        // });
    }
}
