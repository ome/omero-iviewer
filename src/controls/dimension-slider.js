//css and images
require('../../node_modules/jquery-ui/themes/smoothness/jquery-ui.min.css');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-bg_flat_75_ffffff_40x100.png');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-bg_glass_75_e6e6e6_1x400.png');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-bg_glass_75_dadada_1x400.png');
require('../../node_modules/jquery-ui/themes/smoothness/images/ui-bg_glass_65_ffffff_1x400.png');

import Context from '../app/context';
import {inject,customElement, bindable, BindingEngine} from 'aurelia-framework';
import {slider} from 'jquery-ui';

import {
    IMAGE_CONFIG_UPDATE, IMAGE_DIMENSION_CHANGE,
    EventSubscriber
} from '../events/events';

/**
 * Represents a dimension slider using jquery slider
 * @extends {EventSubscriber}
 */

@customElement('dimension-slider')
@inject(Context, Element, BindingEngine)
export default class DimensionSlider extends EventSubscriber {
    /**
     * the image we belong to
     * @memberof DimensionSlider
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * a selector to conveniently access the dimension element slider
     * @memberof DimensionSlider
     * @type {ImageInfo}
     */
    elSelector = null;

    /**
     * which image config do we belong to (bound in template)
     * @memberof DimensionSlider
     * @type {number}
     */
    @bindable config_id = null;

    /**
     * which dimension do we represent (bound via template)
     * @memberof DimensionSlider
     * @type {string}
     */
    @bindable dim = 't';

    /**
     * events we subscribe to
     * @memberof DimensionSlider
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_CONFIG_UPDATE,
                    (params = {}) => this.onImageConfigChange(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine injected instance of BindingEngine
     */
    constructor(context, element, bindingEngine) {
        super(context.eventbus);
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof DimensionSlider
     */
    bind() {
        // define the element selector, subscribe to events and register observer
        this.subscribe();
        this.elSelector = "#" + this.config_id +
            " [dim='" + this.dim + "']" + " [name='dim']";
        this.registerObserver();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof DimensionSlider
     */
    attached() {
        if (this.dim === 'z')
            $(this.elSelector).height("100%");
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof DimensionSlider
     */
    detached() {
        try {
            // get rid of slider
            $(this.elSelector).slider( "destroy" );
        } catch (ignored) {}
        this.hide();
    }

    /**
     * Shows slider using display or visibility css
     *
     * @memberof DimensionSlider
     * @param {boolean} use_display use css display instead of visibility
     */
    show(use_display=false) {
        if (use_display) $(this.element).show();
        else $(this.element).css('visibility', 'visible');
    }

    /**
     * Hides slider using display or visibility css
     *
     * @memberof DimensionSlider
     * @param {boolean} use_display use css display instead of visibility
     */
    hide(use_display=false) {
        if (use_display) $(this.element).hide();
        else $(this.element).css('visibility', 'hidden');
    }

    /**
     * Unregisters the dimension property listener for model change
     *
     * @memberof DimensionSlider
     */
    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
    }

    /**
     * Registers the dimension property listener for model change
     *
     * @memberof DimensionSlider
     */
    registerObserver() {
        if (this.image_info === null) return;
        this.unregisterObserver();
        // we do this in a bit of a roundabout way by setting the slider value
        // which in turn triggers the onchange handler which is where
        // both, programmatic and ui affected change converge
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) =>
                            $(this.elSelector).slider({value: newValue}))
    }

    /**
     * Handles changes of the associated ImageConfig
     *
     * @memberof DimensionSlider
     * @param {Object} params the event notification parameters
     */
     onImageConfigChange(params = {}) {
         // if the event is for another config, forget it...
         if (params.config_id !== this.config_id) return;

         // change image config and (re)bind
         // as well as update the slider (UI)
         this.config_id = params.config_id;
         this.image_info =
             this.context.getImageConfig(params.config_id).image_info;
         this.bind();
         this.updateSlider()
     }

    /**
     * Handles changes in the dimension model both via the UI or
     * driven by the application/programmatically (see second param)
     *
     * @memberof DimensionSlider
     * @param {number|string} value the new dimension value
     * @param {boolean} slider_interaction true if change was affected by UI
     */
    onChange(value, slider_interaction = false) {
        // no need to change for a the same value
        if (slider_interaction &&
            value === this.image_info.dimensions[this.dim]) return;
        else if (slider_interaction) {
            // this will trigger the observer who does the rest
            this.image_info.dimensions[this.dim] = parseInt(value);
            return;
        }

        // send out a dimension change notification
        this.context.publish(
            IMAGE_DIMENSION_CHANGE,
                {config_id: this.config_id,
                 dim: this.dim,
                 value: [this.image_info.dimensions[this.dim]]});
    }

    /**
     * Affects updates of the jquery slider
     *
     * @memberof DimensionSlider
     */
    updateSlider() {
        // just in case
        this.detached();

        // no slider for a 0 length dimension
        if (this.image_info.dimensions['max_' + this.dim] <= 1) return;

        // create jquery slider
        $(this.elSelector).slider({
            orientation: this.dim === 'z' ? "vertical" : "horizontal",
            min: 0, max: this.image_info.dimensions['max_' + this.dim] - 1 ,
            step: 1, value: this.image_info.dimensions[this.dim],
            change: (event, ui) => this.onChange(ui.value,
                event.originalEvent ? true : false)
        });

        this.attached();
        this.show();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof DimensionSlider
     */
    unbind() {
        this.unsubscribe()
        this.unregisterObserver();
        this.image_info = null;
    }
}
