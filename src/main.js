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

    $.ajaxSetup({
        beforeSend: (xhr, settings) => {
            if (!Misc.useJsonp(ctx.server) &&
                !(/^(GET|HEAD|OPTIONS|TRACE)$/.test(settings.type)))
                xhr.setRequestHeader("X-CSRFToken", Misc.getCookie('csrftoken'));
        }
    });

    aurelia.start().then(() => aurelia.setRoot('app/index', document.body));
});
