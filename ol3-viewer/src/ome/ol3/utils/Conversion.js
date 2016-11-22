/**
 * @namespace ome.ol3.utils.Conversion
 */
goog.provide('ome.ol3.utils.Conversion');

/**
 * Converts a color given as a rgb(a) string, e.g. 'rgba(255,255,255, 0.75)'
 * into an internal color object looking like this:
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * If the string is only rgb, you can either hand in an alpha value as a
 * second (optional) argument, otherwise it will default to : 1.0
 *
 * @static
 * @function
 * @param {string} rgba the color in rgb(a) string notation
 * @param {number=} alpha an optional alpha channel for rgb strings
 * @return {object|null} returns the color as an object or null if parse errors
 */
 ome.ol3.utils.Conversion.convertRgbaColorFormatToObject = function(rgba, alpha) {
		if (typeof(rgba) !== 'string' || rgba.length === 0) return null;
		if (typeof(alpha) !== 'number')
			alpha = 1.0;

		try {
			var strippedRgba = rgba.replace(/\(rgba|\(|rgba|rgb|\)/g, "");
			var tokens = strippedRgba.split(",");
			if (tokens.length < 3) return null; // at a minimum we need 3 channels

			// prepare return object
			var ret = {'red' : 255, 'green' : 255, 'blue' : 255, 'alpha' : alpha};

			ret['red'] = parseInt(tokens[0], 10);
			ret['green'] = parseInt(tokens[1], 10);
			ret['blue'] = parseInt(tokens[2], 10);
			if (tokens.length > 3) // optional alpha
				ret['alpha'] = parseFloat(tokens[3], 10);
		} catch (parse_error) {
			return null;
		}

	// some final asserts to verify bounds
	if (ret['red'] < 0 || ret['red'] > 255 ||
				ret['green'] < 0 || ret['green'] > 255 ||
				ret['blue'] < 0 || ret['blue'] > 255)
		console.error('RGB values need to range in between 0 and 255!');
		if (ret['alpha'] < 0 || ret['alpha'] > 1)
			console.error('Alpha values need to range in between 0 and 1!');

		return ret;
}

/**
 * Converts a color given as a rgb(a) array, e.g. [244,112,444, 0.5]
 * into an internal color object looking like this:
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * If the string is only rgb, you can either hand in an alpha value as a
 * second (optional) argument, otherwise it will default to : 1.0
 *
 * @static
 * @function
 * @param {Array.<number>} rgba the colors in an array of length 3 (rgb) or 4 (rgba)
 * @param {number=} alpha an optional alpha channel for rgb strings
 * @return {object|null} returns the color as an object or null if parse errors
 */
 ome.ol3.utils.Conversion.convertColorArrayToObject = function(rgba, alpha) {
     if (!ome.ol3.utils.Misc.isArray(rgba) || rgba.length < 3) return null;

     if (rgba.length === 3 && typeof(alpha) !== 'number') alpha = 1.0;
     else alpha = rgba[3];

     return {
         "red" : rgba[0], "green" : rgba[1], "blue" : rgba[2], "alpha" : alpha
     }
}

/**
 * Converts a color given as a hex string, e.g. '#ffffff'
 * into an internal color object looking like this:
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * You can either choose to hand in a value for the alpha channel as a second
 * parameter or the default of 1.0 will be used
 *
 * @static
 * @function
 * @param {string} hex the color in hex string notation
 * @param {number=} alpha an optional alpha channel or 1.0 by default
 * @return {object|null} returns the color as an object or null if parse errors
 */
 ome.ol3.utils.Conversion.convertHexColorFormatToObject = function(hex, alpha) {
		 if (typeof(hex) !== 'string' || hex.length === 0) return null;
		 if (typeof(alpha) !== 'number')
			 alpha = 1.0;

		try {
			// strip white space and #
			var strippedHex = hex.replace(/#|\s/g, "");
            if (strippedHex.length === 3)
                strippedHex = '' +
                    strippedHex[0] + strippedHex[0] +
                    strippedHex[1] + strippedHex[1] +
                    strippedHex[2] + strippedHex[2];
			if (strippedHex.length != 6) return null;

			// prepare return object
			var ret = {'red' : 255, 'green' : 255, 'blue' : 255, 'alpha' : alpha};

			ret['red'] = parseInt(strippedHex.substring(0,2), 16);
			ret['green'] = parseInt(strippedHex.substring(2,4), 16);
			ret['blue'] = parseInt(strippedHex.substring(4,6), 16);

			return ret;
		} catch (parse_error) {
			return null;
		}
}

/**
 * Builds a hex color string (#ffffff) from a color object such as this one.
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * Alpha will be ignored since hex strings don't encode the alpha channel
 *
 * @static
 * @param {object} color the color object
 * @return {string|null} returns the color as hex string or null (if incorrect color object)
 */
ome.ol3.utils.Conversion.convertColorObjectToHex = function(color) {
	var checkedColorObject =
		ome.ol3.utils.Conversion.checkColorObjectCorrectness(color);

	if (checkedColorObject == null) return null;

	var ret = "#";
	ret +=  ("00" + checkedColorObject['red'].toString(16)).substr(-2);
	ret +=  ("00" + checkedColorObject['green'].toString(16)).substr(-2);
	ret +=  ("00" + checkedColorObject['blue'].toString(16)).substr(-2);

	return ret;
}

/**
 * Builds a rgba color string, e.g. 'rgba(255,255,255,1.0)'
 * from a color object such as this one.
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 *
 * @static
 * @param {object} color the color object
 * @return {string|null} returns the color as rgba string or null (if incorrect color object)
 */
ome.ol3.utils.Conversion.convertColorObjectToRgba = function(color) {
	var checkedColorObject =
		ome.ol3.utils.Conversion.checkColorObjectCorrectness(color);

	if (checkedColorObject == null) return null;

	var ret = "rgba(";
	ret += checkedColorObject['red'].toString(10) + ",";
	ret += checkedColorObject['green'].toString(10) + ",";
	ret += checkedColorObject['blue'].toString(10) + ",";
	ret += checkedColorObject['alpha'].toString(10);
	ret += ")";

	return ret;
}

/**
 * Checks the correctness of a color object which has to look like this
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * We take the alpha channel to be optional
 *
 * @static
 * @private
 * @param {object} color the color object
 * @return {object|null} returns the handed in object or null (if incorrect)
 */
ome.ol3.utils.Conversion.checkColorObjectCorrectness = function(color) {
	if (typeof(color) !== 'object') return null;

	// check correctness of color object,
	// we take alpha to be optional, setting it to 1
	var needsToBeThere = ["red", "green", "blue"];
	for (var n in needsToBeThere) {
		if (typeof(color[needsToBeThere[n]]) === 'undefined')
			return null;
		var c = color[needsToBeThere[n]];
		if (c < 0 || c > 255) return null;
	}
	if (typeof(color['alpha']) === 'undefined')
		color['alpha'] = 1.0;

	return color;
}

/**
 * Omero Server api wants RGBA information for regions as a signed integer
 * while open layers works with ol.style.Style objects that accept color/alpha
 * as rgba(255,255,255, 0.75) as well as hex rgb colors, i.e. #ffffff.
 * This routine does the conversion.
 *<p/>
 *
 * Note: Depending on the format it might employ the services of 2 other conversion
 * routines
 * <ul>
 * <li>{@link ome.ol3.utils.Conversion.convertRgbaColorFormatToObject}</li>
 * <li>{@link ome.ol3.utils.Conversion.convertHexColorFormatToObject}</li>
 * <li>{@link ome.ol3.utils.Conversion.convertColorArrayToObject}</li>
 * </ul>
 * Alternatively it also accepts color information in internal object notation
 * (such as the aboved functions will convert it into):
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * @static
 * @function
 * @param {string|object} color the color/alpha info in the form of hex, rgb(a) or object notation
 * @param {number=} alpha an optinal alpha value if the color argument does not include one
 * @return {number|null} returns the color/alpha info encoded in a signed integer
 */
ome.ol3.utils.Conversion.convertColorToSignedInteger = function(color, alpha) {
	if (typeof(alpha) !== 'number') {// check optional alpha argument
		try {
			alpha = parseInt(alpha);
		} catch(notANumber) {
			alpha = 1.0;
		}
	}

	if (typeof(color) == 'string') { // delegate to appropriate conversion
		if (color.indexOf('rgba') != -1)
			color = ome.ol3.utils.Conversion.convertRgbaColorFormatToObject(color, alpha);
		else
			color = ome.ol3.utils.Conversion.convertHexColorFormatToObject(color, alpha);
	} else if (ome.ol3.utils.Misc.isArray(color))
        color = ome.ol3.utils.Conversion.convertColorArrayToObject(color, alpha);

	if ((typeof(color) !== 'object') || // last check of correctness
		typeof((color = ome.ol3.utils.Conversion.checkColorObjectCorrectness(color))) !== 'object') {
		return null;
	}

	var decimalMultiplied = color['alpha'] * 255;
	var decimalOnly = decimalMultiplied - parseInt(decimalMultiplied);
	alpha =
        decimalOnly <= 0.5 ?
            Math.floor(decimalMultiplied) : Math.ceil(decimalMultiplied);

    return ((alpha << 24) |
                (color['red'] << 16) | (color['green'] << 8) | color['blue']);
}

/**
 * Turns a shape of type point (ol.geom.Circle) into a json object
 *
 * @static
 * @function
 * @param {ol.geom.Circle} geometry the circle instance for the point feature
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.pointToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ol.geom.Circle))
		throw "shape type point must be of instance ol.geom.Circle!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point";

	var center = geometry.getCenter();
	ret['X'] = center[0];
	ret['Y'] = -center[1];

	return ret;
}

/**
 * Turns a shape of type ellipse (ome.ol3.geom.Ellipse) into a json object
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Ellipse} geometry the ellipse instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.ellipseToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ome.ol3.geom.Ellipse))
		throw "shape type ellipse must be of instance ome.ol3.geom.Ellipse!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Ellipse";

	var center = geometry.getCenter();
	ret['X'] = center[0];
	ret['Y'] = -center[1];

	var radius = geometry.getRadius();
	ret['RadiusX'] = radius[0];
	ret['RadiusY'] = radius[1];

    if (geometry.getTransform()) ret['Transform'] = geometry.getTransform();

	return ret;
}

/**
 * Turns a shape of type rectangle (ome.ol3.geom.Rectangle) into a json object
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Rectangle} geometry the rectangle instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.rectangleToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ome.ol3.geom.Rectangle))
		throw "shape type rectangle must be of instance ome.ol3.geom.Rectangle!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle";

	var topLeftCorner = geometry.getUpperLeftCorner();
	ret['X'] = topLeftCorner[0];
	ret['Y'] = -topLeftCorner[1];

	ret['Width'] = geometry.getWidth();
	ret['Height'] = geometry.getHeight();

	return ret;
}

/**
 * Turns a shape of type line (ome.ol3.geom.Line) into a json object
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Line} geometry the line instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.lineToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ome.ol3.geom.Line))
		throw "shape type line must be of instance ome.ol3.geom.Line!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	var flatCoords = geometry.getFlatCoordinates();
	//delegate if we happen to have turned into a polyline
	if (geometry.isPolyline())
		return ome.ol3.utils.Conversion.polylineToJsonObject.call(
            null, geometry, shape_id);

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Line";

	ret['X1'] = flatCoords[0];
	ret['X2'] = flatCoords[2];

	ret['Y1'] = -flatCoords[1];
	ret['Y2'] = -flatCoords[3];

    if (geometry.has_start_arrow_) ret['MarkerStart'] = "Arrow";
    if (geometry.has_end_arrow_) ret['MarkerEnd'] = "Arrow";

	return ret;
}

/**
 * Turns a shape of type polyline (ome.ol3.geom.Line) into a json object
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Line} geometry the polyline instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.polylineToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ome.ol3.geom.Line))
		throw "shape type polyline must be of instance ome.ol3.geom.Line!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	var flatCoords = geometry.getFlatCoordinates();
	//delegate if we happen to have turned into a line
	if (!geometry.isPolyline())
		return ome.ol3.utils.Conversion.lineToJsonObject.call(null, geometry, shape_id);

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline";

	ret['Points'] = "";
	for (var i=0; i<flatCoords.length;i+= 2) {
		if (i !== 0 && i % 2 === 0)
			ret['Points'] += " ";
		ret['Points'] += flatCoords[i] + "," + (-flatCoords[i+1]);
	}

    if (geometry.has_start_arrow_) ret['MarkerStart'] = "Arrow";
    if (geometry.has_end_arrow_) ret['MarkerEnd'] = "Arrow";

	return ret;
}

/**
 * Turns a shape of type label (ome.ol3.geom.Label) into json
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Label} geometry the label instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into a json object
 */
ome.ol3.utils.Conversion.labelToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ome.ol3.geom.Label))
		throw "shape type label must be of instance ome.ol3.geom.Label!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label";

	var topLeftCorner = geometry.getUpperLeftCorner();
	ret['X'] = topLeftCorner[0];
	ret['Y'] = -topLeftCorner[1];

	return ret;
}

/**
 * Turns a shape of type polygon (ol.geom.Polygon) into a json object
 *
 * @static
 * @function
 * @param {ol.geom.Polygon} geometry the polygon instance
 * @param {number=} shape_id the shape it. if shape is new, it's: -1
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.polygonToJsonObject = function(geometry, shape_id) {
	if (!(geometry instanceof ol.geom.Polygon))
		throw "shape type polygon must be of instance ol.geom.Polygon!";

	var shapeId = typeof(shape_id) === 'number' ? shape_id : -1;

	var ret = {};
	if (shapeId >= 0)
		ret['@id'] = shapeId;

	ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon";

	var flatCoords = geometry.getFlatCoordinates();

	ret['Points'] = "";
	for (var i=0; i<flatCoords.length;i+= 2) {
		if (i !== 0 && i % 2 === 0)
			ret['Points'] += " ";
		ret['Points'] += flatCoords[i] + "," + (-flatCoords[i+1]);
	}

	return ret;
}

/**
 * A lookup table for the conversion function
 * @static
 * @private
 * @return {function} the conversion function for the specific shape type
 */
ome.ol3.utils.Conversion.LOOKUP = {
	"point" : ome.ol3.utils.Conversion.pointToJsonObject,
	"ellipse" : ome.ol3.utils.Conversion.ellipseToJsonObject,
	"rectangle" : ome.ol3.utils.Conversion.rectangleToJsonObject,
	"line" : ome.ol3.utils.Conversion.lineToJsonObject,
	"polyline" : ome.ol3.utils.Conversion.polylineToJsonObject,
	"label" : ome.ol3.utils.Conversion.labelToJsonObject,
	"polygon" : ome.ol3.utils.Conversion.polygonToJsonObject
};

/**
 * Turns a shape's style to json. This function is used by:
 * {@link ome.ol3.utils.Conversion.toJsonObject}
 *
 * @static
 * @private
 * @function
 * @param {ol.Feature} feature whose style (function) we like to use
 * @param {Object} jsonObject an object containing shape information
 */
ome.ol3.utils.Conversion.integrateStyleIntoJsonObject = function(feature, jsonObject) {
	if (typeof(jsonObject) !== 'object' ||
	 			typeof(jsonObject['@type']) !== 'string' ||
				!(feature instanceof ol.Feature) ||
				(!(feature.getStyle() instanceof ol.style.Style) &&
				 	typeof(feature.getStyle()) !== 'function'))
		return;

    // we now have an array of styles (due to arrows)
	var presentStyle = feature.getStyle();
	if (typeof(presentStyle) === 'function')
		presentStyle = presentStyle(1);
    if (ome.ol3.utils.Misc.isArray(presentStyle))
        presentStyle = presentStyle[0];
	if (!(presentStyle instanceof ol.style.Style))
		return;

	var isLabel =
		jsonObject['@type'] ===
	 		'http://www.openmicroscopy.org/Schemas/OME/2016-06#Label';
    var presentFillColor =
        isLabel && presentStyle.getText() && presentStyle.getText().getFill() ?
            presentStyle.getText().getFill().getColor() :
                presentStyle.getFill() ? presentStyle.getFill().getColor() : null;
	if (presentFillColor)
		jsonObject['FillColor'] =
			ome.ol3.utils.Conversion.convertColorToSignedInteger(presentFillColor);

	var presentStrokeStyle =
		isLabel && presentStyle.getText() && presentStyle.getText().getStroke() ?
			presentStyle.getText().getStroke().getColor() :
				((typeof(feature['oldStrokeStyle']) === 'object' &&
					typeof(feature['oldStrokeStyle']['color']) !== 'undefined') ?
						feature['oldStrokeStyle']['color'] : null);

	if (presentStrokeStyle) { // STROKE
			jsonObject['StrokeColor'] =
				ome.ol3.utils.Conversion.convertColorToSignedInteger(presentStrokeStyle);
	}
	var presentStrokeWidth =
		(typeof(feature['oldStrokeStyle']) === 'object' &&
			feature['oldStrokeStyle'] !== null &&
			typeof(feature['oldStrokeStyle']['width']) === 'number') ?
				feature['oldStrokeStyle']['width'] : 1;

	jsonObject['StrokeWidth'] = {
		'@type': 'TBD#LengthI',
		'Unit': 'PIXEL',
		'Symbol': 'px',
		'Value':
			isLabel && presentStyle.getText() && presentStyle.getText().getStroke() ?
			presentStyle.getText().getStroke().getWidth() : presentStrokeWidth
	};

    var presentText = presentStyle.getText();
    if (presentText === null && feature['oldText'] instanceof ol.style.Text)
        presentText = feature['oldText'];
	if (presentText instanceof ol.style.Text) {  // TEXT
		if (presentText.getText())
			jsonObject['Text'] = presentText.getText();
		if (presentText.getFont()) {
			var font = presentText.getFont();
			var fontTokens = font.split(' ');
			if (fontTokens.length == 3) {
				try {
					jsonObject['FontStyle'] = fontTokens[0];
					jsonObject['FontSize'] =  {
                        '@type': 'TBD#LengthI',
                        'Unit': 'PIXEL',
                        'Symbol': 'px',
                        'Value': parseInt(fontTokens[1])};
					jsonObject['FontFamily'] = fontTokens[2];
				} catch(notANumber) {
					// nothing we can do
				}
			}
		}
	}
}

/**
 * Adds miscellanous information linked to the shape that wants to be persisted.
 * see: {@link ome.ol3.utils.Conversion.toJsonObject}
 *
 * @static
 * @private
 * @function
 * @param {ol.Feature} feature the open layers feature that holds shape information
 * @param {Object} jsonObject an object containing shape information
 */
ome.ol3.utils.Conversion.integrateMiscInfoIntoJsonObject  = function(feature, jsonObject) {
	if (typeof(jsonObject) !== 'object' ||
				!(feature instanceof ol.Feature))
		return;

	if (typeof(feature['theT']) === 'number' && feature['theT'] !== -1)
		jsonObject['TheT'] = feature['theT'];
	if (typeof(feature['theZ']) === 'number' && feature['theZ'] !== -1)
		jsonObject['TheZ'] = feature['theZ'];
	if (typeof(feature['theC']) === 'number' && feature['theC'] !== -1)
		jsonObject['TheC'] = feature['theC'];

    if (feature['state'] === ome.ol3.REGIONS_STATE.REMOVED)
        jsonObject['markedForDeletion'] = true;
}

/**
 * Turns an openlayers feature/geometry into a json shape definition that
 * can then be marshalled by omero marshal and stored
 *
 * @static
 * @function
 * @param {ol.Collection} features a collection of ol.Feature
 * @param {boolean} storeNewShapesInSeparateRois new shapes are stored in a new roi EACH. default: false
 * @param {boolean=} returnFlattenedArray, returns shape objects with id roi:shape, default: false
 * @return {Object|null} returns an assocative array of rois with contained shapes or null if something went wrong badly
 */
ome.ol3.utils.Conversion.toJsonObject = function(
    features, storeNewShapesInSeparateRois,returnFlattenedArray) {
	if (!(features instanceof ol.Collection) ||
            features.getLength() === 0) return null;

	var newRoisForEachNewShape =
		typeof(storeNewShapesInSeparateRois) === 'boolean' ?
            storeNewShapesInSeparateRois : false;

    if (typeof returnFlattenedArray !== 'boolean') returnFlattenedArray = false;

	var currentNewId = -1;
	var roisToBeStored = {"count" : 0};
    var rois = {};

    var feats = features.getArray();
    for (var i=0;i<feats.length;i++) {
        var feature = feats[i];

		// we skip if we are not a feature or have no geometry (sanity check)
		// OR if we haven't a state or the state is unchanged
		if (!(feature instanceof ol.Feature) || feature.getGeometry() === null ||
					typeof(feature['state']) !== 'number' || // no state info or unchanged
					feature['state'] === ome.ol3.REGIONS_STATE.DEFAULT)
					continue;

		var roiId = -1;
		var shapeId = -1;

		// dissect id which comes in the form roiId:shapeId
		if (typeof(feature.getId()) !== 'string' || feature.getId().length < 3)
			continue; // we skip it, we must have at least x:x for instance

		var colon = feature.getId().indexOf(":");
		if (colon < 1) // colon cannot be before 2nd position
			continue;

		roiId = feature.getId().substring(0,colon);
		shapeId = feature.getId().substring(colon+1)
		try {
			roiId = parseInt(roiId);
			shapeId = parseInt(shapeId);
		} catch(notAnumber) {
			continue; // we are not a number
		}

        // we don't want newly added but immediately deleted shapes
        if (feature['state'] === ome.ol3.REGIONS_STATE.REMOVED &&
                shapeId === -1) continue;

		// now that we have the roi and shape id we check whether we have them in
		// our associative array already or we need to create it yet
		var roiIdToBeUsed = roiId;
        // unless we are new we'd like to use the original roi id
		// new shapes have by default a -1 for the roi id,
		// we'd like to use that unless the flag is set that want to store each
		// new shape in a roi of its own
		if (feature['state'] === ome.ol3.REGIONS_STATE.ADDED && newRoisForEachNewShape)
				roiIdToBeUsed = currentNewId--;

		var roiContainer = null;
		// we exist already in our associative array, so lets add more to it
		if (typeof(rois[roiIdToBeUsed]) === 'object')
			roiContainer = rois[roiIdToBeUsed];
		else {// we need to be created
			rois[roiIdToBeUsed] = {
				"@type" : 'http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI',
				 "shapes" : []};
			roiContainer = rois[roiIdToBeUsed];
		}
		var type = feature['type'];
		try {
			var jsonObject = // retrieve object with 'geometry' type of properties
				ome.ol3.utils.Conversion.LOOKUP[type].call(
					null, feature.getGeometry(),
					feature['state'] === ome.ol3.REGIONS_STATE.ADDED ? -1 : shapeId);
			ome.ol3.utils.Conversion.integrateStyleIntoJsonObject( // add 'style' properties
				feature, jsonObject);
			// add any additional information related to the shape that needs storing
			ome.ol3.utils.Conversion.integrateMiscInfoIntoJsonObject(feature, jsonObject);
			// we like to keep the old id for later synchronization
			jsonObject['oldId'] = feature.getId();
			roiContainer['shapes'].push(jsonObject);
		} catch(conversion_error) {
			console.error("Failed to turn feature " + type + "(" + feature.getId() +
				") into json => " + conversion_error);
			continue;
		}
		roisToBeStored['count']++;
	};

	if (roisToBeStored['count'] === 0) return null;

    if (returnFlattenedArray) {
        var flattenedArray = [];
        for (var r in rois) {
            if (!ome.ol3.utils.Misc.isArray(rois[r]['shapes'])) continue;
            var shap = rois[r]['shapes'];
            for (var s in shap)
                flattenedArray.push(shap[s]);
        }
        roisToBeStored['rois'] =  flattenedArray;
    } else roisToBeStored['rois'] = rois;

	return roisToBeStored;
};
