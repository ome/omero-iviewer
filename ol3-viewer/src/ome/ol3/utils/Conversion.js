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
    if (typeof(alpha) !== 'number') alpha = 1.0;

    try {
        var strippedRgba = rgba.replace(/\(rgba|\(|rgba|rgb|\)/g, "");
        var tokens = strippedRgba.split(",");
        if (tokens.length < 3) return null; // at a minimum we need 3 channels

        // prepare return object
        var ret = {'red' : 255, 'green' : 255, 'blue' : 255, 'alpha' : alpha};
        ret['red'] = parseInt(tokens[0], 10);
        ret['green'] = parseInt(tokens[1], 10);
        ret['blue'] = parseInt(tokens[2], 10);
        // optional alpha
        if (tokens.length > 3) ret['alpha'] = parseFloat(tokens[3], 10);
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
 * <pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 * </pre>
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
    if (typeof(alpha) !== 'number') alpha = 1.0;

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
 * <pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 * </pre>
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
    ret += ("00" + checkedColorObject['red'].toString(16)).substr(-2);
    ret += ("00" + checkedColorObject['green'].toString(16)).substr(-2);
    ret += ("00" + checkedColorObject['blue'].toString(16)).substr(-2);

    return ret;
}

/**
 * Builds a rgba color string, e.g. 'rgba(255,255,255,1.0)'
 * from a color object such as this one.
 * <pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 * </pre>
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
 * <pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 * </pre>
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
        if (typeof(color[needsToBeThere[n]]) === 'undefined') return null;
        var c = color[needsToBeThere[n]];
        if (c < 0 || c > 255) return null;
    }
    if (typeof(color['alpha']) === 'undefined') color['alpha'] = 1.0;

    return color;
}

/**
 * Converts a color encoded as a signed integer (assuming RGBA order)
 * into an internal color object looking like this:
 *<pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 *</pre>
 *
 * @static
 * @param {number} signed_integer the signed integer in RGBA
 * @return {object|null} returns the color as an object or null in case of errors
 */
ome.ol3.utils.Conversion.convertSignedIntegerColorObject =
    function(signed_integer) {
        if (typeof signed_integer !== 'number') return null;

        // prepare integer to be converted to hex for easier dissection
        if (signed_integer < 0) signed_integer = signed_integer >>> 0;
        var intAsHex = signed_integer.toString(16);
        // pad with zeros to have 8 digits
        intAsHex = ("00" + intAsHex).slice(-8);

        // we expect RGBA
        return {
            "red": parseInt(intAsHex.substring(0, 2), 16),
            "green": parseInt(intAsHex.substring(2, 4), 16),
            "blue": parseInt(intAsHex.substring(4, 6), 16),
            "alpha": parseInt(intAsHex.substring(6, 8), 16) / 255
        };
 }


/**
 * Omero Server api wants RGBA information for regions as a signed integer
 * while open layers works with ol.style.Style objects that accept color/alpha
 * as rgba(255,255,255, 0.75) as well as hex rgb colors, i.e. #ffffff.
 * This routine does the conversion.
 * <p/>
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
 * <pre>
 * { red: 255, green: 255, blue: 255, alpha: 0.75 }
 * </pre>
 *
 * @static
 * @function
 * @param {string|object} color the color/alpha info in the form of hex, rgb(a) or object notation
 * @param {number=} alpha an optinal alpha value if the color argument does not include one
 * @return {number|null} returns the color/alpha info encoded in a signed integer
 */
ome.ol3.utils.Conversion.convertColorToSignedInteger = function(color, alpha) {
    if (typeof(alpha) !== 'number') {
        alpha = parseInt(alpha);
        if (isNaN(alpha)) alpha = 1.0;
    }

    if (typeof(color) == 'string') { // delegate to appropriate conversion
        if (color.indexOf('rgba') != -1)
            color = ome.ol3.utils.Conversion.convertRgbaColorFormatToObject(
                        color, alpha);
        else
            color = ome.ol3.utils.Conversion.convertHexColorFormatToObject(
                        color, alpha);
    } else if (ome.ol3.utils.Misc.isArray(color))
        color = ome.ol3.utils.Conversion.convertColorArrayToObject(color, alpha);

    if (typeof color === 'object' && color !== null &&
        typeof color['alpha'] !== 'number')
            color['alpha'] = alpha;
    if ((typeof(color) !== 'object') || // last check of correctness
        typeof((color = ome.ol3.utils.Conversion.checkColorObjectCorrectness(
                color))) !== 'object') return null;

    var decimalMultiplied = color['alpha'] * 255;
    var decimalOnly = decimalMultiplied - parseInt(decimalMultiplied);
    alpha = decimalOnly <= 0.5 ?
                Math.floor(decimalMultiplied) : Math.ceil(decimalMultiplied);

    return ((color['red'] << 24) | (color['green'] << 16) | (color['blue'] << 8)
            | alpha);
}

/**
 * Turns a shape of type point (ol.geom.Circle) into a json object
 *
 * @static
 * @function
 * @param {ol.geom.Circle} geometry the circle instance for the point feature
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.pointToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ol.geom.Circle))
        throw "shape type point must be of instance ol.geom.Circle!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
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
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.ellipseToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ome.ol3.geom.Ellipse))
        throw "shape type ellipse must be of instance ome.ol3.geom.Ellipse!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
    ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Ellipse";
    var center = geometry.getCenter();
    ret['X'] = center[0];
    ret['Y'] = -center[1];
    var radius = geometry.getRadius();
    ret['RadiusX'] = radius[0];
    ret['RadiusY'] = radius[1];
    var trans = geometry.getTransform(true);
    if (typeof trans === 'object' && trans !== null) {
        trans['@type'] =
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#AffineTransform";
        ret['Transform'] = trans;
    }

    return ret;
}

/**
 * Turns a shape of type rectangle (ome.ol3.geom.Rectangle) into a json object
 *
 * @static
 * @function
 * @param {ome.ol3.geom.Rectangle} geometry the rectangle instance
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.rectangleToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ome.ol3.geom.Rectangle))
        throw "shape type rectangle must be of instance ome.ol3.geom.Rectangle!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
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
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.lineToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ome.ol3.geom.Line))
        throw "shape type line must be of instance ome.ol3.geom.Line!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
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
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.polylineToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ome.ol3.geom.Line))
        throw "shape type polyline must be of instance ome.ol3.geom.Line!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
    var flatCoords = geometry.getFlatCoordinates();
    //delegate if we happen to have turned into a line
    if (!geometry.isPolyline())
        return ome.ol3.utils.Conversion.lineToJsonObject.call(
            null, geometry, shape_id);

    ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline";
    ret['Points'] = "";
    for (var i=0; i<flatCoords.length;i+= 2) {
        if (i !== 0 && i % 2 === 0) ret['Points'] += " ";
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
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into a json object
 */
ome.ol3.utils.Conversion.labelToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ome.ol3.geom.Label))
        throw "shape type label must be of instance ome.ol3.geom.Label!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
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
 * @param {number=} shape_id the optional shape id
 * @return {Object} returns an object ready to be turned into json
 */
ome.ol3.utils.Conversion.polygonToJsonObject = function(geometry, shape_id) {
    if (!(geometry instanceof ol.geom.Polygon))
        throw "shape type polygon must be of instance ol.geom.Polygon!";

    var ret = {};
    if (typeof shape_id === 'number') ret['@id'] = shape_id;
    ret['@type'] = "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon";
    var flatCoords = geometry.getFlatCoordinates();

    ret['Points'] = "";
    for (var i=0; i<flatCoords.length;i+= 2) {
        if (i !== 0 && i % 2 === 0) ret['Points'] += " ";
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
        typeof(feature.getStyle()) !== 'function')) return;

    // we now have an array of styles (due to arrows)
    var presentStyle = feature.getStyle();
    if (typeof(presentStyle) === 'function') presentStyle = presentStyle(1);
    if (ome.ol3.utils.Misc.isArray(presentStyle))
        presentStyle = presentStyle[0];
    if (!(presentStyle instanceof ol.style.Style)) return;

    var isLabel =
        jsonObject['@type'] ===
            'http://www.openmicroscopy.org/Schemas/OME/2016-06#Label';
    var presentFillColor =
        isLabel && presentStyle.getText() && presentStyle.getText().getFill() ?
            presentStyle.getText().getFill().getColor() :
                presentStyle.getFill() ? presentStyle.getFill().getColor() : null;
    if (presentFillColor)
        jsonObject['FillColor'] =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(
                presentFillColor);

    var presentStrokeStyle =
        isLabel && presentStyle.getText() && presentStyle.getText().getFill() ?
            presentStyle.getText().getFill().getColor() :
                ((typeof(feature['oldStrokeStyle']) === 'object' &&
                feature['oldStrokeStyle'] !== null &&
                typeof(feature['oldStrokeStyle']['color']) !== 'undefined') ?
                    feature['oldStrokeStyle']['color'] : null);

    if (presentStrokeStyle) { // STROKE
        jsonObject['StrokeColor'] =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(
                presentStrokeStyle);
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
            isLabel && presentStyle.getText() &&
            presentStyle.getText().getStroke() ?
                presentStyle.getText().getStroke().getWidth() :
                    presentStrokeWidth
    };

    var presentText = presentStyle.getText();
    if (presentText === null && feature['oldText'] instanceof ol.style.Text)
        presentText = feature['oldText'];
    if (presentText instanceof ol.style.Text) {  // TEXT
        if (presentText.getText()) jsonObject['Text'] = presentText.getText();
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
                        'Value': parseInt(fontTokens[1])
                    };
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
    if (typeof(jsonObject) !== 'object' || !(feature instanceof ol.Feature))
        return;

    if (typeof(feature['TheT']) === 'number')
        jsonObject['TheT'] = feature['TheT'];
    if (typeof(feature['TheZ']) === 'number')
        jsonObject['TheZ'] = feature['TheZ'];
    if (typeof(feature['TheC']) === 'number')
        jsonObject['TheC'] = feature['TheC'];

    if (feature['state'] === ome.ol3.REGIONS_STATE.REMOVED)
        jsonObject['markedForDeletion'] = true;
}

/**
 * Produces a json shape definition that can then be
 * used by omero marshal and for persistence
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
    if (!(features instanceof ol.Collection) || features.getLength() === 0)
        return null;

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
            feature['state'] === ome.ol3.REGIONS_STATE.DEFAULT) continue;

        // dissect id which comes in the form roiId:shapeId
        var roiId = -1;
        var shapeId = -1;
        if (typeof(feature.getId()) !== 'string' || feature.getId().length < 3)
            continue; // we skip it, we must have at least x:x for instance
        var colon = feature.getId().indexOf(":");
        if (colon < 1) continue; // colon cannot be before 2nd position
        try {
            roiId = parseInt(feature.getId().substring(0,colon));
            shapeId = parseInt(feature.getId().substring(colon+1));
            if (isNaN(roiId) || isNaN(shapeId)) continue;
        } catch(parseError) {
            continue;
        }

        // we don't want newly added but immediately deleted shapes
        if (feature['state'] === ome.ol3.REGIONS_STATE.REMOVED &&
            (roiId < 0 || shapeId < 0)) continue;

        var roiIdToBeUsed = roiId;
        // we decrement to have a unique roi id for each shape
        if (feature['state'] === ome.ol3.REGIONS_STATE.ADDED &&
            newRoisForEachNewShape) roiIdToBeUsed = currentNewId--;

        var roiContainer = null;
        if (typeof(rois[roiIdToBeUsed]) === 'object')
            roiContainer = rois[roiIdToBeUsed];
        else {
            rois[roiIdToBeUsed] = {
                "@type" : 'http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI',
                "shapes" : []
            };
            roiContainer = rois[roiIdToBeUsed];
        }

        var jsonObject =
            ome.ol3.utils.Conversion.featureToJsonObject(
                feature, shapeId, roiIdToBeUsed);
        if (jsonObject === null) continue;

        // we like to keep the old id for later synchronization
        jsonObject['oldId'] = feature.getId();
        roiContainer['shapes'].push(jsonObject);
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

/**
 * Turns an openlayers feature/geometry into a json shape definition that
 * can then be marshalled by omero marshal and stored
 *
 * @static
 * @function
 * @param {ol.Feature} feature an ol.Feature
 * @param {number=} shape_id an (optional) shape_id
 * @param {number=} roi_id an (optional) roi_id
 * @return {Object|null} returns the json definition of the shape or null if an error occured
 */
ome.ol3.utils.Conversion.featureToJsonObject = function(feature, shape_id, roi_id) {
    var type = feature['type'];
    try {
        // extract the shape id from the feature's compound rois:shape id
        if (typeof shape_id !== 'number') {
            try {
                var colon = feature.getId().indexOf(":");
                if (colon > 0) shape_id =
                    parseInt(feature.getId().substring(colon+1));
            } catch(parse_error) {
                console.error(
                    "Failed to turn feature " + type + "(" + feature.getId() +
                    ") into json => " + parse_error);
                return null;
            }
        }

        var jsonObject = // retrieve object with 'geometry' type of properties
            ome.ol3.utils.Conversion.LOOKUP[type].call(
                null, feature.getGeometry(),
                typeof roi_id !== 'number' || roi_id > -1 ? shape_id : null);

        // add 'style' properties
        ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
            feature, jsonObject);

        // add any additional information related to the shape that needs storing
        ome.ol3.utils.Conversion.integrateMiscInfoIntoJsonObject(feature, jsonObject);

        return jsonObject;
    } catch(conversion_error) {
        console.error("Failed to turn feature " + type + "(" + feature.getId() +
            ") into json => " + conversion_error);
        return null;
    }
}

/**
 * Takes a string representing poly shapes and turns it into an
 * array of coordinate pairs such that openlayers can work with it
 *
 * @static
 * @function
 * @param {string} points a string of points (x,y) separated by space
 * @return {Array.<Array.<number,number>>} returns an array of coordinate pairs
 */
ome.ol3.utils.Conversion.convertPointStringIntoCoords = function(points) {
    if (typeof points !== 'string') return null;

    var tokens = points.split(" ");
    if (tokens.length === 0) return null;

    var ret = [];
    for (var t in tokens) {
        var c = tokens[t].split(",");
        if (c.length !== 2) return null;
        ret.push([parseInt(c[0]), -parseInt(c[1])]);
    }

    return ret;
}
