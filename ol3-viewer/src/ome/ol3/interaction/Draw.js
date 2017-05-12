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
goog.provide('ome.ol3.interaction.Draw');

goog.require('ol.Feature');
goog.require('ol.interaction.Draw');

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
ome.ol3.interaction.Draw =
    function(previous_modes, regions_reference) {
        if (!ome.ol3.utils.Misc.isArray(previous_modes))
            console.error("Draw needs the prevously set modes as an array");

        // we do need the regions reference to do translations
        if (!(regions_reference instanceof ome.ol3.source.Regions))
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
         * @type {ol.interaction.Draw}
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
goog.inherits(ome.ol3.interaction.Draw, ome.ol3.interaction);

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
ome.ol3.interaction.Draw.prototype.drawShapeCommonCode_ =
    function(ol_shape, shape_type, geometryFunction) {
        if (typeof(ol_shape) !== 'string' || typeof(shape_type) !== 'string' ||
            ol_shape.length === 0 || shape_type.length === 0) return;

        // called after drawing the shape
        var onDrawEndAction = function(event) {
            if (event.feature instanceof ol.Feature) {
                // set id, type and state as new
                event.feature.setId(
                    (typeof this.roi_id_ === 'number' && this.roi_id_ < 0 ?
                        "" + this.roi_id_ + ":" :
                        "-1:") + (-ol.getUid(event.feature)));
                event.feature['state'] = ome.ol3.REGIONS_STATE.ADDED;
                event.feature['type'] = shape_type;

                // set t and z info
                var hasUnattachedDims =
                    ome.ol3.utils.Misc.isArray(this.opts_['unattached']) &&
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
                ome.ol3.utils.Style.updateStyleFunction(
                    event.feature, this.regions_, true);

                var add =
                    typeof this.opts_['add'] !== 'boolean' || this.opts_['add'];
                if (add) this.regions_.addFeature(event.feature);

                var eventbus = this.regions_.viewer_.eventbus_;
                var config_id = this.regions_.viewer_.getTargetId();
                var hist_id = this.history_id_;
                if (this.roi_id_ < 0) event.feature['roi_id'] = this.roi_id_;
                if (eventbus)
                    setTimeout(function() {
                        var newRegionsObject =
                            ome.ol3.utils.Conversion.toJsonObject(
                                new ol.Collection([event.feature]), false, true);
                        if (typeof newRegionsObject !== 'object' ||
                            !ome.ol3.utils.Misc.isArray(newRegionsObject['rois']) ||
                            newRegionsObject['rois'].length === 0) return;
                        var opts = {
                            "config_id": config_id,
                            "shapes": newRegionsObject['rois'],
                            "drawn" : true, "add": add
                        };
                        if (typeof hist_id === 'number') opts['hist_id'] = hist_id;
                        if (typeof event.feature['roi_id'] === 'number')
                            opts['roi_id'] = event.feature['roi_id'];
                        eventbus.publish("REGIONS_SHAPE_GENERATED", opts);
                    },25);
                this.history_id_ = null;
                this.rois_id_ = 0;
            }

            this.endDrawingInteraction(false);
        };

        // create a new draw interaction removing possible existing ones first
        if (this.ol_draw_)
            this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
        this.ol_draw_ = new ol.interaction.Draw({
            style: this.default_style_function_,
            type: ol_shape,
            geometryFunction:
                typeof(geometryFunction) === 'function' ?
                    geometryFunction : null
        });

        // add start and end handlers for the drawing action
        this.regions_.viewer_.viewer_.addInteraction(this.ol_draw_);
        if (this.abort_polyline_)
            this.ol_draw_.once(
                ol.interaction.DrawEventType.DRAWSTART,
                function(e) {
                    var f = e.feature;
                    var changeHandler =
                        f.getGeometry().on(
                            'change', function(e) {
                                var geom = e.target;
                                if (geom.getCoordinates().length >= 3) {
                                    ol.Observable.unByKey(changeHandler);
                                    this.ol_draw_.finishDrawing();
                                }
                        }, this);
                    }, this);
        this.ol_draw_.on(
            ol.interaction.DrawEventType.DRAWEND, onDrawEndAction, this);
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
ome.ol3.interaction.Draw.prototype.drawShape = function(shape, roi_id, opts) {
    this.opts_ = opts || {};
    this.abort_polyline_ = false;
    if (typeof(shape['type']) !== 'string' || shape['type'].length === 0) {
        this.history_id_ = null;
        this.roi_id_ = 0;
        this.dispatchEvent(new ol.interaction.Draw.Event(
             ol.interaction.DrawEventType.DRAWEND, null));
        return;
    }

    this.roi_id_ = (typeof roi_id === 'number' && roi_id < 0) ? roi_id : -1;
    if (typeof this.opts_['hist_id'] === 'number')
        this.history_id_ = this.opts_['hist_id'];
    var typeFunction = null;
    switch(shape['type'].toLowerCase()) {
        case "point" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawPoint_;
            break;
        case "polygon" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawPolygon_;
            break;
        case "ellipse" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawEllipse_;
            break;
        case "line" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawLine_;
            break;
        case "arrow":
            typeFunction = ome.ol3.interaction.Draw.prototype.drawArrow_;
            break;
        case "rectangle" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawRectangle_;
            break;
        case "label" :
            typeFunction = ome.ol3.interaction.Draw.prototype.drawLabel_;
            break;
        default:
            this.regions_.setModes(this.previous_modes_);
            return;
    };
    this.setDefaultDrawingStyle(shape);
    typeFunction.call(this);
};

/**
 * Sets the drawing style using defaults or the shape definition
 *
 * @param {Object} shape the shape definition
 */
ome.ol3.interaction.Draw.prototype.setDefaultDrawingStyle = function(shape) {
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
            ome.ol3.utils.Conversion.convertSignedIntegerToColorObject(
                shape['FillColor']) : null;
    if (defaultFill === null) defaultFill = transWhite;
    else defaultFill =
        ome.ol3.utils.Conversion.convertColorObjectToRgba(defaultFill);
    var defaultStroke = {
        'color': typeof shape['StrokeColor'] === 'number' ?
                    ome.ol3.utils.Conversion.convertSignedIntegerToColorObject(
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
        ome.ol3.utils.Conversion.convertColorObjectToRgba(
            defaultStroke['color']);
    if (needsStroke && defaultStroke['width'] === 0)
        defaultStroke['width'] = 1;
    else if (isLabel) defaultStroke['width'] = 0;

    // set default style
    var defStyle = {
        'stroke': new ol.style.Stroke(defaultStroke)
    };
    if (!isLabel) defStyle['fill'] = new ol.style.Fill({color: defaultFill});
    this.default_style_ = new ol.style.Style(defStyle);

    // set default style function for sketching
    this.default_style_function_ = function(feature, resolution) {
        var optSketchFeature = this.ol_draw_.sketchFeature_;
        var geom =
            optSketchFeature ?
                optSketchFeature.getGeometry() : feature.getGeometry();

        // we don't have a sketch feature to style
        if (optSketchFeature === null) return null;

        // for sketching labels
        if (geom instanceof ome.ol3.geom.Label) {
            var text =
                new ol.style.Text(
                    { text: "TEXT",
                      font: "normal " + geom.getHeight() + "px sans-serif",
                      fill: new ol.style.Fill(
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
        if (geom instanceof ome.ol3.geom.Line && geom.has_end_arrow_) {
            var lineStroke = this.default_style_.getStroke();
            var strokeWidth = lineStroke.getWidth() || 1;
            var arrowBaseWidth = 15 * resolution;

            var arrowStyle =
                new ol.style.Style({
                    geometry:
                        geom.getArrowGeometry(
                            true, arrowBaseWidth, arrowBaseWidth),
                    fill: new ol.style.Fill({'color': lineStroke.getColor()}),
                    stroke: lineStroke
            });
            ret.push(arrowStyle);
        };

        optSketchFeature.setStyle(ret);
        return null;
    }.bind(this);
};


/**
 * Ends an active drawing interaction
 * @param {boolean} reset if true (default) we reset back to the previous mode
 */
ome.ol3.interaction.Draw.prototype.endDrawingInteraction = function(reset) {
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
ome.ol3.interaction.Draw.prototype.drawPolygon_ = function(event) {
    this.drawShapeCommonCode_('Polygon', 'polygon');
};

/**
 * Drawing interaction for (Poly)Lines
 *
 * @private
 * @param {Object} event the event object for the drawing interaction
 */
ome.ol3.interaction.Draw.prototype.drawLine_ = function(event) {
    this.drawShapeCommonCode_('LineString', 'polyline',
        function(coordinates, opt_geometry) {
            var geometry = new ome.ol3.geom.Line(coordinates);

            if (opt_geometry) {
                opt_geometry.setCoordinates(geometry.getCoordinates());
            }

            return geometry;
        });
};

/**
 * Drawing interaction for (Poly)Lines with arrow heads
 *
 * @private
 * @param {Object} event the event object for the drawing interaction
 */
ome.ol3.interaction.Draw.prototype.drawArrow_ = function(event) {
    this.abort_polyline_ = true;
    this.drawShapeCommonCode_('LineString', 'polyline',
        function(coordinates, opt_geometry) {
            var geometry = new ome.ol3.geom.Line(coordinates, false, true);
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
ome.ol3.interaction.Draw.prototype.drawPoint_ = function(event) {
    this.drawShapeCommonCode_('Point', "point",
        function(coordinates, opt_geometry) {
            return new ol.geom.Circle(coordinates, 5);
    });
};

/**
 * Drawing interaction for Rectangles
 *
 * @private
 * @param {Object} event the event object for the drawing interaction
 */
ome.ol3.interaction.Draw.prototype.drawRectangle_ = function(event) {
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

            var geometry = new ome.ol3.geom.Rectangle(topLeftX, topLeftY, w, h);

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
ome.ol3.interaction.Draw.prototype.drawLabel_ = function(event) {
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

            var fontDims =
                ome.ol3.utils.Style.measureTextDimensions(
                    "TEXT", "normal " + parseInt(h) + "px sans-serif");
            var geometry = new ome.ol3.geom.Label(topLeftX, topLeftY, fontDims);

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
ome.ol3.interaction.Draw.prototype.drawEllipse_ = function(event) {
    this.drawShapeCommonCode_('Circle', "ellipse",
        function(coordinates, opt_geometry) {
            var center = coordinates[0];
            var end = coordinates[1];
            var rx = Math.abs(center[0]-end[0]);
            var ry =  Math.abs(center[1]- end[1]);
            var geometry =
                new ome.ol3.geom.Ellipse(center[0], center[1], rx,ry);

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
ome.ol3.interaction.Draw.prototype.dispose = function() {
    if (this.ol_draw_) {
        this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
        this.ol_draw_ = null;
        this.previous_modes_ = null;
    }
    this.regions_ = null;
}
