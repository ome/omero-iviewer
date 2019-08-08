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

import Feature from 'ol/Feature';
import Circle from 'ol/geom/Circle';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import Geometry from 'ol/geom/Geometry';
import {lineStringLength} from 'ol/geom/flat/length';
import {getUid} from 'ol/util';
import Ellipse from '../geom/Ellipse';
import Point from '../geom/Point';
import Line from '../geom/Line';
import Label from '../geom/Label';
import Polygon from '../geom/Polygon';
import Rectangle from '../geom/Rectangle';
import Regions from '../source/Regions';
import Mask from '../geom/Mask';
import {REGIONS_STATE, UNITS_LENGTH} from '../globals';
import {remedyStyleIfNecessary,
    remedyShapeInfoIfNecessary,
    measureTextDimensions,
    cloneStyle,
    createFeatureStyle,
    updateStyleFunction} from './Style';
import {isArray} from './Misc';
import {convertPointStringIntoCoords} from './Conversion';
import {getWidth, getHeight, getTopLeft} from 'ol/extent';


/**
 * The feature factory lookup table.
 * Access via {@link featureFactory} or
 * {@link lookupFeatureFunction}
 *
 * @static
 * @private
 */
export const FEATURE_FACTORY_LOOKUP_TABLE = {
    "point" : function(shape) {
        var feat =
            new Feature({
                "geometry" : new Point(
                    [shape['X'], -shape['Y']],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)});
        feat['type'] = "point";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    },
    "ellipse" : function(shape) {
        var feat =
            new Feature({"geometry" : new Ellipse(
                shape['X'], -shape['Y'], shape['RadiusX'], shape['RadiusY'],
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "ellipse";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    },
    "rectangle" : function(shape) {
        var feat = new Feature({"geometry" : new Rectangle(
            shape['X'], -shape['Y'], shape['Width'], shape['Height'],
            typeof shape['Transform'] === 'object' ?
                shape['Transform'] : null)});
        feat['type'] = "rectangle";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    }, "line" : function(shape) {
        var drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
                shape['MarkerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
                shape['MarkerEnd'] === 'Arrow';
        var feat = new Feature({"geometry" : new Line(
                [[shape['X1'], -shape['Y1']], [shape['X2'], -shape['Y2']]],
                drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "line";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    }, "polyline" : function(shape) {
        if (typeof(shape['Points']) != 'string') return null;
        var coords = convertPointStringIntoCoords(shape['Points']);
        if (coords === null) return null;
        var drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
                shape['MarkerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
                shape['MarkerEnd'] === 'Arrow';
        var feat = new Feature({"geometry" : new Line(
                coords, drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "polyline";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    }, "label" : function(shape) {
        if (typeof shape['Text'] !== 'string') shape['Text'] = '';
        if (typeof shape['FontSize']  !== 'object' ||
            shape['FontSize'] === null ||
            typeof shape['FontSize']['Value'] !== 'number') {
                shape['FontSize'] = {
                    'Value': 10,
                    'Unit': 'PIXEL'
                };
        }
        if (typeof(shape['FontFamily']) !== 'string') {
            // use as default instead
            shape['FontFamily'] = 'sans-serif';
        }
        if (typeof(shape['FontStyle']) !== 'string') {
            shape['FontStyle'] = 'normal'; // use as default instead
        }
        // combine all font properties to form a font string
        var font =
            shape['FontStyle'] + " " + shape['FontSize']['Value'] + "px " +
            shape['FontFamily'];
        // calculate the font dimensions for label
        var fontDims =
            measureTextDimensions(shape['Text'], font);
        var feat = new Feature({"geometry" :
            new Label(shape['X'], -shape['Y'], fontDims)});
        feat['type'] = "label";
        feat.setStyle(createFeatureStyle(shape, true));
        return feat;
    }, "polygon" : function(shape) {
        if (typeof(shape['Points']) != 'string') return null;

        var coords = convertPointStringIntoCoords(shape['Points']);
        if (coords === null) return null;

        var feat = new Feature({"geometry" :
            new Polygon([coords],
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "polygon";
        feat.setStyle(createFeatureStyle(shape));
        return feat;
    },
    "mask" : function(shape) {
        var feat =
            new Feature({
                "geometry" : new Mask(
                    shape['X'], -shape['Y'], shape['Width'], shape['Height'],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)});
        feat['type'] = "mask";
        feat.setStyle(createFeatureStyle(shape, true));
        return feat;
    }
};

/**
 * An intermediate (smarter) lookup with some checks applied and some corrections
 * in case of missing mandatory information
 *
 * @static
 * @param {string} type the type of feature
 * @return {function|null} the feature factory lookup function or null if something went wrong
 */
export const lookupFeatureFunction = function(type) {
    // the shape object and type has to be there
    if (typeof(type) !== 'string' || type.length === 0) return null;

    // lower case everything, just in case, no pun intended
    var type = type.toLowerCase();
    // a lookup check if we might have received an invalid type which we are
    // going to ignore
    if (typeof FEATURE_FACTORY_LOOKUP_TABLE[type] === 'undefined')
        return null;

    return FEATURE_FACTORY_LOOKUP_TABLE[type];
};

/**
 * The feature factory takes roi the roi shape type and returns
 * an openlayers feature with associated style.
 * Uses {@link source.Regions.lookupFeatureFunction} internally
 *
 * @static
 * @param {Object} shape_info the roi shape information
 * @return {Feature|null} an open layers feature or null if something went wrong
 */
export const featureFactory = function(shape_info) {
    var lookedUpTypeFunction = lookupFeatureFunction(shape_info['type']);

    if (typeof(lookedUpTypeFunction) !== 'function') {
        console.error("Failed to find factory method for shape: " + shape_info);
        return null;
    }

    // check if, at a minimum, we received style information to render the shapes
    remedyStyleIfNecessary(shape_info);

    // instantiate the feature and create its associated style
    var actualFeature = lookedUpTypeFunction(shape_info);
    if (!(actualFeature instanceof Feature)) return null;

    return actualFeature;
};

/**
 * A helper method to scale text and labels
 *
 * @static
 * @param {Feature} feature the ol feature with its geometry and style
 * @param {number} factor the scale factor that should be applied
 */
export const scaleTextAndLabels = function(feature, factor) {
    if (!(feature instanceof Feature) || typeof factor !== 'number') return;

    var featureStyle = feature.getStyle();
    if (!(featureStyle instanceof Style) ||
        !(featureStyle.getText() instanceof Text) ||
        typeof featureStyle.getText().getFont() !== 'string') return;

    var tok = featureStyle.getText().getFont().split(" ");
    if (tok.length === 3) {
        var scaledFontSize = parseInt(tok[1]) * factor;
        if (scaledFontSize < 10) scaledFontSize = 10;
        featureStyle.getText().font_ =
            tok[0] + " " + scaledFontSize + "px " + tok[2];
        if (feature.getGeometry() instanceof Label) {
            var resizedDims = measureTextDimensions(
                    featureStyle.getText().getText(),
                    featureStyle.getText().getFont(), null);
            feature.getGeometry().resize(resizedDims);
        }
    }
}

/**
 * A helper method to generate a certain number of regions.
 *
 * <pre>
 *   var shape_info =
 *      { "type" : "rectangle", "X" : 10, "Y" : 10, "Width" : 5, "Height" : 5,
 *        "StrokeColor" : -1 };
 *   generateRegion(shape_info, 10, [0, -100, 100, 0]);
 * </pre>
 *
 * @static
 * @param {Object} shape_info the roi shape information (in 'get_rois_json' format )
 * @param {number} number the number of shapes that should be generated
 * @param {ol.Extent} extent the portion of the image used for generation (bbox format)
 * @param {Array.<number>|null} position the position to place the shape(s) or null (if not given)
 * @param {boolean} is_compatible the target image is smaller or equal to the originating image
 * @return {Array<Feature>|null} an array of open layers feature or null if something went wrong
 */
export const generateRegions =
    function(shape_info, number, extent, position, is_compatible) {
        // sanity checks
        if (!isArray(extent) || extent.length != 4 ||
            typeof number !== 'number' || number <= 0) return;

        var lookedUpTypeFunction = lookupFeatureFunction(shape_info['type']);
        if (lookedUpTypeFunction == null) return null;

        if (typeof is_compatible !== 'boolean') is_compatible = false;

        // check if, at a minimum, we received style information to render the shapes
        remedyStyleIfNecessary(shape_info);
        // check if, at a minimum, we received the essential information to construct the shape
        remedyShapeInfoIfNecessary(shape_info);

        // generate the prototype feature
        var prototypeFeature = featureFactory(shape_info);
        if (prototypeFeature == null) return null;
            prototypeFeature['state'] = REGIONS_STATE.ADDED;

        var location =
            (isArray(position) && position.length === 2) ?
                position.slice() : null;
        if (location !== null || (location === null && !is_compatible)) {
            // get the bounding box for our prototype
            var bboxPrototype = prototypeFeature.getGeometry().getExtent();
            var bboxWidth = getWidth(bboxPrototype);
            var bboxHeight = getHeight(bboxPrototype);

            // can happen for lines
            if (bboxHeight === 0) bboxHeight = 1;
            if (bboxWidth === 0) bboxWidth = 1;

            // check if the width/height exceeds our available extent still
            var availableWidth = getWidth(extent);
            var availableHeight = getHeight(extent);

            // we take our prototype to the top left corner of our available Extent
            var upperLeftCornerOfPrototype = getTopLeft(bboxPrototype);
            prototypeFeature.getGeometry().translate(
                -upperLeftCornerOfPrototype[0], -upperLeftCornerOfPrototype[1]);
            // We'd like to adjust our future extent for randomization purposes
            // so that we are always going to be inside when we pick a random point
            // for the upper left corner
            var topLeftCornerOfExtent = getTopLeft(extent);
            extent =
                [0,0,(availableWidth - bboxWidth), (availableHeight - bboxHeight)];
        }

        var ret = []; // our return array
        // the actual creation loop
        for (var n=0;n<number;n++) { // we want number instances of that type...
            // clone the feature
            var newFeature =
                new Feature(
                    { "geometry" : prototypeFeature.getGeometry().clone()});
            newFeature['type'] = prototypeFeature['type'];
            newFeature.setStyle(cloneStyle(prototypeFeature.getStyle()));
            // we generate an id of the form -1:-uid
            if (typeof shape_info['shape_id'] !== 'string' ||
                shape_info['shape_id'].length === 0 ||
                shape_info['shape_id'].indexOf(":") === -1)
                    newFeature.setId(
                        (typeof shape_info['roi_id'] === 'number' ?
                            "" + shape_info['roi_id'] + ":" : "-1:") +
                                (-getUid(newFeature)));
            else newFeature.setId(shape_info['shape_id']); // state: added
                newFeature['state'] = REGIONS_STATE.ADDED;

            // if a location for pasting was given we use it
            // if not and the target image is compatible to the shape's
            // original source image => leave it in original location
            // otherwise place it in a random location in the given extent
            if (location === null && !is_compatible) {
                var randLocation = getRandomCoordinateWithinExtent(extent);
                newFeature.getGeometry().translate(
                    randLocation[0], randLocation[1])
            } else if (location !== null)
                newFeature.getGeometry().translate(location[0], location[1]);
            ret.push(newFeature);
        }

        return ret;
}


/**
 * Returns a pair of random coordinates within a given extent
 *
 * @static
 * @private
 * @param {ol.Extent} extent the extent for randomization
 * @return {Array.<number>} a coordinate tuple
 */
export const getRandomCoordinateWithinExtent = function(extent) {
    if (!isArray(extent) || extent.length != 4) return null;

    var randomMin = 0;
    var randomMax = extent[2];

    var randomX =
        Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

    randomMax = extent[3];
    var randomY =
        Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

    return [randomX, -randomY];
}

/**
 * Takes the regions info and converts it into open layers objects that can be
 * displayed and worked with on top of a vector layer.
 *
 * Doing so each level (roi or contained shape) gets a state assigned (DEFAULT):
 * see: {@link REGIONS_STATE}
 *
 * @private
 * @static
 * @param {source.Regions} regions an instance of the Regions
 * @param {boolean=} include_new_features should new, unsaved features be included?
 * @return {Array.<Feature>|null} an array of converted shapes or null
 */
export const createFeaturesFromRegionsResponse =
    function(regions, include_new_features) {
        if (!(regions instanceof Regions) ||
            !isArray(regions.regions_info_)) return null;

        var ret = [];
        for (var roi in regions.regions_info_) {
            // we gotta have an id and shapes, otherwise no features...
            if (typeof(regions.regions_info_[roi]['@id']) !== 'number' ||
                !isArray(regions.regions_info_[roi]['shapes']))
                    continue;

            var roiId = regions.regions_info_[roi]['@id'];
            // each 'level', roi or shape gets the state info property 'DEFAULT' assigned
            regions.regions_info_[roi]['state'] = REGIONS_STATE.DEFAULT;

            // descend deeper into shapes for rois
            for (var s in regions.regions_info_[roi]['shapes']) {
                var shape = regions.regions_info_[roi]['shapes'][s];
                // id, TheT and TheZ have to be present
                if (typeof(shape['@id']) !== 'number') continue;

                var combinedId = '' + roiId + ":" + shape['@id'];
                var shapeType = shape['@type'];
                // we want the type only
                var hash = shapeType.lastIndexOf("#");
                shape['type'] = (hash !== -1) ?
                    shapeType.substring(hash+1).toLowerCase() : null;
                var combinedId = '' + roiId + ":" + shape['@id']
                var shapeTindex =
                    typeof shape['TheT'] === 'number' ? shape['TheT'] : -1;
                var shapeZindex =
                    typeof shape['TheZ'] === 'number' ? shape['TheZ'] : -1;
                var shapeCindex =
                    typeof shape['TheC'] === 'number' ? shape['TheC'] : -1;
                // set state
                shape['state'] = REGIONS_STATE.DEFAULT;

                try {
                    // create the feature via the factory
                    var actualFeature = featureFactory(shape);
                    if (!(actualFeature instanceof Feature)) {
                        console.error(
                            "Failed to create " + shapeType +
                            "(" + combinedId + ") from json!");
                        continue;
                    }
                    actualFeature.setId(combinedId);

                    /*
                     * To adjust the text style to custom rotation and scale schanges
                     * we override the style information with something more flexible,
                     * namely a styling function returning the style.
                     */
                    var rot = regions.viewer_.viewer_.getView().getRotation();
                    if (actualFeature.getGeometry() instanceof Label &&
                        rot !== 0 && !regions.rotate_text_)
                            actualFeature.getGeometry().rotate(-rot);
                    updateStyleFunction(actualFeature, regions, true);

                    // set attachments
                    actualFeature['TheT'] = shapeTindex;
                    actualFeature['TheZ'] = shapeZindex;
                    actualFeature['TheC'] = shapeCindex;
                    actualFeature['state'] = REGIONS_STATE.DEFAULT;

                    // append permissions
                    if (typeof shape['omero:details'] !== 'object' ||
                        shape['omero:details'] === null ||
                        typeof shape['omero:details']['permissions'] !== 'object' ||
                        shape['omero:details']['permissions'] === null) {
                            // permissions are mandatory
                            // otherwise we don't add the shape
                            console.error("Missing persmissons for shape " +
                                actualFeature.getId());
                            continue;
                    }
                    actualFeature['permissions'] =
                        shape['omero:details']['permissions'];
                    // calculate area/length
                    regions.getLengthAndAreaForShape(actualFeature, true);
                    // add us to the return array
                    ret.push(actualFeature);
                } catch(some_error) {
                    console.error(
                        "Failed to create ol3 feature for: " + combinedId);
                    console.error(some_error);
                    continue;
                }
            }
        }

        // we include any new, unsaved shapes if any exist and are for the present
        // time and plane
        if (typeof include_new_features === 'boolean' && include_new_features &&
                typeof regions.new_unsaved_shapes_ === 'object')
            for (var f in regions.new_unsaved_shapes_) {
                var newUnsFeat = regions.new_unsaved_shapes_[f];
                var newUnsFeatT =
                    typeof newUnsFeat['TheT'] === 'number' ?
                        newUnsFeat['TheT'] : -1;
                var newUnsFeatZ =
                    typeof newUnsFeat['TheZ'] === 'number' ?
                        newUnsFeat['TheZ'] : -1;
                if (newUnsFeatT === -1 || newUnsFeatZ === -1 ||
                    (regions.viewer_.getDimensionIndex('t') === newUnsFeatT &&
                    regions.viewer_.getDimensionIndex('z') === newUnsFeatZ))
                    ret.push(newUnsFeat);
            }

        return ret;
}

/**
 * Uses the respective ol3 code to get the length and area of a geometry
 *
 * @static
 * @param {Feature or Geometry} feature the feature containing the geometry
 * @param {boolean} recalculate flag: if true we redo the measurement (default: false)
 * @param {number} pixel_size the pixel_size
 * @param {string} pixel_symbol the pixel_symbol
 * @return {Object} an object containing shape id, area and length
 */
export const calculateLengthAndArea =
    function(feature, recalculate, pixel_size, pixel_symbol) {
        if (typeof pixel_size !== 'number') pixel_size = 1;

        var geom = feature.getGeometry ? feature.getGeometry() : feature;
        // we represent points as circles
        var hasArea =
            !(geom instanceof Circle) &&
            !(geom instanceof Line) &&
            !(geom instanceof Label);
        // for now we only calculate length for line geometries
        // TODO: adjust if perimeter for closed geometries is needed as well
        var hasLength = geom instanceof Line;

        // if we are not micron we convert
        if (typeof pixel_symbol !== 'string' ||
            pixel_symbol.localeCompare('\u00B5m') !== 0) {
            for (var u=0;u<UNITS_LENGTH.length;u++) {
                var unit = UNITS_LENGTH[u];
                if (unit.symbol.localeCompare(pixel_symbol) === 0) {
                    pixel_size *= unit.multiplier;
                    break;
                }
            }
        }

        // rounding helper
        var roundAfterThreeDecimals = function(value) {
            if (value < 0) return value;

            return Number(Math.round(value +'e3') + 'e-3');
        };

        if (feature instanceof Feature) {
            // we recalculate regardless if we don't have a length/area yet
            if (typeof feature['Area'] !== 'number' || recalculate)
                feature['Area'] = hasArea ?
                    roundAfterThreeDecimals(
                        geom.getArea() * (pixel_size * pixel_size)) : -1;
            if (typeof feature['Length'] !== 'number' || recalculate)
                feature['Length'] = hasLength ?
                    roundAfterThreeDecimals(geom.getLength() * pixel_size) : -1;
            return {
                'id' : feature.getId(),
                'Area': feature['Area'],
                'Length': feature['Length']
            };
        } else {
            let rv = {};
            if (hasLength) {
                rv.Length = roundAfterThreeDecimals(geom.getLength() * pixel_size);
            }
            if (hasArea) {
                rv.Area = roundAfterThreeDecimals(geom.getArea() * (pixel_size * pixel_size))
            }
            return rv;
        }
}

/**
 * Returns the length of a given geometry
 *
 * @static
 * @param {ol.geom.Geometry} geom the geometry
 * @return {number} the length of the geometry or 0 (if no geometry)
 */
export const getLength = function(geom) {
    if (!(geom instanceof Geometry)) return 0;
    return lineStringLength(
        geom.flatCoordinates, 0,
        geom.flatCoordinates.length, geom.stride);
}
