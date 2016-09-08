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
}
