import { bootstrap } from 'aurelia-bootstrapper-webpack';
import {EventAggregator} from 'aurelia-event-aggregator';
import Context from './app/context';
import Index from './app/index';
import Misc from './utils/misc';

bootstrap(function(aurelia) {
  aurelia.use
    .standardConfiguration()
    .developmentLogging();

    let init_id = window.INITIAL_IMAGE_ID;
    let init_server = window.INITIAL_SERVER;

    if (typeof init_id !== 'number')
        console.error(
            "Please supply an initial image id by setting 'window.INITIAL_IMAGE_ID'");

    aurelia.container.registerInstance(
        Context,
        new Context(
            aurelia.container.get(EventAggregator), init_id,init_server));

    $.ajaxSetup({
        beforeSend: (xhr) =>
            xhr.setRequestHeader("X-CSRFToken", Misc.getCookie('csrftoken'))
    });

    aurelia.start().then(() => aurelia.setRoot('app/index', document.body));
});
