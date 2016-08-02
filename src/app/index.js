require('../css/pocketgrid.css');

import {inject} from 'aurelia-framework';
import AppContext from './context';
import {EVENTS} from '../events/events';

@inject(AppContext)
export class Index  {
    constructor(context) {
        this.context = context;
    }

    unbind() {
        this.context = null;
    }

    selectImage(id=null) {
        this.context.selectConfig(id);
    }

    showRegions() {
        this.context.show_regions = $("#show_regions").prop("checked");

        for (let [id,conf] of this.context.image_configs) {
            conf.image_info.show_regions = this.context.show_regions;
            if (this.context.useMDI) this.resetImage(id);
        }

        this.context.publish(EVENTS.SHOW_REGIONS, this.context.show_regions);
    }
}
