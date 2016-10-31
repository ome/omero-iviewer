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
ome.ol3.interaction.Draw = function(previous_modes, regions_reference) {
	if (!ome.ol3.utils.Misc.isArray(previous_modes))
        console.error("Draw needs the prevously set modes as an array");

	// we do need the regions reference to do translations
    if (!(regions_reference instanceof ome.ol3.source.Regions))
        console.error("Draw needs Regions instance!");

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
	 * default styling for drawing
	 *
	 * @type {function}
	 * @private
	 */
	this.default_style_function_ = function(feature, resolution) {
        var optSketchFeature = this.ol_draw_.sketchFeature_;
        var geom = optSketchFeature ?
                    optSketchFeature.getGeometry() : feature.getGeometry();

        var transWhite = [255,255,255,0.5];
        var blue = [0, 153, 255, 0.7];
        var isLabel = geom instanceof ome.ol3.geom.Label;
        var defaultStyle = new ol.style.Style({
            image: !isLabel ? new ol.style.Circle({radius: 6,
                    fill: new ol.style.Fill({color: blue}),
                    stroke: new ol.style.Stroke(
                                {color: "#FFFFFF",width: 3 / 2})}) : null,
            fill: !isLabel ?
                    new ol.style.Fill({color: transWhite}) : null,
            stroke: new ol.style.Stroke({color: blue, width: 1})});

        // we don't have a sketch feature to style
        if (optSketchFeature === null) return defaultStyle;

        // we show the text when 'drawing' the label
        var text = isLabel ?
            new ol.style.Text(
                { text: "TEXT",
                  font: "normal " + geom.getHeight() + "px sans-serif",
                  fill: new ol.style.Fill({color: transWhite, width: 1}),
                  stroke: new ol.style.Stroke({color: blue, width: 1})}) :
            null;
        if (text) {
            //adjust scale and rotation
            var rot = this.regions_.viewer_.viewer_.getView().getRotation();
            if (rot !== 0 && !this.regions_.rotate_text_) text.setRotation(rot);
            text.setScale(1/resolution);
            optSketchFeature.setStyle(new ol.style.Style({ "text" : text}));
        }

        return defaultStyle;
    }.bind(this);
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
					ol_shape.length === 0 || shape_type.length === 0)
				return;
  var customOnDrawEnd = typeof(onDrawEnd) === 'function' ? onDrawEnd : null;

	// these actions take place after drawing the shape
	var onDrawEndAction = function(event) {
		if (customOnDrawEnd) customOnDrawEnd.call(this, event);

		if (event.feature instanceof ol.Feature) {
			// set id, type and state as new
			event.feature.setId("-1:" + ol.getUid(event.feature));
			event.feature['state'] = ome.ol3.REGIONS_STATE.ADDED;
			event.feature['type'] = shape_type;

            // set t and z info
            event.feature['theT'] =
                this.regions_.viewer_.getDimensionIndex('t');
            event.feature['theZ'] =
                this.regions_.viewer_.getDimensionIndex('z');
            event.feature['theC'] = -1;

            var geom = event.feature.getGeometry();
            var text = null;
            var white = [255,255,255,0.5];
            var blue = [0, 153, 255, 0.9];

            // adjust if drawn in rotated state
			var rot = this.regions_.viewer_.viewer_.getView().getRotation();
			if (geom instanceof ome.ol3.geom.Label) {
                if (rot !== 0 && !this.regions_.rotate_text_) geom.rotate(-rot);

                text = new ol.style.Text(
                    { text: "TEXT",
                      font: "normal " + geom.getHeight() + "px sans-serif",
                      fill: new ol.style.Fill({color: white, width: 1}),
                      stroke: new ol.style.Stroke({color: blue, width: 1})});
            }

            // apply style function after setting a default style
            event.feature.setStyle(new ol.style.Style({
                fill: text === null ?
                        new ol.style.Fill({color: white}) : null,
                stroke: text === null ?
                        new ol.style.Stroke({color: blue, width: 1}) : null,
                text: text}));
            ome.ol3.utils.Style.updateStyleFunction(
                event.feature, this.regions_, true);

            this.regions_.addFeature(event.feature);

            var eventbus = this.regions_.viewer_.eventbus_;
            var config_id = this.regions_.viewer_.getTargetId();
            if (eventbus)
                setTimeout(function() {
                    var newRegionsObject =
                        ome.ol3.utils.Conversion.toJsonObject(
                            new ol.Collection([event.feature]), true, true);
                    if (typeof newRegionsObject !== 'object' ||
                        !ome.ol3.utils.Misc.isArray(newRegionsObject['rois']) ||
                        newRegionsObject['rois'].length === 0) return;
                    eventbus.publish("REGIONS_SHAPE_DRAWN",
                        { "config_id": config_id,
                          "shapes": newRegionsObject['rois'] });
                },0);
        }

        this.endDrawingInteraction();
	};

	// create a new draw interaction removing possible existing ones first
	if (this.ol_draw_)
		this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
	this.ol_draw_ = new ol.interaction.Draw({
		source: this.regions_,
        style: this.default_style_function_,
		type: ol_shape,
		geometryFunction: typeof(geometryFunction) === 'function' ?
		 	geometryFunction : null
	});

	if (shape_type === 'point')
        this.ol_draw_.mode = this.mode = ol.interaction.Draw.Mode.POINT;


	// add the interaction to the viewer and register our after draw handler
	this.regions_.viewer_.viewer_.addInteraction(this.ol_draw_);
	this.ol_draw_.on(
		ol.interaction.Draw.EventType.DRAWEND, onDrawEndAction, this);
}

/**
 * This method starts the drawing interaction for a certin shape type.
 *
 * @param {string} type the shape type
 */
ome.ol3.interaction.Draw.prototype.drawShape = function(type) {
	if (typeof(type) !== 'string' || type.length === 0) {
        this.dispatchEvent(new ol.interaction.Draw.Event(
             ol.interaction.Draw.EventType.DRAWEND, null));
        return;
    }

	var typeFunction = null;
	switch(type.toLowerCase()) {
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
		case "rectangle" :
			typeFunction = ome.ol3.interaction.Draw.prototype.drawRectangle_;
			break;
		case "label" :
			typeFunction = ome.ol3.interaction.Draw.prototype.drawLabel_;
			break;
		default:
			this.regions_.setModes(this.previous_modes_);
			break;
	};
	if (typeFunction)
		typeFunction.call(this);
};

/**
 * Ends an active drawing interaction
 */
ome.ol3.interaction.Draw.prototype.endDrawingInteraction = function() {
    if (this.ol_draw_) {
        this.regions_.viewer_.viewer_.removeInteraction(this.ol_draw_);
        this.ol_draw_ = null;
        var revertToOldModes =
            function() {this.regions_.setModes(this.previous_modes_);};
        setTimeout(revertToOldModes.bind(this), 100);
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
	this.drawShapeCommonCode_('LineString', 'polyline');
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
			return new ol.geom.Circle(coordinates, 2);
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
				opt_geometry.setUpperLeftCorner(
					geometry.getUpperLeftCorner());
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
				opt_geometry.setUpperLeftCorner(
					geometry.getUpperLeftCorner());
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
			var geometry = new ome.ol3.geom.Ellipse(center[0], center[1], rx,ry);

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
