import Context from '../app/context';
import {EVENTS, EventSubscriber} from '../events/events';
import {inject, customElement, bindable} from 'aurelia-framework';

require('../css/viewer.css');
import {ol3} from '../../libs/ome-viewer-1.0.js';

@customElement('ol3-viewer')
@inject(Context, Element)
export default class Ol3Viewer extends EventSubscriber {
    @bindable config_id=null;
    image_config = null;
    sub_list = [
        [EVENTS.IMAGE_CONFIG_UPDATE, (params={}) => {
            if (params.config_id !== this.config_id) return;
            this.forceUpdate(); this.viewer.redraw();}]
    ];

    constructor(context, element) {
        super(context.eventbus)
        this.context = context;
        this.element = element;
    }

    bind() {
        this.element.parentNode.id = this.config_id;
        this.container = 'ol3_viewer_' + this.config_id;
        this.image_config = this.context.getImageConfig(this.config_id);

        this.viewer =
            new ol3.Viewer(this.image_config.image_info.image_id,
                { eventbus : this.context.eventbus,
                  server : this.context.server,
                  container: this.container
                });
        this.subscribe();
        this.showRegions(this.image_config.image_info.show_regions);
    }

    updateRegionsVisibility(flag = false, rois = []) {
        if (!this.image_config.image_info.show_regions ||
            rois.length === 0) return;

        this.viewer.setRegionsVisibility(flag, rois);
    }

    showRegions(value) {
        if (value) {
            this.viewer.addRegions();
            this.viewer.setRegionsVisibility(true, []);
            this.viewer.setRegionsModes(
                [ol3.REGIONS_MODE.TRANSLATE,
                ol3.REGIONS_MODE.MODIFY]);
            this.viewer.enableRegionsContextMenu(true);
        } else {
            this.viewer.enableRegionsContextMenu(false);
            this.viewer.setRegionsModes([ol3.REGIONS_MODE.DEFAULT]);
            this.viewer.setRegionsVisibility(false, []);
            for (var [key, value] of this.image_config.regions_info.data)
                this.image_config.regions_info.data.get(key).selected = false;
        }
    }

    unbind() {
        this.unsubscribe();
        if (this.viewer) this.viewer.destroyViewer();
        this.viewer = null;
        this.image_config = null;
    }

    forceUpdate()  {
        this.showRegions(this.image_config.image_info.show_regions);

        var presentZ = this.viewer.getDimensionIndex('z');
        var presentT = this.viewer.getDimensionIndex('t');
        var newZ = this.image_config.image_info.dimensions.z;
        var newT = this.image_config.image_info.dimensions.t;

        if (presentZ !== newZ)
            this.viewer.setDimensionIndex.apply(
                this.viewer, ['z'].concat([newZ]));

        if (presentT !== newT)
        this.viewer.setDimensionIndex.apply(
            this.viewer, ['t'].concat([newT]))
    }
}
