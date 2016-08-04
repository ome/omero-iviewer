import {inject} from 'aurelia-framework';
import Context from '../app/context';
import {EVENTS, EventSubscriber} from '../events/events';
import {customElement, bindable, BindingEngine} from 'aurelia-framework';
import {slider} from 'jquery-ui';

@customElement('dimension-slider')
@inject(Context, Element, BindingEngine)
export default class DimensionSlider extends EventSubscriber {
    image_info = null;
    @bindable config_id = null;
    @bindable dim = 't';
    sub_list = [[EVENTS.IMAGE_CONFIG_UPDATE, (params = {}) => {
        if (params.config_id !== this.config_id) return;
        this.image_info =
            this.context.getImageConfig(this.config_id).image_info;
        this.registerObserver();
        this.forceUpdate() }]];

    constructor(context, element, bindingEngine) {
        super(context.eventbus);
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
        this.elSelector = null;
    }

    bind() {
        this.elSelector = "#" + this.config_id +
            " [dim='" + this.dim + "']" + " [name='dim']";
        this.subscribe();
    }

    attached() {
        if (this.dim === 'z')
            $(this.elSelector).addClass("height100");
    }

    detached() {
        try {
            $(this.elSelector).slider( "destroy" );
        } catch (ignored) {}
        this.hide();
    }

    show() {
        $(this.element).css('visibility', 'visible');
        //$(this.element).show();
    }

    hide() {
        //$(this.element).hide();
        $(this.element).css('visibility', 'hidden');
    }

    unregisterObserver() {
        if (this.observer) {
            this.observer.dispose();
            this.observer = null;
        }
    }

    registerObserver() {
        this.unregisterObserver();
        this.observer =
            this.bindingEngine.propertyObserver(
                this.image_info.dimensions, this.dim)
                    .subscribe(
                        (newValue, oldValue) => this.onChange(newValue, false));
    }

    onChange(value, slider_interaction) {
        if (value === this.image_info.dimensions[this.dim]) return;

        this.image_info.dimensions[this.dim] = parseInt(value);
        if (slider_interaction)
            this.context.publish(
                EVENTS.DIMENSION_CHANGE,
                {config_id: this.config_id,
                    dim: this.dim,
                    value: [this.image_info.dimensions[this.dim]]});
    }

    forceUpdate() {
        this.detached();

        if (this.image_info.dimensions['max_' + this.dim] <= 1) return;

        $(this.elSelector).slider({
            orientation: this.dim === 'z' ? "vertical" : "horizontal",
            min: 0, max: this.image_info.dimensions['max_' + this.dim] - 1 ,
            step: 1, value: this.image_info.dimensions[this.dim],
            change: (event, ui) => this.onChange(ui.value,
                event.originalEvent ? true : false)
        });
        this.show();
    }

    unbind() {
        this.unsubscribe()
        this.unregisterObserver();
        this.image_info = null;
    }
}
