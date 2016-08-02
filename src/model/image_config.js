import {noView} from 'aurelia-framework';
import ImageInfo from '../model/image_info';
import RegionsInfo from '../model/regions_info';

@noView
export default class ImageConfig {
    image_info = null;
    regions_info = null;
    locked_dimensions = [];
    locked_to_image_configs = [];

    constructor(context, image_id) {
        this.id = new Date().getTime();
        this.image_info = new ImageInfo(context, this.id, image_id);
        this.regions_info = new RegionsInfo(this.image_info)
    }

    isLockedToImageConfig(image_config) {
        if (typeof image_config !== 'number') return false;

        return this.locked_to_image_configs.filter(
                (entry) => image_config === entry).length > 0;
    }

    isLockedToDimension(dim) {
        if (typeof dim !== 'string') return false;

        return this.locked_dimensions.filter(
                (entry) => dim === entry).length > 0;
    }

    bind() {
        this.image_info.bind();
        this.regions_info.bind();
    }

    unbind() {
        this.image_info.unbind();
        this.regions_info.unbind();
        this.locked_dimensions = [];
        this.locked_to_image_configs = [];
    }
}
