//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
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

import {REGIONS_STATE} from "../Globals";
import Ellipse from "../geom/Ellipse";
import Rectangle from "../geom/Rectangle";
import Label from "../geom/Label";
import Line from "../geom/Line";
import Polygon from "../geom/Polygon";
import Regions from "../source/Regions";
import Point from "../geom/Point";
import * as StyleUtils from "../utils/Style";
import * as ConversionUtils from "../utils/Conversion";
import * as MiscUtils from "../utils/Misc";

import ol from "ol";
import DrawOl from 'ol/interaction/draw';
import Fill from "ol/style/fill";
import Text from "ol/style/text";
import Event from 'ol/events/event';
import Feature from "ol/feature";
import Stroke from "ol/style/stroke";
import Style from "ol/style/style";
import Collection from "ol/collection";
import EventConditions from 'ol/events/condition';
import Observable from "ol/observable";



/**
 * @classdesc
 * Encapsulates the drawing logic. This 'interaction' differs from others
 * in that it does not extend its openlayers parent but rather wrap it
 * to achieve the desired behavior of drawing shapes
 *
 * @constructor
 * @extends {Object}
 * @param {Array} previous_modes the previously set interaction modes on the regions
 * @param {ome.ol3.source.Regions} regions_reference an Regions instance.
 */
export default class Draw {
    constructor(previous_modes, regions_reference) {
        if (!Array.isArray(previous_modes))
            console.error("Draw needs the previously set modes as an array");

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
         * @type {ome.ol3.source.Regions}
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
         * @type {DrawOl}
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
    }

    /**
     * Delegates to the openayers draw interaction wit a custom geometry function
     * that lets us use our own geometry classes which is not done for all types.
     * This method is called internally. Use {@link ome.ol3.interaction.Draw.drawShape}
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

        // called after drawing the shape
        let onDrawEndAction = (event) => {
            if (event.feature instanceof Feature) {
                // set id, type and state as new
                event.feature.setId(
                    (typeof this.roi_id_ === 'number' && this.roi_id_ < 0 ?
                        "" + this.roi_id_ + ":" :
                        "-1:") + (-ol.getUid(event.feature)));
                event.feature['state'] = REGIONS_STATE.ADDED;
                event.feature['type'] = shape_type;

                // set t and z info
                let hasUnattachedDims =
                    Array.isArray(this.opts_['unattached']) &&
                    this.opts_['unattached'].length > 0;
                event.feature['TheT'] =
                    hasUnattachedDims &&
                    this.opts_['unattached'].indexOf('t') !== -1 ?
                        -1 : this.regions_.viewer_.getDimensionIndex('t');
                event.feature['TheZ'] =
                    hasUnattachedDims &&
                    this.opts_['unattached'].indexOf('z') !== -1 ?
                        -1 : this.regions_.viewer_.getDimensionIndex('z');
                event.feature['TheC'] = -1;

                // apply style function after setting a default style
                event.feature.setStyle(this.default_style_);
                StyleUtils.updateStyleFunction(
                    event.feature, this.regions_, true);
                // calculate measurements
                this.regions_.getLengthAndAreaForShape(event.feature, true);

                let add =
                    typeof this.opts_['add'] !== 'boolean' || this.opts_['add'];
                if (add) this.regions_.addFeature(event.feature);

                let eventbus = this.regions_.viewer_.eventbus_;
                if (this.regions_.viewer_.eventbus_) {
                    let hist_id = this.history_id_;
                    if (this.roi_id_ < 0) event.feature['roi_id'] = this.roi_id_;
                    let newRegionsObject =
                        ConversionUtils.toJsonObject(
                            new Collection([event.feature]), false);
                    if (typeof newRegionsObject !== 'object' ||
                        !Array.isArray(newRegionsObject['new']) ||
                        newRegionsObject['new'].length === 0) return;
                    let opts = {
                        "shapes": newRegionsObject['new'],
                        "drawn": true, "add": add
                    };
                    if (typeof hist_id === 'number') opts['hist_id'] = hist_id;
                    if (typeof event.feature['roi_id'] === 'number')
                        opts['roi_id'] = event.feature['roi_id'];

                    MiscUtils.sendEventNotification(
                        this.regions_.viewer_, "REGIONS_SHAPE_GENERATED",
                        opts, 25);
                }
                this.history_id_ = null;
                this.rois_id_ = 0;
            }

            this.endDrawingInteraction(false);
        };

        // create a new draw interaction removing possible existing ones first
        if (this.ol_draw_)
            this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
        this.ol_draw_ = new DrawOl({
            style: this.default_style_function_,
            type: ol_shape,
            condition: (e) => {
                // ignore right clicks (from context)
                return EventConditions.noModifierKeys(e) &&
                    EventConditions.primaryAction(e);
            },
            geometryFunction:
                typeof(geometryFunction) === 'function' ?
                    geometryFunction : null
        });

        // add start and end handlers for the drawing action
        this.regions_.viewer_.viewer_.addInteraction(this.ol_draw_);
        if (this.abort_polyline_)
            this.ol_draw_.once(DrawOl.DRAWSTART,
                (e) => {
                    let f = e.feature;
                    let changeHandler =
                        f.getGeometry().on(
                            'change', (e) => {
                                let geom = e.target;
                                if (geom.getCoordinates().length >= 3) {
                                    Observable.unByKey(changeHandler);
                                    this.ol_draw_.finishDrawing();
                                }
                            }, this);
                }, this);
        this.ol_draw_.on(
            DrawOl.DRAWEND, onDrawEndAction, this);
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
            this.dispatchEvent(new Event(DrawOl.DRAWEND));
            return;
        }

        this.roi_id_ = (typeof roi_id === 'number' && roi_id < 0) ? roi_id : -1;
        if (typeof this.opts_['hist_id'] === 'number')
            this.history_id_ = this.opts_['hist_id'];
        let typeFunction = null;
        switch (shape['type'].toLowerCase()) {
            case "point" :
                typeFunction = drawPoint_;
                break;
            case "polygon" :
                typeFunction = drawPolygon_;
                break;
            case "ellipse" :
                typeFunction = drawEllipse_;
                break;
            case "polyline" :
                typeFunction = drawPolyLine_;
                break;
            case "line" :
                typeFunction = drawLine_;
                break;
            case "arrow":
                typeFunction = drawArrow_;
                break;
            case "rectangle" :
                typeFunction = drawRectangle_;
                break;
            case "label" :
                typeFunction = drawLabel_;
                break;
            default:
                this.regions_.setModes(this.previous_modes_);
                return;
        }
        this.setDefaultDrawingStyle(shape);
        typeFunction.call(this);
    };

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
        let transWhite = "rgba(255,255,255,0.5)";
        let blue = "rgba(0, 153, 255, 0.9)";
        let isLabel = shape['type'] === 'label';
        let needsStroke =
            shape['type'] === 'line' || shape['type'] === 'arrow' ||
            shape['type'] === 'point';

        // determine fill and stroke using defaults if not supplied
        let defaultFill =
            typeof shape['FillColor'] === 'number' ?
                ConversionUtils.convertSignedIntegerToColorObject(
                    shape['FillColor']) : null;
        if (defaultFill === null) defaultFill = transWhite;
        else defaultFill =
            ConversionUtils.convertColorObjectToRgba(defaultFill);
        let defaultStroke = {
            'color': typeof shape['StrokeColor'] === 'number' ?
                ConversionUtils.convertSignedIntegerToColorObject(
                    shape['StrokeColor']) : null,
            'width': (typeof shape['StrokeWidth'] === 'object' &&
                shape['StrokeWidth'] !== null &&
                typeof shape['StrokeWidth']['Value'] === 'number') ?
                shape['StrokeWidth']['Value'] : 1,
            'lineCap': "butt",
            'lineJoin': "miter",
            'miterLimit': 20
        };
        if (defaultStroke['color'] === null) defaultStroke['color'] = blue;
        else defaultStroke['color'] =
            ConversionUtils.convertColorObjectToRgba(
                defaultStroke['color']);
        if (needsStroke && defaultStroke['width'] === 0)
            defaultStroke['width'] = 1;
        else if (isLabel) defaultStroke['width'] = 0;

        // set default style
        let defStyle = {
            'stroke': new Stroke(defaultStroke)
        };
        if (!isLabel) defStyle['fill'] = new Fill({color: defaultFill});
        this.default_style_ = new Style(defStyle);

        // set default style function for sketching
        this.default_style_function_ = (feature, resolution) => {
            let optSketchFeature = this.ol_draw_.sketchFeature_;
            let geom =
                optSketchFeature ?
                    optSketchFeature.getGeometry() : feature.getGeometry();

            // we don't have a sketch feature to style
            if (optSketchFeature === null) return null;

            // for sketching labels
            if (geom instanceof Label) {
                let text = new Text({
                    overflow: true,
                    text: "TEXT",
                    font: "normal " + geom.getHeight() + "px sans-serif",
                    fill: new Fill(
                        {color: this.default_style_.getStroke().getColor()})
                });
                //adjust scale and rotation
                let rot = this.regions_.viewer_.viewer_.getView().getRotation();
                if (rot !== 0 && !this.regions_.rotate_text_) text.setRotation(rot);
                text.setScale(1 / resolution);
                this.default_style_.text_ = text;
            }

            let ret = [this.default_style_];
            // for sketching arrows
            if (geom instanceof Line && geom.has_end_arrow_) {
                let lineStroke = this.default_style_.getStroke();
                let strokeWidth = lineStroke.getWidth() || 1;
                let arrowBaseWidth = 15 * resolution;

                let arrowStyle =
                    new Style({
                        geometry:
                            geom.getArrowGeometry(
                                true, arrowBaseWidth, arrowBaseWidth),
                        fill: new Fill({'color': lineStroke.getColor()}),
                        stroke: lineStroke
                    });
                ret.push(arrowStyle);
            }

            optSketchFeature.setStyle(ret);
            return null;
        };
    };


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
    };

    /**
     * Drawing interaction for Polygons
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPolygon_(event) {
        this.drawShapeCommonCode_('Polygon', 'polygon', (coordinates, opt_geometry) => {
            let geometry = new Polygon(coordinates);

            if (opt_geometry) {
                opt_geometry.setCoordinates(geometry.getCoordinates());
            }

            return geometry;
        });
    };

    /**
     * Drawing interaction for polylines
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPolyLine_(event) {
        this.drawShapeCommonCode_('LineString', 'polyline', (coordinates, opt_geometry) => {
            let geometry = new Line(coordinates);

            if (opt_geometry) {
                opt_geometry.setCoordinates(geometry.getCoordinates());
            }

            return geometry;
        });
    };

    /**
     * Drawing interaction for lines (delegates to polyline)
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawLine_(event) {
        this.abort_polyline_ = true;
        this.drawPolyLine_();
    };

    /**
     * Drawing interaction for (Poly)Lines with arrow heads
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawArrow_(event) {
        this.abort_polyline_ = true;
        this.drawShapeCommonCode_('LineString', 'polyline', (coordinates, opt_geometry) => {
            let geometry = new Line(coordinates, false, true);
            if (opt_geometry) {
                opt_geometry.setCoordinates(geometry.getCoordinates());
            }

            return geometry;
        });
    };

    /**
     * Drawing interaction for Points
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawPoint_(event) {
        this.drawShapeCommonCode_('Point', "point",
            (coordinates, opt_geometry) => new Point(coordinates));
    };

    /**
     * Drawing interaction for Rectangles
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawRectangle_(event) {
        this.drawShapeCommonCode_('Circle', "rectangle",
            (coordinates, opt_geometry) => {
                let supposedTopLeft = coordinates[0];
                let end = coordinates[1];
                let w = Math.abs(end[0] - supposedTopLeft[0]);
                let h = Math.abs(supposedTopLeft[1] - end[1]);
                if (w === 0) w = 1;
                if (h === 0) h = 1;
                let topLeftX = end[0] < supposedTopLeft[0] ?
                    end[0] : supposedTopLeft[0];
                let topLeftY = end[1] > supposedTopLeft[1] ?
                    end[1] : supposedTopLeft[1];

                let geometry = new Rectangle(topLeftX, topLeftY, w, h);

                if (opt_geometry) {
                    opt_geometry.setUpperLeftCorner(geometry.getUpperLeftCorner());
                    opt_geometry.setWidth(geometry.getWidth());
                    opt_geometry.setHeight(geometry.getHeight());
                }

                return geometry;
            });
    };

    /**
     * Drawing interaction for Labels
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawLabel_(event) {
        let height = this.regions_.viewer_.getDimensionIndex('y');

        this.drawShapeCommonCode_('Circle', "label", (coordinates, opt_geometry) => {
            let supposedTopLeft = coordinates[0];
            let end = coordinates[1];
            let h = Math.abs(supposedTopLeft[1] - end[1]);
            if (h === 0) h = 1;
            let topLeftX = end[0] < supposedTopLeft[0] ?
                end[0] : supposedTopLeft[0];
            let topLeftY = end[1] > supposedTopLeft[1] ?
                end[1] : supposedTopLeft[1];

            let fontDims = StyleUtils.measureTextDimensions(
                "TEXT", "normal " + parseInt(h) + "px sans-serif");
            let geometry = new Label(topLeftX, topLeftY, fontDims);

            if (opt_geometry) {
                opt_geometry.setUpperLeftCorner(geometry.getUpperLeftCorner());
                opt_geometry.setWidth(geometry.getWidth());
                opt_geometry.setHeight(geometry.getHeight());
            }

            return geometry;
        });
    };

    /**
     * Drawing interaction for Ellipses
     *
     * @private
     * @param {Object} event the event object for the drawing interaction
     */
    drawEllipse_(event) {
        this.drawShapeCommonCode_('Circle', "ellipse", (coordinates, opt_geometry) => {
            let center = coordinates[0];
            let end = coordinates[1];
            let rx = Math.abs(center[0] - end[0]);
            let ry = Math.abs(center[1] - end[1]);
            let geometry = new Ellipse(center[0], center[1], rx, ry);

            if (opt_geometry) {
                opt_geometry.setCoordinates(geometry.getCoordinates());
                opt_geometry.setRadius(geometry.getRadius());
            }

            return geometry;
        });
    };

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
