/**
 * @namespace ome.ol3.utils.Style
 */
goog.provide('ome.ol3.utils.Style');

goog.require('ol.style.Style');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Text');
goog.require('ol.style.RegularShape');

/**
 * Creates an open layers style object based on the handed in roi shapes info
 *
 * @private
 * @param {Object} shape_info the roi shape information
 * @param {boolean} is_label a flag that tells us if we are a label (default: false)
 * @param {boolean=} fill_in_defaults use defaults for missing info (default: true)
 * @return {ol.style.Style|null} a style object or null if something went wrong
 */
ome.ol3.utils.Style.createFeatureStyle = function(shape_info, is_label, fill_in_defaults) {
	// preliminary checks
	if (typeof(shape_info) != 'object') return null;
	var forLabel = (typeof(is_label) === 'boolean') ? is_label : false;
    if (typeof fill_in_defaults !== 'boolean') fill_in_defaults = true;

	// that way we know whether at least one style property for stroke/fill was given
	var stroke = {'count' : 0};
	var fill = {'count' : 0};

	// FILL PROPERTIES
	if (typeof(shape_info['fillColor']) === 'string') {
		// we need hex +alpha to rgba conversion via color object
		fill['color'] =
			ome.ol3.utils.Conversion.convertHexColorFormatToObject(shape_info['fillColor'], shape_info['fillAlpha']);
		fill['color'] = ome.ol3.utils.Conversion.convertColorObjectToRgba(fill['color']);
		if (fill['color'] != null) fill['count']++;
	}

	// STROKE PROPERTIES
	if (typeof(shape_info['strokeColor']) === 'string') {
		// we need hex +alpha to rgba conversion via color object
		stroke['color'] =
			ome.ol3.utils.Conversion.convertHexColorFormatToObject(shape_info['strokeColor'], shape_info['strokeAlpha']);
		stroke['color'] = ome.ol3.utils.Conversion.convertColorObjectToRgba(stroke['color']);
		if (stroke['color'] != null) stroke['count']++;
	}
	if (typeof(shape_info['strokeWidth']) === 'number') {
		stroke['width'] = shape_info['strokeWidth'];
		stroke['count']++;
	} else if (fill_in_defaults) {
		stroke['width'] = 1;
	}
	if (stroke['count'] > 0) {
		// we need to set some sensible defaults for the following
		stroke['lineCap'] = "butt";
		stroke['lineJoin'] = "miter";
		stroke['miterLimit'] = 20;
	}

	// instantiate style objects
	var strokeStyle = (stroke['count'] > 0) ? new ol.style.Stroke(stroke) : null;
	var fillStyle = (fill['count'] > 0) ? new ol.style.Fill(fill) : null;

	// contains style information
	var style = {};
	var text = { "count" : 0};
    if (typeof shape_info['textValue'] === 'string') {
        text['text'] = shape_info['textValue'];
        text['count']++;
    }
	var font = "";
	if (typeof(shape_info['fontStyle']) === 'string')
		font += (shape_info['fontStyle'] + " ");
	else if (fill_in_defaults) font += "normal ";
	if (typeof(shape_info['fontSize']) === 'number')
		font += (shape_info['fontSize'] + "px ");
	else if (fill_in_defaults) font += "10px ";
	if (typeof(shape_info['fontFamily']) === 'string')
		font += shape_info['fontFamily'];
	else if (fill_in_defaults) font += "sans-serif";
	if (font.length > 0) {
        text['font'] = font;
        text['count']++;
    }
	if (strokeStyle) {
		// we don't want spikes
		stroke['lineCap'] = "round";
		stroke['lineJoin'] = "round";
		text['fill'] = new ol.style.Fill(stroke);
            //forLabel && fillStyle ? fillStyle : new ol.style.Fill(stroke);
		text['stroke'] = new ol.style.Stroke(stroke);
		//if (!forLabel) text['stroke'].setWidth(1);
        text['stroke'].setWidth(1);
        text['count']++;
	}
    if (text['count'] > 0) {
        style['text'] = new ol.style.Text(text);

        // we do not wish for defaults (ol creates default fill color)
        if (!fill_in_defaults && typeof shape_info['strokeColor'] !== 'string')
            style['text'].fill_ = null;
    }

	if (strokeStyle) style['stroke'] = strokeStyle;
	if (fillStyle) style['fill'] = fillStyle;
	if (forLabel) { // the workaround for mere labels
		style['stroke'] = new ol.style.Stroke(
			{	'color': "rgba(255,255,255,0)", 'width': 1,
				'lineCap' : "butt", 'lineJoin' : "miter", 'miterLimit' : 20
			});
		style['fill'] = new ol.style.Fill({'color': "rgba(255,255,255,0)"});
	}

	return new ol.style.Style(style);
}

/**
 * Used internally to replace the style/style function of a feature.
 * In specific, this is called if setScaleText or setRotateText members are called
 * see {@link ome.ol3.source.Regions.setScaleText}
 * see {@link ome.ol3.source.Regions.setRotateText}
 *
 * @private
 * @param {olFeature} feature the feature whose style (function) to adjust
 * @param {ome.ol3.source.Regions} regions_reference a reference to the regions instance
 * @param {boolean=} forceUpdate forces label to be updated even if rotation/resolution (flags) were not modified
 */
ome.ol3.utils.Style.updateStyleFunction = function(feature, regions_reference, forceUpdate) {
        if (!(feature instanceof ol.Feature))
            console.error("A style function requires an instance of a feature!");

        if (!(regions_reference instanceof ome.ol3.source.Regions))
            console.error("A style function requires an instance of Regions!");

		// all this makes only sense with a style really
		var oldStyle = feature.getStyle();
		if (oldStyle == null) return;
		var viewRef = regions_reference.viewer_.viewer_.getView();

		// three possibilities:
        // we are a style, an array of styles (arrow),
        // or a style function...
		if (typeof(oldStyle) === 'function')
			oldStyle = oldStyle.call(feature, viewRef.getResolution());
        if (ome.ol3.utils.Misc.isArray(oldStyle))
            oldStyle = oldStyle[0]; // we want the first one only

		// keep regions reference handy
		feature['regions'] = regions_reference;

		// remember a heck of a lot of things to see if they have changed later
		// 1. remember unselected style for un/select changes
		var oldStrokeStyle = oldStyle.getStroke();
		if (typeof(feature['oldStrokeStyle']) !== 'object') {
			if (oldStrokeStyle)
				feature['oldStrokeStyle'] = {
					"color" : oldStrokeStyle.getColor(),
					"width" : oldStrokeStyle.getWidth(),
					"lineDash" : oldStrokeStyle.getLineDash(),
					"lineCap" : oldStrokeStyle.getLineCap(),
					"lineJoin" : oldStrokeStyle.getLineJoin(),
					"miterLimit" : oldStrokeStyle.getMiterLimit(),
				};
			else feature['oldStrokeStyle'] = null;
		}
		// 2. remember old resolution/rotation and text scale/rotate flags
		// this is only relevant for labels
		if (feature.getGeometry() instanceof ome.ol3.geom.Label) {
			if (typeof(feature['oldRotation']) === 'undefined')
				feature['oldRotation'] = viewRef.getRotation();
			if (typeof(feature['oldScale']) === 'undefined')
				feature['oldScale'] = viewRef.getResolution();
			if (typeof(feature['oldRotationFlag']) === 'undefined')
				feature['oldRotationFlag'] = regions_reference.rotate_text_;
			if (typeof(feature['oldScaleFlag']) === 'undefined')
				feature['oldScaleFlag'] = regions_reference.scale_text_;
		}

		// replace style function
		feature.setStyle(function(actual_resolution) {
			// fetch view via regions reference
			if (!(feature['regions'] instanceof ome.ol3.source.Regions))
				return oldStyle; // we are screwed, return old setStyle

			var regions = feature['regions'];
            var geom = feature.getGeometry();
			// find present flags for scaling/rotating text
			var scale_text = regions.scale_text_;
			var rotate_text = regions.rotate_text_;
			// get present rotation
			var rotation = viewRef.getRotation();

			// is there a text style?
			var textStyle = oldStyle.getText();
            // if show_comments flag is to false, we only set the text for labels
            var isLabel = (geom instanceof ome.ol3.geom.Label);
            if (!isLabel && !regions.show_comments_ &&
                    (textStyle instanceof ol.style.Text)) {
                feature['oldText'] = textStyle.clone();
                textStyle = null;
                oldStyle.text_ = textStyle;
            } else if (!isLabel && regions.show_comments_ &&
                        !(textStyle instanceof ol.style.Text) &&
                        (feature['oldText'] instanceof ol.style.Text)) {
                // this brings back a previously not shown comment
                textStyle = feature['oldText'].clone();
                oldStyle.text_ = textStyle;
            }

			if (textStyle instanceof ol.style.Text) {
				// seems we want to adjust text to resolution level
				if (scale_text) {
					var newScale = 1/actual_resolution;
					textStyle.setScale(newScale);
				} else {// this is for a potential reset after a change
					textStyle.setScale(1);
				}

				// seems we want the text to go along with the shape rotation
				if (rotate_text)
					textStyle.setRotation(rotation);
				else
					textStyle.setRotation(0);

					forceUpdate = forceUpdate || false;
					if (isLabel && (forceUpdate ||
					(feature['oldRotation'] !== rotation ||
					 feature['oldScale'] !== actual_resolution ||
				 	 feature['oldRotationFlag'] !== rotate_text ||
				 		feature['oldScaleFlag'] !== scale_text))) {
						if (feature['oldRotation'] !== rotation) feature['oldRotation'] = rotation;
						if (feature['oldScale'] !== actual_resolution) feature['oldScale'] = actual_resolution;
						if (feature['oldRotationFlag'] !== rotate_text) feature['oldRotationFlag'] = rotate_text;
						if (feature['oldScaleFlag'] !== scale_text) feature['oldScaleFlag'] = scale_text;
						if (forceUpdate) forceUpdate = false; // reset the flag, we do this only once
						var newDims =
							ome.ol3.utils.Style.measureTextDimensions(
								textStyle.getText(), textStyle.getFont(),
								scale_text ? null : actual_resolution);
						var newRot = rotate_text ? 0 : 0-rotation;
						geom.adjustCoordinates(newRot, newDims);
				}
			}

			var selected =
				typeof(feature['selected'] === 'boolean') ? feature['selected'] : false;
			if (selected) {
				var selStyle = new ol.style.Stroke();
                var c = feature['oldStrokeStyle'] &&
                    typeof feature['oldStrokeStyle']['color'] !== 'undefined' ?
                        feature['oldStrokeStyle']['color'] : "rgba(255,0,0,1)";
                if (isLabel) c = "rgba(255,0,0,1)";
                selStyle.setColor(c)
                // we use width from old style if (exists)
                var w =
                    feature['oldStrokeStyle'] &&
                        typeof feature['oldStrokeStyle']['width'] === 'number' ?
                            feature['oldStrokeStyle']['width'] : 3;
				selStyle.setWidth(w+1);
				selStyle.setLineDash([5, 5]);
				oldStyle.stroke_ = selStyle;
			} else if (feature['oldStrokeStyle']) {
					// restore old style
					oldStyle.getStroke().setColor(feature['oldStrokeStyle']['color']);
					oldStyle.getStroke().setWidth(feature['oldStrokeStyle']['width']);
					oldStyle.getStroke().setLineDash(feature['oldStrokeStyle']['lineDash']);
					oldStyle.getStroke().setLineCap(feature['oldStrokeStyle']['lineCap']);
					oldStyle.getStroke().setLineJoin(feature['oldStrokeStyle']['lineJoin']);
					oldStyle.getStroke().setMiterLimit(feature['oldStrokeStyle']['miterLimit']);
			} else {
					oldStyle.stroke_ = null;
			}

            var ret = [oldStyle];
            // arrow heads/tails for lines
            if (geom instanceof ome.ol3.geom.Line &&
                    (geom.has_start_arrow_ || geom.has_end_arrow_)) {

                var lineStroke = oldStyle.getStroke();
                var strokeWidth = lineStroke.getWidth() || 1;
                var arrowBaseWidth = 15 * actual_resolution;

                // determine which arrows we need
                var arrowsToDo = [];
                if (geom.has_start_arrow_) arrowsToDo.push(true);
                if (geom.has_end_arrow_) arrowsToDo.push(false);

                // create arrow head with styling
                for (var a in arrowsToDo) {
                    var isHeadArrow = arrowsToDo[a];
                    var arrow =
                        geom.getArrowGeometry(
                            isHeadArrow, arrowBaseWidth, arrowBaseWidth);
                    var arrowStyle =
                        new ol.style.Style({
                            geometry: arrow,
                            fill: new ol.style.Fill(
                                    {color: lineStroke.getColor()}),
                            stroke: lineStroke});
                    ret.push(arrowStyle);
                };
            }

            return ret;
		});
}

/**
 * Helps measure the width of text using canvas metrics
 * it will return an object like this where the units are pixels:
 * <pre>
 *	{ width: 10, height: 20}
 * </pre>
 *
 * @static
 * @function
 * @param {string} text the text whose width we want to measure
 * @param {string} font the font for the given text, e.g. 'bold 100px arial'
 * @param {number=} resolution the resolution applied to the font size
 * @return {Object} a dimension object with properties width and height (in pixels)
 */
ome.ol3.utils.Style.measureTextDimensions = function(text, font, resolution) {
	// preliminary check: we need 2 strings
	if (typeof(text) !== 'string' || typeof(font) !== 'string' ) return null;

	var fontSize = 10;
	resolution = (typeof(resolution) === 'number' && resolution > 0) ? resolution : 1;
	var fontTokens = font.split(' ');
	if (fontTokens.length != 3) return null;

	try {
		fontSize = parseInt(fontTokens[1]);
		fontSize *= resolution;
		fontSize = Math.ceil(fontSize);
		font = fontTokens[0] + " " + fontSize + "px " + fontTokens[2];
	} catch(notANumber) {
		// nothing we can do
	}

	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext("2d");
	ctx.font = font;
	var metrics = ctx.measureText(text);

 	// set return object with measured dimensions
	return { 'width' : metrics.width > 0 ? metrics.width : 5, 'height' : fontSize};
}

/**
 * Produces a deep copy of the style object handed in.
 * Caution: it does not copy all properties. In specific it copies only the ones
 * we want/need such as fill, stroke and text properties!
 *
 * @static
 * @function
 * @param {ol.style.Style} style the style object to clone
 * @return {ol.style.Style|null} an open layer's style instance or null
 */
ome.ol3.utils.Style.cloneStyle = function(style) {
	if (!(style instanceof ol.style.Style)) return null;

	var newStyle = null;

	// FILL
	var newFill = null;
	if (style.getFill())
		newFill = new ol.style.Fill({"color" : style.getFill().getColor()});

	// STROKE
	var newStroke = ome.ol3.utils.Style.cloneStroke(style.getStroke());

	// TEXT
	var newText = null;
	if (style.getText()) {
		var font =
			style.getText().getFont() ? style.getText().getFont() : null;
		/*
		var rotation =
			style.getText().getRotation() ? style.getText().getRotation() : 0;
		var scale =
			style.getText().getScale() ? style.getText().getScale() : 1;
		*/
		var text =
			typeof style.getText().getText() === 'string' ?
                style.getText().getText() : "";
		/*
		var textAlign =
			style.getText().getTextAlign() ? style.getText().getTextAlign() : "center";
		var textBaseline =
			style.getText().getTextBaseline() ? style.getText().getTextBaseline() : "middle";
		var offsetX =
			style.getText().getOffsetX() ? style.getText().getOffsetX() : 0;
		var offsetY =
			style.getText().getOffsetY() ? style.getText().getOffsetY() : 0;
		*/
		var stroke = ome.ol3.utils.Style.cloneStroke(style.getText().getStroke());
		var fill = style.getText().getFill() ?
			new ol.style.Fill({"color" : style.getText().getFill().getColor()}) : null;

		// for our purposes and for now we are not going to set some things which
		// have sensible defaults anyhow
		newText = new ol.style.Text({
			"font" : font,
			//"rotation" : rotation,
			//"scale" : scale,
			"text" : text,
			//"textAlign" : textAlign,
			//"textBaseline" : textBaseline,
			//"offsetX" : offsetX,
			//"offsetY" : offsetY,
			"stroke" : stroke,
			"fill" : fill
		});
	}

	if (newFill !== null || newStroke !== null || newText !== null)
		newStyle = new ol.style.Style({
			"fill" : newFill, "stroke" : newStroke, "text" : newText});

	return newStyle;
}

/**
 * Produces a deep copy of the style stroke object handed in.
 *
 * @private
 * @static
 * @function
 * @param {ol.style.Stroke} stroke the stroke object to clone
 * @return {ol.style.Stroke|null} an open layer's stroke instance or null
 */
 ome.ol3.utils.Style.cloneStroke = function(stroke) {
 	if (!(stroke instanceof ol.style.Stroke)) return null;

	var strokeColor = stroke.getColor() ? stroke.getColor() : null;
	var strokeWidth = stroke.getWidth() ? stroke.getWidth() : 1;
	var lineCap = stroke.getLineCap() ? stroke.getLineCap() : "butt";
	var lineDash = stroke.getLineDash() ? stroke.getLineDash() : null;
	var lineJoin = stroke.getLineJoin() ? stroke.getLineJoin() : "miter";
	var miterLimit = stroke.getMiterLimit() ? stroke.getMiterLimit() : 20;

	return new ol.style.Stroke({
		"color" : strokeColor,
		"lineCap" : lineCap,
		"lineDash" : lineDash,
		"lineJoin" : lineJoin,
		"miterLimit" : miterLimit,
		"width" : strokeWidth
	});
}

/**
 * Modifies styles for a given set of features
 *
 * @static
 * @function
 * @param {Object} shape_info the shape info containing style among other things
 * @param {ome.ol3.source.Regions} regions_reference a reference to the regions instance
 * @param {ol.Collection} feats a collection of features
 * @param {function=} callback a success handler
 */
ome.ol3.utils.Style.modifyStyles =
    function(shape_info, regions_reference, feats, callback) {
	if (!(regions_reference instanceof ome.ol3.source.Regions) ||
			 typeof(shape_info) !== 'object') return;

    // use the selected features if no handed ins were present
	if (!(feats instanceof ol.Collection)) {
		if (regions_reference.select_ === null) return;
		feats =  regions_reference.select_.getFeatures();
	}

    var ids = [];
    var features = feats.getArray();
    for (var i=0;i<features.length;i++) {
        var feature = features[i];

		if (feature instanceof ol.Feature) {
            // we pick the type from the existing feature
            var type = feature['type'].toLowerCase();
            shape_info['type'] = type;
            // check for arrow markers
            if (type === 'line' || type === 'polyline') {
                if (typeof shape_info['markerStart'] === 'string')
                    feature.getGeometry().has_start_arrow_ =
                        shape_info['markerStart'] === 'Arrow';
                if (typeof shape_info['markerEnd'] === 'string')
                    feature.getGeometry().has_end_arrow_ =
                        shape_info['markerEnd'] === 'Arrow';
            }
            var newStyle = ome.ol3.utils.Style.createFeatureStyle(
                shape_info, (type === 'label'), false);
            if (newStyle === null) continue;

			var style = feature.getStyle();
			if (typeof(style) === 'function')
				style = style(
					regions_reference.viewer_.viewer_.getView().getResolution());
                if (ome.ol3.utils.Misc.isArray(style)) style = style[0];
				var newFillStyle =
					newStyle.getFill() ? newStyle.getFill() : style.getFill();

				var newStrokeStyle = null;
				// first restore the old stroke style before selection
				if (typeof(feature['oldStrokeStyle']) === 'object' &&
							feature['oldStrokeStyle'] !== null) {
					newStrokeStyle = new ol.style.Stroke();
					newStrokeStyle.setColor(
						feature['oldStrokeStyle']['color']);
					newStrokeStyle.setWidth(
						feature['oldStrokeStyle']['width']);
					newStrokeStyle.setLineDash(
						feature['oldStrokeStyle']['lineDash']);
					newStrokeStyle.setLineCap(
						feature['oldStrokeStyle']['lineCap']);
					newStrokeStyle.setLineJoin(
						feature['oldStrokeStyle']['lineJoin']);
					newStrokeStyle.setMiterLimit(
						feature['oldStrokeStyle']['miterLimit']);
				}
				if (newStyle.getStroke()) {
					if (newStrokeStyle === null)
						newStrokeStyle = new ol.style.Stroke();
					// mix in new properties
					if (newStyle.getStroke().getColor())
						newStrokeStyle.setColor(newStyle.getStroke().getColor());
					if (newStyle.getStroke().getLineCap())
						newStrokeStyle.setLineCap(newStyle.getStroke().getLineCap());
					if (newStyle.getStroke().getLineDash())
						newStrokeStyle.setLineDash(newStyle.getStroke().getLineDash());
					if (newStyle.getStroke().getLineJoin())
						newStrokeStyle.setLineJoin(newStyle.getStroke().getLineJoin());
					if (newStyle.getStroke().getMiterLimit())
						newStrokeStyle.setMiterLimit(newStyle.getStroke().getMiterLimit());
					if (newStyle.getStroke().getWidth())
						newStrokeStyle.setWidth(newStyle.getStroke().getWidth());
				}
				var newTextStyle = style.getText();
				if (newTextStyle === null &&
                        feature['oldText'] instanceof ol.style.Text) {
                    var tmp = newStyle.getText();
                    if (tmp instanceof ol.style.Text) {
                        if (typeof tmp.getText() === 'string')
                            feature['oldText'].text_ = tmp.getText();
                        if (typeof tmp.getFont() === 'string')
                            feature['oldText'].font_ = tmp.getFont();
                        if (newStrokeStyle)
                            feature['oldText'].fill_ = newStrokeStyle;
                    }
                } else if (newTextStyle === null)
					newTextStyle = newStyle.getText();
				else if (newStyle.getText()) {
					// mix in new properties
					if (newStyle.getText().getFont())
						newTextStyle.setFont(newStyle.getText().getFont());
					if (newStyle.getText().getOffsetX())
						newTextStyle.setOffsetX(newStyle.getText().getOffsetX());
					if (newStyle.getText().getOffsetY())
						newTextStyle.setOffsetY(newStyle.getText().getOffsetY());
					if (newStyle.getText().getFill())
						newTextStyle.setFill(newStyle.getText().getFill());
					if (newStyle.getText().getRotation())
						newTextStyle.setRotation(newStyle.getText().getRotation());
					if (newStyle.getText().getScale())
						newTextStyle.setScale(newStyle.getText().getScale());
					if (newStyle.getText().getStroke())
						newTextStyle.setStroke(newStyle.getText().getStroke());
					if (typeof newStyle.getText().getText() === 'string')
						newTextStyle.setText(newStyle.getText().getText());
					if (newStyle.getText().getTextAlign())
						newTextStyle.setTextAlign(newStyle.getText().getTextAlign());
					if (newStyle.getText().getTextBaseline())
						newTextStyle.setTextBaseline(newStyle.getText().getTextBaseline());
				}
				var newMixedStyle = new ol.style.Style({
					"fill" : newFillStyle,
					"stroke" : newStrokeStyle,
					"text" : newTextStyle
				});

				// reset oldStrokeStyle so that it is set with the new one
				delete feature['oldStrokeStyle'];
				feature.setStyle(newMixedStyle);
				ome.ol3.utils.Style.updateStyleFunction(
					feature,
					regions_reference,
					true);

                // add id to the list for state change
                ids.push(feature.getId());
		}};

        if (ids.length > 0)
            regions_reference.setProperty(
                ids, "state", ome.ol3.REGIONS_STATE.MODIFIED, callback);
}

/**
 * Looks at the shape info and checks if, depending on the type some vital
 * information is missing so that the shape could not be constructed, in which
 * case we fill the gaps by providing sensible defaults or random gap-fillers.
 *
 * @static
 * @private
 * @param {Object} shape_info the roi shape information
 * @param {number} number the number of shapes that should be generated
 * @param {ol.Extent} extent the portion of the image used for generation (bbox format)
 * @param {boolean=} random_placement should the shapes be generated in random places?
 */
ome.ol3.utils.Style.remedyShapeInfoIfNecessary =
	function(shape_info, number, extent, random_placement) {
		if (typeof(shape_info) !== 'object') return; // no shape info, no good

		if (typeof(shape_info['type']) !== 'string' ||
				shape_info['type'].length === 0) return;

		// we also need an extent to have an idea of placement
		if (!ome.ol3.utils.Misc.isArray(extent) || extent.length != 4)
			return null;

		// if no number has been given, we default to 1
		if (typeof(number) !== 'number')
			number = 1;
		if (number < 0) number = 1;

		// random_placement is optional, we default to false
		if (typeof(random_placement) !== 'boolean')
			random_placement = false;

		var type = shape_info['type'].toLowerCase();
		if (type === 'point') {
			if (typeof(shape_info['cx']) !== 'number' &&
                typeof(shape_info['x']) !== 'number')
				shape_info['cx'] = 6;
			if (typeof(shape_info['cy']) !== 'number' &&
                typeof(shape_info['x']) !== 'number')
				shape_info['cy'] = 6;
		} else if (type === 'line') {
			if (typeof(shape_info['x1']) !== 'number')
				shape_info['x1'] = 2;
			if (typeof(shape_info['x2']) !== 'number')
				shape_info['x2'] = 17;
			if (typeof(shape_info['y1']) !== 'number')
				shape_info['y1'] = 2;
			if (typeof(shape_info['y2']) !== 'number')
				shape_info['y2'] = 2;
		} else if (type === 'polyline') {
			if (typeof(shape_info['points']) !== 'string') {
				// we have no svg path => draw a simple 3 line polyline
				shape_info['points'] = "M 2 2 L 7 7 L12 2 L17 7";
			}
		} else if (type === 'polygon') {
			if (typeof(shape_info['points']) !== 'string') {
				// we have no svg path => draw a simple polygon
				// take polyline above and close it
				shape_info['points'] = "M 2 2 L 7 7 L12 2 L17 7 Z";
			}
		} else if (type === 'rectangle') {
			if (typeof(shape_info['x']) !== 'number')
				shape_info['x'] = 2;
			if (typeof(shape_info['y']) !== 'number')
				shape_info['y'] = 2;
			if (typeof(shape_info['width']) !== 'number')
				shape_info['width'] = 15;
			if (typeof(shape_info['height']) !== 'number')
				shape_info['height'] = 15;
		 } else if (type === 'ellipse') {
				if (typeof(shape_info['cx']) !== 'number' &&
                    typeof(shape_info['x']) !== 'number')
				 shape_info['cx'] = 20;
				if (typeof(shape_info['cy']) !== 'number' &&
                    typeof(shape_info['y']) !== 'number')
					shape_info['cy'] = 15;
				if (typeof(shape_info['rx']) !== 'number' &&
                    typeof(shape_info['radiusX']) !== 'number')
				 shape_info['rx'] = 8;
				if (typeof(shape_info['ry']) !== 'number' &&
                    typeof(shape_info['radiusY']) !== 'number')
					shape_info['ry'] = 5;
 		 } else if (type === 'label') {
 				if (typeof(shape_info['fontFamily']) !== 'string')
				shape_info['fontFamily'] = "sans-serif";
				if (typeof(shape_info['fontSize']) !== 'number')
					shape_info['fontSize'] = 15;
				if (typeof(shape_info['fontStyle']) !== 'string')
					shape_info['fontStyle'] = "normal";
				 if (typeof(shape_info['textValue']) !== 'string')
				 	shape_info['textValue'] = "generated";
			 	 if (typeof(shape_info['x']) !== 'number')
				 	shape_info['x'] = 10;
				 if (typeof(shape_info['y']) !== 'number')
				 	shape_info['y'] = 10;
 		 }
};

/**
 * Looks at the shape info and checks if there is style info there.
 * If not, we put some minimal stroke properties on the shape info or else
 * we won't see anything.
 *
 * @static
 * @private
 * @param {Object} shape_info the roi shape information
 */
ome.ol3.utils.Style.remedyStyleIfNecessary = function(shape_info) {
	if (typeof(shape_info) !== 'object') return; // no shape info, no style

	var defaultStrokeColor = "#FFFFFF";
	var defaultStrokeAlpha = 1;
	var defaultStrokeWidth = 1;

	// at a minumum we'd like to see the outline if no style has been handed in
	if (typeof(shape_info['fillColor']) !== 'string' &&
	 typeof(shape_info['strokeColor']) !== 'string') {
		 shape_info['strokeColor'] = defaultStrokeColor;
		 if (typeof(shape_info['strokeAlpha']) !== 'number')
		 	shape_info['strokeAlpha'] = defaultStrokeAlpha;
			if (typeof(shape_info['strokeWidth']) !== 'number')
 		 	shape_info['strokeWidth'] = defaultStrokeWidth;
	}
};
