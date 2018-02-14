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

import {noView} from 'aurelia-framework';
import Misc from './misc';

/**
 * Open With Helper Class
 */
@noView
export default class OpenWith {

    /**
     * 'Initializes' OpenWith (global variable and function definitions)
     *
     * @static
     */
    static initOpenWith() {
        window.OME = window.OME || {};  // In case this ns exists already

        window.OME.setOpenWithEnabledHandler = function(label, fn) {
            // look for label in OPEN_WITH
            OpenWith.OPEN_WITH.forEach(function(ow){
                if (ow.label === label) {
                    ow.isEnabled = function() {
                        // wrap fn with try/catch, since error here will break jsTree menu
                        var args = Array.from(arguments);
                        var enabled = false;
                        try {
                            enabled = fn.apply(this, args);
                        } catch (e) {
                            // Give user a clue as to what went wrong
                            console.log("Open with " + label + ": " + e);
                        }
                        return enabled;
                    }
                }
            });
        };

        window.OME.setOpenWithUrlProvider = function(id, fn) {
            // look for label in OPEN_WITH
            OpenWith.OPEN_WITH.forEach(function(ow){
                if (ow.id === id) {
                    ow.getUrl = fn;
                }
            });
        };
    }

    /**
     * Fetches the open with scripts and stores them in OpenWith.OPEN_WITH
     *
     * @static
     * @param {string} prefixed_server_uri the server prefix
     */
    static fetchOpenWithScripts(server_prefix) {
        OpenWith.OPEN_WITH = [];
        $.ajax(
            {url : server_prefix + "/open_with/",
            success : (response) => {
                if (typeof response !== 'object' || response === null ||
                    !Misc.isArray(response.open_with_options)) return;

                OpenWith.OPEN_WITH = response.open_with_options;
                // Try to load scripts if specified:
                OpenWith.OPEN_WITH.forEach(ow => {
                    if (ow.script_url) {
                        $.getScript(ow.script_url);
                    }
                });
            }
        });
    }

    /**
     * Returns list of open with link parameters
     *
     * @static
     * @param {number} image_id the image id for the open_with_links
     * @param {string} image_name the image_name for the open_with_links
     * @param {string} iviewer_url the prefixed iviewer url
     * @return {Array.<Object>} a list of link parameters or empty list
     */
    static getOpenWithLinkParams(image_id, image_name, iviewer_url, webgateway_url) {

        return OpenWith.OPEN_WITH.map(v => {
            var selectedObjs = [{id: image_id,
                                 type: 'image',
                                 name: image_name}];
            var enabled = false;
            if (typeof v.isEnabled === "function") {
                enabled = v.isEnabled(selectedObjs);
            } else if (typeof v.supported_objects === "object" && v.supported_objects.length > 0) {
                enabled = v.supported_objects.reduce(function(prev, supported){
                    // enabled if plugin supports 'images' or 'image'
                    return prev || supported === 'images' || supported === 'image';
                }, false);
            }
            if (!enabled) return;

            // Ignore open_with -> iviewer or webgateway viewer
            if (v.url.indexOf(iviewer_url) === 0 ||
                v.url.indexOf(webgateway_url) == 0) return;

            var label = v.label || v.id;

            // Get the link via url provider...
            var the_url;
            try {
                the_url = v.getUrl(selectedObjs, v.url);
            }
            catch(err){}
            var url = the_url || v.url + '?image=' + image_id;

            return ({text: label, url: url});
        }).filter(l => l);
    }
}
