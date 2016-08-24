// js
import {inject, customElement} from 'aurelia-framework';
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
        $(this.element).find("a").click(function (e) {
          e.preventDefault()
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

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof RightHandPanel
     */
    unbind() {
        this.context = null;
    }
}
