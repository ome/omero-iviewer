import {inject} from 'aurelia-framework';
import Context from '../app/context';
import {EVENTS, EventSubscriber} from '../events/events';
import {customElement, bindable, BindingEngine} from 'aurelia-framework';
import {slider} from 'jquery-ui';

/**
 * @classdesc
 *
 * Represents a dimension slider using jquery slider
 * @extends EventSubscriber
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
     * which image config do we belong to (bound via template)
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
    sub_list = [[EVENTS.IMAGE_CONFIG_UPDATE,
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
        // define the element selector and subscribe to events
        this.elSelector = "#" + this.config_id +
            " [dim='" + this.dim + "']" + " [name='dim']";
        this.subscribe();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof DimensionSlider
     */
    attached() {
        // vertical sliders are stretched to full extent
        if (this.dim === 'z')
            $(this.elSelector).addClass("height100");
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
\     */
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
        this.unregisterObserver();
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) => this.onChange(newValue, false));
    }

    /**
     * Handles changes in the dimension model both via the UI or
     * driven by the application/programmatically (see second param)
     *
     * @memberof DimensionSlider
     * @param {number|string} value the new dimension value
     * @param {boolean} slider_interaction true if change was affected by UI
     */
     onImageConfigChange(params = {}) {
         // we ignore notifications that don't concern us
         if (params.config_id !== this.config_id) return;

         // change image config and (re)register observer
         // as well as update the slider (UI)
         this.image_info =
             this.context.getImageConfig(this.config_id).image_info;
         this.registerObserver();
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
    onChange(value, slider_interaction) {
        //no need to change
        if (value === this.image_info.dimensions[this.dim]) return;

        // convert just in case
        this.image_info.dimensions[this.dim] = parseInt(value);

        // send out a dimension change notification
        if (slider_interaction)
            this.context.publish(
                EVENTS.IMAGE_DIMENSION_CHANGE,
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
