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

import { bootstrap } from 'aurelia-bootstrapper';
import {EventAggregator} from 'aurelia-event-aggregator';
import Context from './app/context';
import Index from './app/index';
import Misc from './utils/misc';
import {URI_PREFIX, PLUGIN_NAME, WINDOWS_1252} from './utils/constants';
import * as Bluebird from 'bluebird';

// global scope settings
Bluebird.config({ warnings: { wForgottenReturn: false } });
window['encoding-indexes'] = {"windows-1252": WINDOWS_1252};

/* IMPORTANT:
 * we have to set the public path here to include any potential prefix
 * has to happen before the bootstrap!
 */
let req = window.INITIAL_REQUEST_PARAMS || {};
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

    let ctx = new Context(aurelia.container.get(EventAggregator), req);
    if (is_dev_server) ctx.tweakForDevServer();
    aurelia.container.registerInstance(Context,ctx);

    aurelia.start().then(
        () => aurelia.setRoot(PLATFORM.moduleName('app/index'), document.body));
});
