// js
import {inject, bindable, customElement} from 'aurelia-framework';
import Context from './context';
import 'bootstrap';


/**
 * @classdesc
 *
 * the right hand panel
 */
@customElement('right-hand-panel')
@inject(Context, Element)
export class RightHandPanel {
    /**
     * which image config do we belong to (bound via template)
     * @memberof RightHandPanel
     * @type {number}
     */
    @bindable config_id=null;

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context, element) {
        this.context = context;
        this.element = element;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof RightHandPanel
     */
    attached() {
        $(this.element).find("a").click((e) => {
            e.preventDefault();

            let hash = e.currentTarget.hash;

            // we don't allow clicking the regions if we don't show them
            // or if the rgions info is not present
            let img_conf = this.context.getImageConfig(this.config_id);
            if (hash === '#rois' && (
                !this.context.show_regions || img_conf === null ||
                    img_conf.regions_info === null ||
                    img_conf.regions_info.data === null)) return;

            $(e.currentTarget).tab('show');
        });
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof RightHandPanel
     */
    detached() {
        $(this.element).find("a").unbind("click");
    }
}
