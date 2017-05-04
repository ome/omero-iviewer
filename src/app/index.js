//css and images
require('../../node_modules/jquery-ui/themes/base/theme.css');
require('../../node_modules/bootstrap/dist/css/bootstrap.min.css');
require('../../node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff');
require('../css/app.css');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_777777_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_555555_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_ffffff_256x240.png');


// js
import {inject} from 'aurelia-framework';
import Context from './context';
import Misc from '../utils/misc';
import {IMAGE_VIEWER_RESIZE} from '../events/events';

/**
 * @classdesc
 *
 * The index view/page so to speak
 */
@inject(Context)
export class Index  {

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Index
     */
    attached() {
        window.onresize =
            () => this.context.publish(IMAGE_VIEWER_RESIZE,
                {config_id: -1, is_dragging: false, window_resize: true});
        window.onbeforeunload = () => {
            if (Misc.useJsonp(this.context.server)) return null;
            let conf = this.context.getSelectedImageConfig();
            if (conf && conf.regions_info &&
                !Misc.useJsonp(this.context.server) &&
                conf.regions_info.hasBeenModified() &&
                conf.regions_info.image_info.can_annotate)
                    return "You have new/deleted/modified ROI(S).\n" +
                           "If you leave you'll lose your changes.";
            return null;
        };
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        window.onresize = null;
        window.onbeforeunload = null;
    }
}
