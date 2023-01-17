import {listen} from 'ol/events';
import EventType from 'ol/events/EventType';
import Control from 'ol/control/Control';
import {CLASS_UNSELECTABLE, CLASS_CONTROL } from 'ol/css';
import { rotate } from 'ol/coordinate';

export class Mirror extends Control {
    /**
     * @constructor
     * @param {ol.control.MirrorOptions=} opt_options options. (className, target)
     */
     constructor(opt_options) {
        var options = opt_options ? opt_options : {};

        var element = document.createElement('div');
        super({
            element: element,
            target: options.target
        });

        /**
        * @type {string}
        * @private
        */
        this.class_name_ =
            options.className === 'string' ? options.className : 'ol-flip';

        /**
         * @type {MapBrowserPointerEvent}
         * @private
         */
        this.ref_ = null

        /**
         * @type {View}
         */
        this.view = null

        /**
         * @type {boolean}
         * Sets default x inversion
         */
        this.flipX = 
            typeof options.flipX == "boolean" ? options.flipX : false

        /**
         * @type {boolean}
         * Sets default y inversion
         */
        this.flipY = 
            typeof options.flipY == "boolean" ? options.flipY : false

        var cssClasses =
            this.class_name_ + ' ' + CLASS_UNSELECTABLE + ' ' +
                CLASS_CONTROL;

        // create button elements
        element.className = cssClasses;
        var buttonGroup = document.createElement('div');
        buttonGroup.className = "btn-group btn-group-sm ol-flip-buttons";
        buttonGroup.appendChild(this.addFlipButton(false));
        buttonGroup.appendChild(this.addFlipButton(true));
        element.appendChild(buttonGroup);

        // need a map to finish intitialization
        this.setMap_ = this.setMap
        this.setMap = (map) => {
            this.setMap_(map)
            if (map != null) this.init()
        }
    }

    /**
     * Adds both, flip vertical and horizontal buttons
     * @param {boolean} flip_vertical the vertical flip button is added if true, otherwise horizontal
     * @private
     */
     addFlipButton(flip_vertical) {
        if (typeof flip_vertical !== 'boolean') flip_vertical = false;

        var title = 'Flip ' + (flip_vertical ? 'vertical' : 'horizontal');
        var element = document.createElement('button');
        element.className =
            this.class_name_ + (flip_vertical ? '-vertical glyphicon-resize-vertical' : '-horizontal glyphicon-resize-horizontal') +
            " btn btn-default glyphicon ol-flip-button";
        element.setAttribute('type', 'button');
        element.title = title;

        listen(element, EventType.CLICK, this.handleClick_, this);

        return element;
    }

    init(){
        this.view = this.getMap().getView()

        this.getMap().getControls().getArray().forEach((control)=>{
            if ('birds_eye_' in control){
                this.birdseye = control
                return
            }
        })

        this.view.constrainCenter_ = this.view.constrainCenter
        this.view.constrainCenter = (center) => {
            let curCenter = this.view.getCenter()
            let rotation = this.view.getRotation()
            // if there is rotation we need to undo it, mirror coords and then rerotate it
            if (rotation != 0) {
                rotate(center, Math.PI*2 - rotation)
                rotate(curCenter, Math.PI*2 - rotation)
            }
            if (this.view.values_.flipX) center[0] = curCenter[0]-(center[0]-curCenter[0])
            if (this.view.values_.flipY) center[1] = curCenter[1]-(center[1]-curCenter[1])
            if (rotation != 0) rotate(center, rotation)
            return this.view.constrainCenter_(center)
        }

        // override getEventPixel to account for mirroring
        this.map_.getEventPixel = function (evt) {
            const viewportPosition = this.viewport_.getBoundingClientRect();
            const eventPosition =
                //FIXME Are we really calling this with a TouchEvent anywhere?
                'changedTouches' in evt
                ? /** @type {TouchEvent} */ (evt).changedTouches[0]
                : /** @type {MouseEvent} */ (evt);

            let x=eventPosition.clientX - viewportPosition.left
            let y=eventPosition.clientY - viewportPosition.top

            if (this.getView().flipX) x=viewportPosition.width-x
            if (this.getView().flipY) y=viewportPosition.height-y

            return [x,y]
        }
        if (this.flipX) this.flip(1)
        if (this.flipY) this.flip(0)
    }

    // set desired transform and record in view
    flip(axis) {
        var viewport = this.getMap().getViewport().children[0] // (mirror just tiles)
        let transform;
        if (axis == 0) { 
            transform="scaleY(-1)"
            this.view.setProperties({flipY:!(this.view.values_.flipY)})
        } else {
            transform="scaleX(-1)"
            this.view.setProperties({flipX:!(this.view.values_.flipX)})
        }

        // if it is already mirrored remove mirror, otherwise add mirror
        viewport.style.transform = viewport.style.transform.includes(transform) ?
            viewport.style.transform.replace(transform, "") : 
            viewport.style.transform + transform
        this.birdseye.controlDiv_.style.transform = this.birdseye.controlDiv_.style.transform.includes(transform) ?
            this.birdseye.controlDiv_.style.transform.replace(transform, "") : 
            this.birdseye.controlDiv_.style.transform + transform
    }
  
    handleClick_(event) {
        // 0 axis if vertical ( flip y over x axis )
        // 1 axis if hortizontal ( flip x over y axis )
        event.preventDefault();
        var axis = event.target.className.indexOf("ol-flip-vertical") !== -1 ? 0 : 1;
        
        this.flip(axis)
        return true
    }

}
export default Mirror
