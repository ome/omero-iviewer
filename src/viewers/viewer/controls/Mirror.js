import {listen} from 'ol/events';
import EventType from 'ol/events/EventType';
import Control from 'ol/control/Control';
import {CLASS_UNSELECTABLE, CLASS_CONTROL } from 'ol/css';
import DragPan from 'ol/interaction/DragPan';

export class Mirror extends Control {
    /**
     * @constructor
     * @param {ol.control.MirrorOptions=} opt_options options. (className, target, flipX, flipY)
     */
    constructor(opt_options) {
        const options = opt_options || {};

        const element = document.createElement('div');
        super({
            element: element,
            target: options.target
        });

        this.class_name_ = typeof options.className === 'string' ? options.className : 'ol-flip';

        this.ref_ = null;  // reference for handling events
        
        this.view = null;  // Map view reference
        
        this.initFlipX = typeof options.flipX === 'boolean' ? options.flipX : false;
        this.initFlipY = typeof options.flipY === 'boolean' ? options.flipY : false;

        const cssClasses = this.class_name_ + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;

        // Create button elements for flipping
        element.className = cssClasses;
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'btn-group btn-group-sm ol-flip-buttons';
        buttonGroup.appendChild(this.addFlipButton(false));
        buttonGroup.appendChild(this.addFlipButton(true));
        element.appendChild(buttonGroup);

        // Map setter override to initialize on map setup
        this.setMap_ = this.setMap;
        this.setMap = (map) => {
            this.setMap_(map);
            if (map != null) this.init();
        };
    }

    /**
     * Adds a flip button for horizontal or vertical flip
     * @param {boolean} flip_vertical Adds vertical flip if true, else horizontal
     * @private
     */
    addFlipButton(flip_vertical) {
        const title = `Flip ${flip_vertical ? 'vertical' : 'horizontal'}`;
        const element = document.createElement('button');
        element.className = this.class_name_ + (flip_vertical ? '-vertical glyphicon-resize-vertical' : '-horizontal glyphicon-resize-horizontal') +
            ' btn btn-default btn-primary glyphicon ol-flip-button';
        element.setAttribute('type', 'button');
        element.title = title;

        listen(element, EventType.CLICK, this.handleClick_, this);

        return element;
    }

    /**
     * Initialization on map setup
     */
    init() {
        const map = this.getMap()
        this.view = map.getView();

        map.getControls().getArray().forEach((control) => {
            if ('birds_eye_' in control) {
                this.birdseye = control;
                return;
            }
        });
        
        map.getInteractions().getArray().forEach((interaction) => {
            if (interaction instanceof DragPan){
                interaction.updateTrackedPointers__ = interaction.updateTrackedPointers_
                interaction.updateTrackedPointers_ = (mapBrowserEvent) => {
                    if (this.view.get('flipX')) mapBrowserEvent.pointerEvent.clientX = mapBrowserEvent.pointerEvent.view.innerWidth - mapBrowserEvent.pointerEvent.clientX
                    if (this.view.get('flipY')) mapBrowserEvent.pointerEvent.clientY = mapBrowserEvent.pointerEvent.view.innerHeight - mapBrowserEvent.pointerEvent.clientY
                    return interaction.updateTrackedPointers__(mapBrowserEvent)
                }
            }
        })

        // Override getEventPixel to mirror the event based on flip state
        map.getEventPixel = (evt) => {
            const viewport = this.getMap().getViewport();
            const viewportPosition = viewport.getBoundingClientRect();
            const eventPosition = 'changedTouches' in evt ? evt.changedTouches[0] : evt;
        
            let x = eventPosition.clientX - viewportPosition.left;
            let y = eventPosition.clientY - viewportPosition.top;
        
            // Apply flip transformations if necessary
            if (this.view.get('flipX')) x = viewportPosition.width - x;
            if (this.view.get('flipY')) y = viewportPosition.height - y;
        
            return [x, y];
        };

        if (this.initFlipX) this.flip(1);
        if (this.initFlipY) this.flip(0);
    }

    /**
     * Apply or remove the flip transformation based on the axis
     * @param {number} axis 0 for vertical flip (Y), 1 for horizontal flip (X)
     */
    flip(axis) {
        const viewport = this.getMap().getViewport().children[0]; // Mirror only the tiles
        const selectionBox = this.getMap().getViewport().children[1]
        const isY = (axis === 0);
        const transformType = isY ? 'scaleY(-1)' : 'scaleX(-1)';
        const viewProp = isY ? 'flipY' : 'flipX';

        // Toggle the flip state in the view properties
        const currentFlipState = this.view.get(viewProp);
        this.view.set(viewProp, !currentFlipState);

        // Update the viewport style transform
        viewport.style.transform = currentFlipState ?
            viewport.style.transform.replace(transformType, '') :
            viewport.style.transform + ` ${transformType}`;

        selectionBox.style.transform = currentFlipState ?
            selectionBox.style.transform.replace(transformType, '') :
            selectionBox.style.transform + ` ${transformType}`;
        // Handle birds-eye control if present
        if (this.birdseye && this.birdseye.controlDiv_) {
            const birdseyeDiv = this.birdseye.controlDiv_;
            birdseyeDiv.style.transform = currentFlipState ?
                birdseyeDiv.style.transform.replace(transformType, '') :
                birdseyeDiv.style.transform + ` ${transformType}`;
        }
    }

    /**
     * Handle button click for flipping the map
     * @param {Event} event Button click event
     * @private
     */
    handleClick_(event) {
        event.preventDefault();
        event.target.style.backgroundColor = event.target.style.backgroundColor === 'dodgerblue' ? '' : 'dodgerblue'
        
        const axis = event.target.className.includes('ol-flip-vertical') ? 0 : 1;
        this.flip(axis);

        return true;
    }
}

export default Mirror;