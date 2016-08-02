import {noView} from 'aurelia-framework';
import {EVENTS, EventSubscriber} from '../events/events';
import Misc from '../utils/misc';

@noView
export default class RegionsInfo extends EventSubscriber {
    image_info = null;
    regions_image_id = null;
    selectedShape = null;
    data = new Map();
    sub_list = [
        [EVENTS.RESET_COMPONENT, () => {
            this.data = new Map(); this.regions_image_id = null;}],
        [EVENTS.UPDATE_COMPONENT, (params={}) => {
            if (params.config_id !== this.image_info.config_id) return;
            this.requestData(true)}],
        [EVENTS.REGION_DESELECTED, (params={}) => {
            if (params.config_id !== this.image_info.config_id) return;
            this.deselectShape(params.id);}],
        [EVENTS.REGION_SELECTED, (params={}) => {
            if (params.config_id !== this.image_info.config_id) return;
            this.selectShape(params.id)}],
        [EVENTS.SHAPES_ADDED, (params={}) => {
            if (params.config_id !== this.image_info.config_id ||
                !Misc.isArray(params.shapes)) return;
            params.shapes.map((item) => {
                let id = item.oldId;
                this.data.set(id,
                    Object.assign(
                        {selected: false, visible: true, shape_id: id,
                         deleted: false, modified: false},
                        this.convertShapeObject(item)));
            });}],
        [EVENTS.SHAPES_DELETED, (params={}) => {
            if (params.config_id !== this.image_info.config_id ||
                !Misc.isArray(params.ids)) return;
            params.ids.map((id) => {
                let i = this.data.get(id);
                if (i) i.deleted = true;
            });}],
        [EVENTS.SHAPES_MODIFIED, (params={}) => {
            if (params.config_id !== this.image_info.config_id ||
                !Misc.isArray(params.ids)) return;
            params.ids.map((id) => {
                let i = this.data.get(id);
                if (i) i.modified = true;
            });}],
        [EVENTS.SHOW_REGIONS, () => this.requestData(false) ]];

    constructor(image_info) {
        super(image_info.context.eventbus);
        this.image_info = image_info;
    }

    bind() {
        this.subscribe();
    }

    unbind() {
        this.unsubscribe();
        this.data.clear();
        this.selectedShape = null;
        this.image_info = null;
    }

    selectShape(roi) {
        this.setRegionProperty(roi, "selected", true);
        this.setSelected();
    }

    deselectShape(roi) {
        this.setRegionProperty(roi, "selected", false);
        this.setSelected();
    }

    setSelected() {
        this.selectedShape = null;
        for (let [key, value] of this.data) {
            if (value.selected) {
                this.selectedShape = value;
                break;
            }
        }
    }

    convertShapeObject(shape) {
        if (typeof shape['@type'] === 'string') {
            let hash = shape['@type'].lastIndexOf("#");
            if (hash !== -1)
                shape.type = shape['@type'].substring(hash+1);
        }
        if (typeof shape.FillColor === 'number') {
            let fill = Misc.convertSignedIntegerToHexColor(shape.FillColor);
            shape.fillColor = fill.hex;
            shape.fillAlpha = fill.alpha;
        }
        if (typeof shape.StrokeWidth === 'object')
            shape.strokeWidth = shape.StrokeWidth.Value;
        if (typeof shape.StrokeColor === 'number') {
            let stroke = Misc.convertSignedIntegerToHexColor(shape.StrokeColor);
            shape.strokeColor = stroke.hex;
            shape.strokeAlpha = stroke.alpha;
        }
        if (typeof shape.Text === 'string')
            shape.textValue = shape.Text;
        if (typeof shape.FontStyle === 'string')
            shape.fontStyle = shape.FontStyle;
        if (typeof shape.FontFamily === 'string')
            shape.fontFamily = shape.FontFamily;
        if (typeof shape.FontSize === 'object')
            shape.fontSize = shape.FontSize.Value;

        return shape;
    }

    setRegionProperty(roi, property, value = null) {
        if (typeof roi !== 'string' || roi.indexOf(":") <1 ||
            typeof property !== 'string' || value === null ||
            typeof this.data.get(roi) === 'undefined') return;

        this.data.get(roi)[property] = value;
    }

    requestData(forceUpdate = false) {
        if (forceUpdate) {
            this.data.clear();
            this.regions_image_id = null;
        }
        if (!this.image_info.show_regions ||
            (!forceUpdate &&
                 this.regions_image_id === this.image_info.image_id)) return;

        this.regions_image_id = this.image_info.image_id;

        let url = this.image_info.context.server + "/webgateway/get_rois_json/" +
         this.image_info.image_id + '/';
        let dataType = "json";
        if (Misc.useJsonp(this.image_info.context.server)) dataType += "p";

        $.ajax(
            {url : url,
            dataType : dataType,
            cache : false,
            success : (response) => {
                if (typeof response !== 'object' ||
                 typeof response.length !== 'number') return;

                 response.map((item) => {
                     if (typeof item.shapes === 'object' &&
                      typeof item.shapes.length === 'number')
                      item.shapes.map((shape) => {
                          shape.visible = true;
                          shape.selected = false;
                          shape.deleteted = false;
                          shape.modified = false;
                          shape.shape_id = "" + item.id + ":" + shape.id;
                          this.data.set(
                              shape.shape_id, Object.assign({}, shape));
                          this.image_info.context.publish(
                              EVENTS.VIEWER_RESIZE,
                          {config_id: this.image_info.config_id});
                      })});
             },
            error : (error) => this.data.clear()
        });
    }
}
