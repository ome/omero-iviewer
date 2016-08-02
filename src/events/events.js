export const EVENTS = {
    IMAGE_INTERACTION : "IMAGE_INTERACTION",
    UPDATE_COMPONENT : "UPDATE_COMPONENT",
    RESET_COMPONENT : "RESET_COMPONENT",
    SELECTED_CONFIG : "SELECTED_CONFIG",
    DIMENSION_CHANGE : "DIMENSION_CHANGE",
    CHANNEL_CHANGE : "CHANNEL_CHANGE",
    SHOW_REGIONS : "SHOW_REGIONS",
    REGIONS_VISIBILITY : "REGIONS_VISIBILITY",
    REGION_SELECTED : "REGION_SELECTED",
    REGION_DESELECTED : "REGION_DESELECTED",
    SELECT_REGIONS : "SELECT_REGIONS",
    MODIFY_REGIONS : "MODIFY_REGIONS",
    DRAW_SHAPE : "DRAW_SHAPE",
    SHAPES_ADDED : "SHAPES_ADDED",
    SHAPES_MODIFIED : "SHAPES_MODIFIED",
    SHAPES_DELETED : "SHAPES_DELETED",
    VIEWER_RESIZE : "VIEWER_RESIZE"
}

export class EventSubscriber {
    subscriptions = [];
    sub_list = [];

    constructor(eventbus) {
        this.eventbus = eventbus;
    }

    subscribe() {
        this.unsubscribe();
        this.sub_list.map(
            (value) => this.subscriptions.push(
                this.eventbus.subscribe(value[0], value[1])
            ));
    }

    unsubscribe() {
        if (this.subscriptions.length === 0) return;
        while (this.subscriptions.length > 0)
            this.subscriptions.pop().dispose();
    }
}
