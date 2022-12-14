import {listen} from 'ol/events';
import EventType from 'ol/events/EventType';
import Control from 'ol/control/Control';
import {CLASS_UNSELECTABLE, CLASS_CONTROL } from 'ol/css';
import MapBrowserPointerEvent from 'ol/MapBrowserPointerEvent';

export class Mirror extends Control {
    /**
     * @constructor
     * @param {ol.Map=} map openlayers map.
     * @param {ol.control.FlipOptions=} opt_options options. (className, target)
     */
     constructor(map,opt_options) {
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
        
        this.setMap(map)

        var cssClasses =
            this.class_name_ + ' ' + CLASS_UNSELECTABLE + ' ' +
                CLASS_CONTROL;

        element.className = cssClasses;
        var buttonGroup = document.createElement('div');
        buttonGroup.className = "btn-group btn-group-sm ol-flip-buttons";
        buttonGroup.appendChild(this.addFlipButton(false));
        buttonGroup.appendChild(this.addFlipButton(true));
        element.appendChild(buttonGroup);

        this.view = this.getMap().getView()

        this.view.flipX = false
        this.view.flipY = false

        this.view.constrainCenter_ = this.view.constrainCenter
        this.view.constrainCenter = (center) => {
            let curCenter = this.view.getCenter()
            if (this.view.flipX) {
                center[0] = curCenter[0]-(center[0]-curCenter[0])
            }
            if (this.view.flipY) center[1] = curCenter[1]-(center[1]-curCenter[1])
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
  
    handleClick_(event) {
        // 0 axis if vertical ( flip y over x axis )
        // 1 axis if hortizontal ( flip x over y axis )
        event.preventDefault();
        var viewport = this.getMap().getViewport().children[0] // (mirror just tiles)
        var axis = event.target.className.indexOf("ol-flip-vertical") !== -1 ? 0 : 1;
        
        // set desired transform and record in view
        let transform;
        if (axis == 0) { 
            transform="scaleY(-1)"
            this.view.flipY=!(this.view.flipY)

        } else {
            transform="scaleX(-1)"
            this.view.flipX=!(this.view.flipX)
        }

        // if it is already mirrored remove mirror, otherwise add mirror
        viewport.style.transform = viewport.style.transform.includes(transform) ?
            viewport.style.transform.replace(transform, "") : 
            viewport.style.transform + transform
        return true
    }

}
export default Mirror
