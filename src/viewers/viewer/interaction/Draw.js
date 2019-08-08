//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

import PluggableMap from 'ol/PluggableMap';
import Feature from 'ol/Feature';
import Text from 'ol/style/Text';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Style from 'ol/style/Style';
import {unByKey} from 'ol/Observable';
import Collection from 'ol/Collection';
import OlDraw from 'ol/interaction/Draw';
import {noModifierKeys,
    primaryAction} from 'ol/events/condition';
import Ellipse from '../geom/Ellipse';
import Label from '../geom/Label';
import Line from '../geom/Line';
import Point from '../geom/Point';
import Polygon from '../geom/Polygon';
import Rectangle from '../geom/Rectangle';
import Regions from '../source/Regions';
import {getUid} from 'ol/util';
import {isArray,
    sendEventNotification} from '../utils/Misc';
import {REGIONS_STATE,
    DEFAULT_LINE_CAP,
    DEFAULT_LINE_JOIN,
    DEFAULT_MITER_LIMIT} from '../globals';
import {updateStyleFunction,
    measureTextDimensions} from '../utils/Style';
import {toJsonObject,
    convertColorObjectToRgba,
    convertSignedIntegerToColorObject} from '../utils/Conversion';

/**
 * DrawEventType is not exported from ol/interaction/Draw
 * so we have to redefine it here:
 */
const DrawEventType = {
    /**
     * Triggered upon feature draw start
     * @event DrawEvent#drawstart
     * @api
     */
    DRAWSTART: 'drawstart',
    /**
     * Triggered upon feature draw end
     * @event DrawEvent#drawend
     * @api
     */
    DRAWEND: 'drawend'
};

/**
 * Extend the ol.Draw class so we can handle start, move and finish events and
 * display the ShapeEditPopup overlay
 */
class DrawWithPopup extends OlDraw {

    /**
     * Override to refresh the ShapeEditPopup when we start drawing
     *
     * @param {Object} event
     */
    startDrawing_(event) {
        // Save the map reference for finishDrawing()
        this.map = event.map;
        let result = super.startDrawing_(event);
        if (this.sketchFeature_) {
            event.map.getOverlays().forEach(o => {
                if (o.showPopupForShape) {
                    o.showPopupForShape(this.sketchFeature_);
                }
            });
        }
        return result;
    }

    /**
     * Override to update the ShapeEditPopup as the shape is being created
     * NB: Popup won't have any shapeId or text at this point - Just updates
     * the currently visible popup.
     *
     * @param {Object} event
     */
    handlePointerMove_(event) {
        if (this.sketchFeature_) {
            event.map.getOverlays().forEach(o => {
                if (o.updatePopupCoordinates) {
                    o.updatePopupCoordinates(this.sketchFeature_.getGeometry());
                }
            });
        }
        return super.handlePointerMove_(event);
    }

    /**
     * Override to update the shapeId of the Popup dialog so we can use
     * it to edit shape Label etc.
     */
    finishDrawing() {
        let feature = this.sketchFeature_;
        // Calling the super.finishDrawing() sets the shape ID...
        let result = super.finishDrawing();
        // ...allowing us to update the Popup's shapeId
        if (this.map instanceof PluggableMap && feature) {
            this.map.getOverlays().forEach(o => {
                if (o.showPopupForShape) {
                    o.showPopupForShape(feature);
                }
            });
        }
        return result;
    }
}

/**
 * @classdesc
 * Encapsulates the drawing logic. This 'interaction' differs from others
 * in that it does not extend its openlayers parent but rather wraps it
 * to achieve the desired behavior of drawing shapes
*/
class Draw {

    /**
     * @constructor
     * 
     * @param {Array} previous_modes the previously set interaction modes on the regions
     * @param {source.Regions} regions_reference an Regions instance.
    */
    constructor(previous_modes, regions_reference) {
        if (!isArray(previous_modes))
            console.error("Draw needs the prevously set modes as an array");

        // we do need the regions reference to do translations
        if (!(regions_reference instanceof Regions))
            console.error("Draw needs Regions instance!");

        /**
         * optional parameters
         * @type {Object}
         * @private
         */
        this.opts_ = {};

        /**
         * @type {source.Regions}
         * @private
         */
        this.regions_ = regions_reference;

        /**
         * array of moded presently used
         *
         * @type {Array}
         * @private
         */
        this.previous_modes_ = previous_modes;

        /**
         * the contained open layers draw interaction
         *
         * @type {OlDraw}
         * @private
         */
        this.ol_draw_ = null;

        /**
         * the history id
         *
         * @type {number}
         * @private
         */
        this.history_id_ = null;

        /**
         * the roi id
         *
         * @type {number}
         * @private
         */
        this.roi_id_ = 0;

        /**
         * forces simple line
         *
         * @type {boolean}
         * @private
         */
        this.abort_polyline_ = false;

        /**
         * the default style used for drawing
         *
         * @type {Object}
         * @private
         */
        this.default_style_ = null;
    };

    /**
     * Delegates to the openayers draw interaction wit a custom geometry function
     * that lets us use our own geometry classes which is not done for all types.
     * This method is called internally. Use {@link Draw.drawShape}
     * instead
     *
     * @private
     * @param {string} ol_shape the open layers shape type as a string
     * @param {string} shape_type the shape type as used within omero
     * @param {function} geometryFunction a custom geometry function
     */
    drawShapeCommonCode_(ol_shape, shape_type, geometryFunction) {
        if (typeof(ol_shape) !== 'string' || typeof(shape_type) !== 'string' ||
            ol_shape.length === 0 || shape_type.length === 0) return;

        // This is needed within onDrawEndAction
        let self = this;

        // called after drawing the shape
        var onDrawEndAction = function(event) {
            if (event.feature instanceof Feature) {
                // set id, type and state as new
                event.feature.setId(
                    (typeof self.roi_id_ === 'number' && self.roi_id_ < 0 ?
                        "" + self.roi_id_ + ":" :
                        "-1:") + (-getUid(event.feature)));
                event.feature['state'] = REGIONS_STATE.ADDED;
                event.feature['type'] = shape_type;

                // set t and z info
                var hasUnattachedDims =
                    isArray(self.opts_['unattached']) &&
                    self.opts_['unattached'].length > 0;
                event.feature['TheT'] =
                    hasUnattachedDims &&
                    self.opts_['unattached'].indexOf('t') !== -1 ?
                        -1 : self.regions_.viewer_.getDimensionIndex('t');
                event.feature['TheZ'] =
                    hasUnattachedDims &&
                    self.opts_['unattached'].indexOf('z') !== -1 ?
                        -1 : self.regions_.viewer_.getDimensionIndex('z');
                event.feature['TheC'] = -1;

                // apply style function after setting a default style
                event.feature.setStyle(self.default_style_);
                updateStyleFunction(event.feature, self.regions_, true);
                // calculate measurements
                self.regions_.getLengthAndAreaForShape(event.feature, true);

                var add =
                    typeof self.opts_['add'] !== 'boolean' || self.opts_['add'];
                if (add) self.regions_.addFeature(event.feature);

                if (self.regions_.viewer_.eventbus_) {
                    var hist_id = self.history_id_;
                    if (self.roi_id_ < 0) event.feature['roi_id'] = self.roi_id_;
                    var newRegionsObject = toJsonObject(
                            new Collection([event.feature]), false);
                    if (typeof newRegionsObject !== 'object' ||
                        !isArray(newRegionsObject['new']) ||
                        newRegionsObject['new'].length === 0) return;
                    var opts = {
                        "shapes": newRegionsObject['new'],
                        "drawn" : true, "add": add
                    };
                    if (typeof hist_id === 'number') opts['hist_id'] = hist_id;
                    if (typeof event.feature['roi_id'] === 'number')
                        opts['roi_id'] = event.feature['roi_id'];

                    sendEventNotification(
                        self.regions_.viewer_, "REGIONS_SHAPE_GENERATED",
                        opts, 25);
                }
                self.history_id_ = null;
                self.rois_id_ = 0;
            }

            self.endDrawingInteraction(false);
        };

        // create a new draw interaction removing possible existing ones first
        if (this.ol_draw_)
            this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
        this.ol_draw_ = new DrawWithPopup({
            style: this.default_style_function_,
            type: ol_shape,
            condition: function(e) {
                // ignore right clicks (from context)
                return noModifierKeys(e) && primaryAction(e);
            },
            geometryFunction:
                typeof(geometryFunction) === 'function' ?
                    geometryFunction : null
        });

        // add start and end handlers for the drawing action
        this.regions_.viewer_.viewer_.addInteraction(this.ol_draw_);
        if (this.abort_polyline_)
            this.ol_draw_.once(
                DrawEventType.DRAWSTART,
                function(e) {
                    var f = e.feature;
                    var changeHandler =
                        f.getGeometry().on(
                            'change', function(e) {
                                var geom = e.target;
                                if (geom.getCoordinates().length >= 3) {
                                    unByKey(changeHandler);
                                    self.ol_draw_.finishDrawing();
                                }
                        }, this);
                    }, this);

        // The 'this' argument seems to be ignored.
        // So onDrawEndAction() uses 'self' instead.
        this.ol_draw_.on(DrawEventType.DRAWEND, onDrawEndAction, this);
    }

    /**
     * This method starts the drawing interaction with a shape defintion (incl. type)
     *
     * @param {Object} shape the shape definition (incl. type)
     * @param {number} roi_id a roi id that gets incorporated into the id (for grouping)
     * @param {Object=} opts optional parameters such as:
     *                       an history id (hist_id) to pass through,
     *                       a list of unattached dimensions (unattached) or
     *                       a flag to not add the new shape (add)
     */
    drawShape(shape, roi_id, opts) {
        this.opts_ = opts || {};
        this.abort_polyline_ = false;
        if (typeof(shape['type']) !== 'string' || shape['type'].length === 0) {
            this.history_id_ = null;
            this.roi_id_ = 0;
            // TODO: Handle Drawend: OlDraw.Event doesn't exist!
            this.dispatchEvent(new OlDraw.Event(
                DrawEventType.DRAWEND, null));
            return;
        }

        this.roi_id_ = (typeof roi_id === 'number' && roi_id < 0) ? roi_id : -1;
        if (typeof this.opts_['hist_id'] === 'number')
            this.history_id_ = this.opts_['hist_id'];
        var typeFunction = null;
        switch(shape['type'].toLowerCase()) {
            case "point" :
                typeFunction = Draw.prototype.drawPoint_;
                break;
            case "polygon" :
                typeFunction = Draw.prototype.drawPolygon_;
                break;
            case "ellipse" :
                typeFunction = Draw.prototype.drawEllipse_;
                break;
            case "polyline" :
                typeFunction = Draw.prototype.drawPolyLine_;
                break;
            case "line" :
                typeFunction = Draw.prototype.drawLine_;
                break;
            case "arrow":
                typeFunction = Draw.prototype.drawArrow_;
                break;
            case "rectangle" :
                typeFunction = Draw.prototype.drawRectangle_;
                break;
            case "label" :
                typeFunction = Draw.prototype.drawLabel_;
                break;
            default:
                this.regions_.setModes(this.previous_modes_);
                return;
        };
        this.setDefaultDrawingStyle(shape);
        typeFunction.call(this);
    }

    /**
     * Sets the drawing style using defaults or the shape definition
     *
     * @param {Object} shape the shape definition
     */
    setDefaultDrawingStyle(shape) {
        // reset previous defaults
        this.default_style_function_ = null;
        this.default_style_ = null;
        // some fallback styles
        var transWhite = "rgba(255,255,255,0.5)";
        var blue = "rgba(0, 153, 255, 0.9)";
        var isLabel = shape['type'] === 'label';
        var needsStroke =
            shape['type'] === 'line' || shape['type'] === 'arrow' ||
            shape['type'] === 'point';

        // determine fill and stroke using defaults if not supplied
        var defaultFill =
            typeof shape['FillColor'] === 'number' ?
                convertSignedIntegerToColorObject(shape['FillColor']) : null;
        if (defaultFill === null) defaultFill = transWhite;
        else defaultFill = convertColorObjectToRgba(defaultFill);
        var defaultStroke = {
            'color': typeof shape['StrokeColor'] === 'number' ?
                        convertSignedIntegerToColorObject(
                            shape['StrokeColor']) : null,
            'width': (typeof shape['StrokeWidth'] === 'object' &&
                    shape['StrokeWidth'] !== null &&
                    typeof shape['StrokeWidth']['Value'] === 'number') ?
                        shape['StrokeWidth']['Value'] : 1,
            'lineCap': DEFAULT_LINE_CAP,
            'lineJoin': DEFAULT_LINE_JOIN,
            'miterLimit': DEFAULT_MITER_LIMIT
        };
        if (defaultStroke['color'] === null) defaultStroke['color'] = blue;
        else defaultStroke['color'] =
            convertColorObjectToRgba(defaultStroke['color']);
        if (needsStroke && defaultStroke['width'] === 0)
            defaultStroke['width'] = 1;
        else if (isLabel) defaultStroke['width'] = 0;

        // set default style
        var defStyle = {
            'stroke': new Stroke(defaultStroke)
        };
        if (!isLabel) defStyle['fill'] = new Fill({color: defaultFill});
        this.default_style_ = new Style(defStyle);

        // set default style function for sketching
        this.default_style_function_ = function(feature, resolution) {
            var optSketchFeature = this.ol_draw_.sketchFeature_;
            var geom =
                optSketchFeature ?
                    optSketchFeature.getGeometry() : feature.getGeometry();

            // we don't have a sketch feature to style
            if (optSketchFeature === null) return null;

            // for sketching labels
            if (geom instanceof Label) {
                var text =
                    new Text(
                        {
                        overflow: true,
                        text: "TEXT",
                        font: "normal " + geom.getHeight() + "px sans-serif",
                        fill: new Fill(
                            {color: this.default_style_.getStroke().getColor()})
                        });
                //adjust scale and rotation
                var rot = this.regions_.viewer_.viewer_.getView().getRotation();
                if (rot !== 0 && !this.regions_.rotate_text_) text.setRotation(rot);
                text.setScale(1/resolution);
                this.default_style_.text_ = text;
            }

            var ret = [this.default_style_];
            // for sketching arrows
            if (geom instanceof Line && geom.has_end_arrow_) {
                var lineStroke = this.default_style_.getStroke();
                var strokeWidth = lineStroke.getWidth() || 1;
                var arrowBaseWidth = 15 * resolution;

                var arrowStyle =
                    new Style({
                        geometry:
                            geom.getArrowGeometry(
                                true, arrowBaseWidth, arrowBaseWidth),
                        fill: new Fill({'color': lineStroke.getColor()}),
                        stroke: lineStroke
                });
                ret.push(arrowStyle);
            };

            optSketchFeature.setStyle(ret);
            return null;
        }.bind(this);
    }


    /**
     * Ends an active drawing interaction
     * @param {boolean} reset if true (default) we reset back to the previous mode
     */
    endDrawingInteraction(reset) {
        if (this.ol_draw_) {
            this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
            this.ol_draw_ = null;
            if (typeof reset !== 'boolean' || reset)
                this.regions_.setModes(this.previous_modes_);
        }
    }

    /**
     * Drawing interaction for Polygons
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPolygon_(event) {
        this.drawShapeCommonCode_('Polygon', 'polygon',
            function(coordinates, opt_geometry) {
                var geometry = new Polygon(coordinates);

                if (opt_geometry) {
                    opt_geometry.setCoordinates(geometry.getCoordinates());
                }

                return geometry;
            });
    }

    /**
     * Drawing interaction for polylines
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPolyLine_(event) {
        this.drawShapeCommonCode_('LineString', 'polyline',
            function(coordinates, opt_geometry) {
                var geometry = new Line(coordinates);

                if (opt_geometry) {
                    opt_geometry.setCoordinates(geometry.getCoordinates());
                }

                return geometry;
            });
    }

    /**
     * Drawing interaction for lines (delegates to polyline)
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawLine_(event) {
        this.abort_polyline_ = true;
        this.drawPolyLine_();
    }

    /**
     * Drawing interaction for (Poly)Lines with arrow heads
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawArrow_(event) {
        this.abort_polyline_ = true;
        this.drawShapeCommonCode_('LineString', 'polyline',
            function(coordinates, opt_geometry) {
                var geometry = new Line(coordinates, false, true);
                if (opt_geometry) {
                    opt_geometry.setCoordinates(geometry.getCoordinates());
                }

                return geometry;
            });
    }

    /**
     * Drawing interaction for Points
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPoint_(event) {
        this.drawShapeCommonCode_('Point', "point",
            function(coordinates, opt_geometry) {
                return new Point(coordinates);
        });
    }

    /**
     * Drawing interaction for Rectangles
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawRectangle_(event) {
        this.drawShapeCommonCode_('Circle', "rectangle",
            function(coordinates, opt_geometry) {
                var supposedTopLeft = coordinates[0];
                var end = coordinates[1];
                var w = Math.abs(end[0] - supposedTopLeft[0]);
                var h = Math.abs(supposedTopLeft[1] - end[1]);
                if (w === 0) w = 1;
                if (h === 0) h = 1;
                var topLeftX = end[0] < supposedTopLeft[0] ?
                    end[0] : supposedTopLeft[0];
                var topLeftY = end[1] > supposedTopLeft[1] ?
                    end[1]: supposedTopLeft[1];

                var geometry = new Rectangle(topLeftX, topLeftY, w, h);

                if (opt_geometry) {
                    opt_geometry.setUpperLeftCorner(geometry.getUpperLeftCorner());
                    opt_geometry.setWidth(geometry.getWidth());
                    opt_geometry.setHeight(geometry.getHeight());
                }

                return geometry;
        });
    }

    /**
     * Drawing interaction for Labels
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawLabel_(event) {
        var height = this.regions_.viewer_.getDimensionIndex('y');

        this.drawShapeCommonCode_('Circle', "label",
            function(coordinates, opt_geometry) {

                var supposedTopLeft = coordinates[0];
                var end = coordinates[1];
                var h = Math.abs(supposedTopLeft[1] - end[1]);
                if (h === 0) h = 1;
                var topLeftX = end[0] < supposedTopLeft[0] ?
                    end[0] : supposedTopLeft[0];
                var topLeftY = end[1] > supposedTopLeft[1] ?
                    end[1]: supposedTopLeft[1];

                var fontDims = measureTextDimensions(
                        "TEXT", "normal " + parseInt(h) + "px sans-serif");
                var geometry = new Label(topLeftX, topLeftY, fontDims);

                if (opt_geometry) {
                    opt_geometry.setUpperLeftCorner(geometry.getUpperLeftCorner());
                    opt_geometry.setWidth(geometry.getWidth());
                    opt_geometry.setHeight(geometry.getHeight());
                }

                return geometry;
        });
    }

    /**
     * Drawing interaction for Ellipses
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawEllipse_(event) {
        this.drawShapeCommonCode_('Circle', "ellipse",
            function(coordinates, opt_geometry) {
                var center = coordinates[0];
                var end = coordinates[1];
                var rx = Math.abs(center[0]-end[0]);
                var ry =  Math.abs(center[1]- end[1]);
                var geometry =
                    new Ellipse(center[0], center[1], rx,ry);

                if (opt_geometry) {
                    opt_geometry.setCoordinates(geometry.getCoordinates());
                    opt_geometry.setRadius(geometry.getRadius());
                }

                return geometry;
        });
    }

    /**
     * a sort of desctructor
     */
    dispose() {
        if (this.ol_draw_) {
            this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
            this.ol_draw_ = null;
            this.previous_modes_ = null;
        }
        this.regions_ = null;
    }
}

export default Draw;
