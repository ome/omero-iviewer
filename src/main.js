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

// #if process.env.NODE_ENV
require('../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../node_modules/jquery-ui/themes/base/theme.css');
require('../node_modules/jquery-ui/themes/base/spinner.css');
require('../node_modules/jquery-ui/themes/base/slider.css');
require('../node_modules/spectrum-colorpicker/spectrum.css');
require('../css/ol3-viewer.css');
require('../css/app.css');
// #endif

// global scope settings
Bluebird.config({ warnings: { wForgottenReturn: false } });
window['encoding-indexes'] = {"windows-1252": WINDOWS_1252};

let req = window.INITIAL_REQUEST_PARAMS || {};

/**
 * IViewer bootstrap function
 * @function
 * @param {Object} aurelia the aurelia instance
 */
bootstrap(function(aurelia) {
    aurelia.use.basicConfiguration();
    let ctx = new Context(aurelia.container.get(EventAggregator), req);
    aurelia.container.registerInstance(Context,ctx);

    aurelia.start().then(
        () => aurelia.setRoot(PLATFORM.moduleName('app/index'), document.body));
});
