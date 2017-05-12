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

import { bootstrap } from 'aurelia-bootstrapper-webpack';
import {EventAggregator} from 'aurelia-event-aggregator';
import Context from './app/context';
import Index from './app/index';
import Misc from './utils/misc';
import {REQUEST_PARAMS, URI_PREFIX, PLUGIN_NAME} from './utils/constants';

let req = window.INITIAL_REQUEST_PARAMS || {};

/* IMPORTANT:
 * we have to set the public path here to include any potential prefix
 * has to happen before the bootstrap!
 */
let is_dev_server = typeof req["DEV_SERVER"] === 'boolean' && req["DEV_SERVER"];
if (!is_dev_server) {
    let prefix =
        typeof req[URI_PREFIX] === 'string' ?
            Misc.prepareURI(req[URI_PREFIX]) : "";
    __webpack_public_path__ = prefix + '/static/' + PLUGIN_NAME + '/';
}

/**
 * IViewer bootstrap function
 * @function
 * @param {Object} aurelia the aurelia instance
 */
bootstrap(function(aurelia) {
  aurelia.use
    .standardConfiguration()
    .developmentLogging();

    let init_id =
        typeof req[REQUEST_PARAMS.IMAGE_ID] !== 'undefined' ?
        parseInt(req[REQUEST_PARAMS.IMAGE_ID]) : null;
    if (typeof init_id !== 'number') {
        console.error(
            "Please supply an initial image id by setting 'window.INITIAL_IMAGE_ID'");
        return;
    }
    delete req[REQUEST_PARAMS.IMAGE_ID]; // don't process it any more

    let ctx = new Context(aurelia.container.get(EventAggregator), init_id, req);
    if (is_dev_server) ctx.tweakForDevServer();
    aurelia.container.registerInstance(Context,ctx);

    aurelia.start().then(() => aurelia.setRoot('app/index', document.body));
});
