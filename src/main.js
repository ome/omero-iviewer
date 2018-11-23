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

// #if pDE_ENV
import 'bootstrap/dist/css/bootstrap.min.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/themes/base/spinner.css';
import 'jquery-ui/themes/base/slider.css';
import 'spectrum-colorpicker/spectrum.css';
import '../css/ol3-viewer.css';
import '../css/app.css';
// #endif

import 'bootstrap';
import './app/index';
import './libs/ol3-viewer/ome';


// File specific
import {PLATFORM} from 'aurelia-pal';
import {EventAggregator} from 'aurelia-event-aggregator';
import environment from './environment';
import Context from './app/context';
import Misc from './app/utils/misc';
import {URI_PREFIX, PLUGIN_NAME, WINDOWS_1252} from './app/utils/constants';
import * as Bluebird from 'bluebird';

// global scope settings
Bluebird.config({warnings: {wForgottenReturn: false}});
window['encoding-indexes'] = {'windows-1252': WINDOWS_1252};

/* IMPORTANT:
 * we have to set the public path here to include any potential prefix
 * has to happen before the bootstrap!
 */
let req = window.INITIAL_REQUEST_PARAMS || {};
let isDevServer = false;
// #if process.env.NODE_ENV === 'dev-server'
// is_dev_server = true;
// #endif
if (!isDevServer) {
  let prefix =
    typeof req[URI_PREFIX] === 'string' ?
      Misc.prepareURI(req[URI_PREFIX]) : '';
  __webpack_public_path__ = prefix + '/static/' + PLUGIN_NAME + '/';
}

export function configure(aurelia) {
  aurelia.use
    .basicConfiguration()
    .globalResources([PLATFORM.moduleName('ol')]);
  // .feature(PLATFORM.moduleName('libs/index'))
  // .globalResources([PLATFORM.moduleName('ol'), PLATFORM.moduleName('openlayers')]);

  // Uncomment the line below to enable animation.
  // aurelia.use.plugin(PLATFORM.moduleName('aurelia-animator-css'));
  // if the css animator is enabled, add swap-order="after" to all router-view elements

  // Anyone wanting to use HTMLImports to load views, will need to install the following plugin.
  // aurelia.use.plugin(PLATFORM.moduleName('aurelia-html-import-template-loader'));

  aurelia.use.developmentLogging(environment.debug ? 'debug' : 'warn');

  // if (environment.testing) {
  //   aurelia.use.plugin(PLATFORM.moduleName('aurelia-testing'));
  // }

  let ctx = new Context(aurelia.container.get(EventAggregator), req);
  if (isDevServer) {
    ctx.isDevServer = true;
  }
  aurelia.container.registerInstance(Context, ctx);

  return aurelia.start().then(a => a.setRoot(PLATFORM.moduleName('app/index')));
}
