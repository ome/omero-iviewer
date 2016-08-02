require('../css/pocketgrid.css');

import {inject} from 'aurelia-framework';
import Context from './context';
import {EVENTS} from '../events/events';

@inject(Context)
export class Index  {
    constructor(context) {
        this.context = context;
    }

    attached() {
        window.onresize =
        () => this.context.publish(EVENTS.VIEWER_RESIZE, {config_id: -1});
    }

    detached() {
        window.onresize = null;
    }

    unbind() {
        this.context = null;
    }
}
