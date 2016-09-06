import { bootstrap } from 'aurelia-bootstrapper-webpack';
import {EventAggregator} from 'aurelia-event-aggregator';
import Context from './app/context';
import Index from './app/index';
import Misc from './utils/misc';
import {REQUEST_PARAMS} from './utils/misc';

bootstrap(function(aurelia) {
  aurelia.use
    .standardConfiguration()
    .developmentLogging();

    // we need the initial request params with an image id at the minimum
    // otherwise we won't be able to bootstrap
    if (typeof window.INITIAL_REQUEST_PARAMS !== 'object' ||
            window.INITIAL_REQUEST_PARAMS === null) {
        console.error("Please supply the required 'window.INITIAL_REQUEST_PARAMS'");
        return;
    }
    let req = window.INITIAL_REQUEST_PARAMS;
    let init_id =
        typeof req[REQUEST_PARAMS.IMAGE_ID] !== 'undefined' ?
        parseInt(req[REQUEST_PARAMS.IMAGE_ID]) : null;
    if (typeof init_id !== 'number') {
        console.error(
            "Please supply an initial image id by setting 'window.INITIAL_IMAGE_ID'");
        return;
    }
    delete req[REQUEST_PARAMS.IMAGE_ID]; // don't process it any more

    aurelia.container.registerInstance(
        Context,
        new Context(
            aurelia.container.get(EventAggregator), init_id, req));

    $.ajaxSetup({
        beforeSend: (xhr) =>
            xhr.setRequestHeader("X-CSRFToken", Misc.getCookie('csrftoken'))
    });

    aurelia.start().then(() => aurelia.setRoot('app/index', document.body));
});
