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

import ol from 'ol';
import Geometry from 'ol/geom/geometry';
import Circle from 'ol/geom/circle';
import Length from 'ol/geom/flat/length';
import Feature from 'ol/feature';
import Style from 'ol/style/style';
import Text from 'ol/style/text';
import Extent from 'ol/extent';

import * as StyleUtils from "./Style";
import * as ConversionUtils from "./Conversion";
import * as RegionsUtils from './Regions';
import Point from "../geom/Point";
import Label from "../geom/Label";
import Line from "../geom/Line";
import Polygon from "../geom/Polygon";
import Mask from "../geom/Mask";
import Regions from "../source/Regions";
import {REGIONS_STATE, UNITS_LENGTH} from "../Globals";

/**
 * The feature factory lookup table.
 * Access via {@link ome.ol3.utils.Regions.featureFactory} or
 * {@link ome.ol3.utils.Regions.lookupFeatureFunction}
 *
 * @static
 * @private
 */
const FEATURE_FACTORY_LOOKUP_TABLE = {
    "point": function (shape) {
        let feat =
            new Feature({
                "geometry": new Point(
                    [shape['X'], -shape['Y']],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)
            });
        feat['type'] = "point";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    },
    "ellipse": function (shape) {
        let feat =
            new Feature({
                "geometry": new ome.ol3.geom.Ellipse(
                    shape['X'], -shape['Y'], shape['RadiusX'], shape['RadiusY'],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)
            });
        feat['type'] = "ellipse";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    },
    "rectangle": function (shape) {
        let feat = new Feature({
            "geometry": new ome.ol3.geom.Rectangle(
                shape['X'], -shape['Y'], shape['Width'], shape['Height'],
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)
        });
        feat['type'] = "rectangle";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    }, "line": function (shape) {
        let drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
            shape['MarkerStart'] === 'Arrow';
        let drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
            shape['MarkerEnd'] === 'Arrow';
        let feat = new Feature({
            "geometry": new Line(
                [[shape['X1'], -shape['Y1']], [shape['X2'], -shape['Y2']]],
                drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)
        });
        feat['type'] = "line";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    }, "polyline": function (shape) {
        if (typeof(shape['Points']) != 'string') return null;
        let coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(
                shape['Points']);
        if (coords === null) return null;
        let drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
            shape['MarkerStart'] === 'Arrow';
        let drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
            shape['MarkerEnd'] === 'Arrow';
        let feat = new Feature({
            "geometry": new Line(
                coords, drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)
        });
        feat['type'] = "polyline";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    }, "label": function (shape) {
        if (typeof shape['Text'] !== 'string') shape['Text'] = '';
        if (typeof shape['FontSize'] !== 'object' ||
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
        let font =
            shape['FontStyle'] + " " + shape['FontSize']['Value'] + "px " +
            shape['FontFamily'];
        // calculate the font dimensions for label
        let fontDims =
            StyleUtils.measureTextDimensions(shape['Text'], font);
        let feat = new Feature({
            "geometry":
                new Label(shape['X'], -shape['Y'], fontDims)
        });
        feat['type'] = "label";
        feat.setStyle(StyleUtils.createFeatureStyle(shape, true));
        return feat;
    }, "polygon": function (shape) {
        if (typeof(shape['Points']) != 'string') return null;

        let coords =
            ConversionUtils.convertPointStringIntoCoords(shape['Points']);
        if (coords === null) return null;

        let feat = new Feature({
            "geometry":
                new Polygon([coords],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)
        });
        feat['type'] = "polygon";
        feat.setStyle(StyleUtils.createFeatureStyle(shape));
        return feat;
    },
    "mask": function (shape) {
        let feat =
            new Feature({
                "geometry": new Mask(
                    shape['X'], -shape['Y'], shape['Width'], shape['Height'],
                    typeof shape['Transform'] === 'object' ?
                        shape['Transform'] : null)
            });
        feat['type'] = "mask";
        feat.setStyle(StyleUtils.createFeatureStyle(shape, true));
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
export function lookupFeatureFunction(type) {
    // the shape object and type has to be there
    if (typeof(type) !== 'string' || type.length === 0) return null;

    // lower case everything, just in case, no pun intended
    let lowercaseType = type.toLowerCase();

    // a lookup check if we might have received an invalid type which we are
    // going to ignore
    if (typeof FEATURE_FACTORY_LOOKUP_TABLE === 'undefined')
        return null;

    return FEATURE_FACTORY_LOOKUP_TABLE[lowercaseType];
};

/**
 * The feature factory takes roi the roi shape type and returns
 * an openlayers feature with associated style.
 * Uses {@link ome.ol3.source.Regions.lookupFeatureFunction} internally
 *
 * @static
 * @param {Object} shape_info the roi shape information
 * @return {Feature|null} an open layers feature or null if something went wrong
 */
export function featureFactory(shape_info) {
    let lookedUpTypeFunction = lookupFeatureFunction(shape_info['type']);

    if (typeof(lookedUpTypeFunction) !== 'function') {
        console.error("Failed to find factory method for shape: " + shape_info);
        return null;
    }

    // check if, at a minimum, we received style information to render the shapes
    StyleUtils.remedyStyleIfNecessary(shape_info);

    // instantiate the feature and create its associated style
    let actualFeature = lookedUpTypeFunction(shape_info);
    if (!(actualFeature instanceof Feature)) return null;

    return actualFeature;
}

/**
 * A helper method to scale text and labels
 *
 * @static
 * @param {Feature} feature the ol feature with its geometry and style
 * @param {number} factor the scale factor that should be applied
 */
export function scaleTextAndLabels(feature, factor) {
    if (!(feature instanceof Feature) || typeof factor !== 'number') return;

    let featureStyle = feature.getStyle();
    if (!(featureStyle instanceof Style) ||
        !(featureStyle.getText() instanceof Text) ||
        typeof featureStyle.getText().getFont() !== 'string') return;

    let tok = featureStyle.getText().getFont().split(" ");
    if (tok.length === 3) {
        let scaledFontSize = parseInt(tok[1]) * factor;
        if (scaledFontSize < 10) scaledFontSize = 10;
        featureStyle.getText().font_ =
            tok[0] + " " + scaledFontSize + "px " + tok[2];
        if (feature.getGeometry() instanceof Label) {
            let resizedDims =
                StyleUtils.measureTextDimensions(
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
 *   let shape_info =
 *      { "type" : "rectangle", "X" : 10, "Y" : 10, "Width" : 5, "Height" : 5,
 *        "StrokeColor" : -1 };
 *   ome.ol3.utils.Regions.generateRegion(shape_info, 10, [0, -100, 100, 0]);
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
export function generateRegions(shape_info, number, extent, position, is_compatible) {
    // sanity checks
    if (!Array.isArray(extent) || extent.length != 4 ||
        typeof number !== 'number' || number <= 0) return;

    let lookedUpTypeFunction =
        RegionsUtils.lookupFeatureFunction(shape_info['type']);
    if (lookedUpTypeFunction == null) return null;

    if (typeof is_compatible !== 'boolean') is_compatible = false;

    // check if, at a minimum, we received style information to render the shapes
    StyleUtils.remedyStyleIfNecessary(shape_info);
    // check if, at a minimum, we received the essential information to construct the shape
    StyleUtils.remedyShapeInfoIfNecessary(shape_info);

    // generate the prototype feature
    let prototypeFeature = RegionsUtils.featureFactory(shape_info);
    if (prototypeFeature == null) return null;
    prototypeFeature['state'] = REGIONS_STATE.ADDED;

    let location =
        (Array.isArray(position) && position.length === 2) ?
            position.slice() : null;
    if (location !== null || (location === null && !is_compatible)) {
        // get the bounding box for our prototype
        let bboxPrototype = prototypeFeature.getGeometry().getExtent();
        let bboxWidth = Extent.getWidth(bboxPrototype);
        let bboxHeight = Extent.getHeight(bboxPrototype);

        // can happen for lines
        if (bboxHeight === 0) bboxHeight = 1;
        if (bboxWidth === 0) bboxWidth = 1;

        // check if the width/height exceeds our available extent still
        let availableWidth = Extent.getWidth(extent);
        let availableHeight = Extent.getHeight(extent);

        // we take our prototype to the top left corner of our available Extent
        let upperLeftCornerOfPrototype = Extent.getTopLeft(bboxPrototype);
        prototypeFeature.getGeometry().translate(
            -upperLeftCornerOfPrototype[0], -upperLeftCornerOfPrototype[1]);
        // We'd like to adjust our future extent for randomization purposes
        // so that we are always going to be inside when we pick a random point
        // for the upper left corner
        let topLeftCornerOfExtent = Extent.getTopLeft(extent);
        extent =
            [0, 0, (availableWidth - bboxWidth), (availableHeight - bboxHeight)];
    }

    let ret = []; // our return array
    // the actual creation loop
    for (let n = 0; n < number; n++) { // we want number instances of that type...
        // clone the feature
        let newFeature =
            new Feature(
                {"geometry": prototypeFeature.getGeometry().clone()});
        newFeature['type'] = prototypeFeature['type'];
        newFeature.setStyle(
            StyleUtils.cloneStyle(prototypeFeature.getStyle()));
        // we generate an id of the form -1:-uid
        if (typeof shape_info['shape_id'] !== 'string' ||
            shape_info['shape_id'].length === 0 ||
            shape_info['shape_id'].indexOf(":") === -1)
            newFeature.setId(
                (typeof shape_info['roi_id'] === 'number' ?
                    "" + shape_info['roi_id'] + ":" : "-1:") +
                (-ol.getUid(newFeature)));
        else newFeature.setId(shape_info['shape_id']); // state: added
        newFeature['state'] = REGIONS_STATE.ADDED;

        // if a location for pasting was given we use it
        // if not and the target image is compatible to the shape's
        // original source image => leave it in original location
        // otherwise place it in a random location in the given extent
        if (location === null && !is_compatible) {
            let randLocation =
                RegionsUtils.getRandomCoordinateWithinExtent(
                    extent);
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
export function getRandomCoordinateWithinExtent(extent) {
    if (!Array.isArray(extent) || extent.length != 4) return null;

    let randomMin = 0;
    let randomMax = extent[2];

    let randomX =
        Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

    randomMax = extent[3];
    let randomY =
        Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

    return [randomX, -randomY];
}

/**
 * Takes the regions info and converts it into open layers objects that can be
 * displayed and worked with on top of a vector layer.
 *
 * Doing so each level (roi or contained shape) gets a state assigned (DEFAULT):
 * see: {@link ome.ol3.REGIONS_STATE}
 *
 * @private
 * @static
 * @param {ome.ol3.source.Regions} regions an instance of the Regions
 * @param {boolean=} include_new_features should new, unsaved features be included?
 * @return {Array.<Feature>|null} an array of converted shapes or null
 */
export function createFeaturesFromRegionsResponse(regions, include_new_features) {
    if (!(regions instanceof Regions) ||
        !Array.isArray(regions.regions_info_)) return null;

    let ret = [];
    for (let roi in regions.regions_info_) {
        // we gotta have an id and shapes, otherwise no features...
        if (typeof(regions.regions_info_[roi]['@id']) !== 'number' ||
            !Array.isArray(regions.regions_info_[roi]['shapes']))
            continue;

        let roiId = regions.regions_info_[roi]['@id'];
        // each 'level', roi or shape gets the state info property 'DEFAULT' assigned
        regions.regions_info_[roi]['state'] = REGIONS_STATE.DEFAULT;

        // descend deeper into shapes for rois
        for (let s in regions.regions_info_[roi]['shapes']) {
            let shape = regions.regions_info_[roi]['shapes'][s];
            // id, TheT and TheZ have to be present
            if (typeof(shape['@id']) !== 'number') continue;

            //let combinedId = '' + roiId + ":" + shape['@id'];
            let shapeType = shape['@type'];
            // we want the type only
            let hash = shapeType.lastIndexOf("#");
            shape['type'] = (hash !== -1) ?
                shapeType.substring(hash + 1).toLowerCase() : null;
            let combinedId = '' + roiId + ":" + shape['@id'];
            let shapeTindex =
                typeof shape['TheT'] === 'number' ? shape['TheT'] : -1;
            let shapeZindex =
                typeof shape['TheZ'] === 'number' ? shape['TheZ'] : -1;
            let shapeCindex =
                typeof shape['TheC'] === 'number' ? shape['TheC'] : -1;
            // set state
            shape['state'] = REGIONS_STATE.DEFAULT;

            try {
                // create the feature via the factory
                let actualFeature =
                    RegionsUtils.featureFactory(shape);
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
                let rot = regions.viewer_.viewer_.getView().getRotation();
                if (actualFeature.getGeometry() instanceof Label &&
                    rot !== 0 && !regions.rotate_text_)
                    actualFeature.getGeometry().rotate(-rot);
                StyleUtils.updateStyleFunction(actualFeature, regions, true);

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
            } catch (some_error) {
                console.error(
                    "Failed to create ol3 feature for: " + combinedId);
                console.error(some_error);
            }
        }
    }

    // we include any new, unsaved shapes if any exist and are for the present
    // time and plane
    if (typeof include_new_features === 'boolean' && include_new_features &&
        typeof regions.new_unsaved_shapes_ === 'object')
        for (let f in regions.new_unsaved_shapes_) {
            let newUnsFeat = regions.new_unsaved_shapes_[f];
            let newUnsFeatT =
                typeof newUnsFeat['TheT'] === 'number' ?
                    newUnsFeat['TheT'] : -1;
            let newUnsFeatZ =
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
 * @param {Feature} feature the feature containing the geometry
 * @param {boolean} recalculate flag: if true we redo the measurement (default: false)
 * @param {number} pixel_size the pixel_size
 * @param {string} pixel_symbol the pixel_symbol
 * @return {Object} an object containing shape id, area and length
 */
export function calculateLengthAndArea(feature, recalculate, pixel_size, pixel_symbol) {
    if (typeof pixel_size !== 'number') pixel_size = 1;

    let geom = feature.getGeometry();
    // we represent points as circles
    let hasArea =
        !(geom instanceof Circle) &&
        !(geom instanceof Line) &&
        !(geom instanceof Label);
    // for now we only calculate length for line geometries
    // TODO: adjust if perimeter for closed geometries is needed as well
    let hasLength = geom instanceof Line;

    // if we are not micron we convert
    if (typeof pixel_symbol !== 'string' ||
        pixel_symbol.localeCompare('\u00B5m') !== 0) {
        for (let u = 0; u < UNITS_LENGTH.length; u++) {
            let unit = UNITS_LENGTH[u];
            if (unit.symbol.localeCompare(pixel_symbol) === 0) {
                pixel_size *= unit.multiplier;
                break;
            }
        }
    }

    // rounding helper
    let roundAfterThreeDecimals = function (value) {
        if (value < 0) return value;

        return Number(Math.round(value + 'e3') + 'e-3');
    };

    // we recalculate regardless if we don't have a length/area yet
    if (typeof feature['Area'] !== 'number' || recalculate)
        feature['Area'] = hasArea ?
            roundAfterThreeDecimals(
                geom.getArea() * (pixel_size * pixel_size)) : -1;
    if (typeof feature['Length'] !== 'number' || recalculate)
        feature['Length'] = hasLength ?
            roundAfterThreeDecimals(geom.getLength() * pixel_size) : -1;

    return {
        'id': feature.getId(),
        'Area': feature['Area'],
        'Length': feature['Length']
    }
}


/**
 * Returns the length of a given geometry
 *
 * @static
 * @param {Geometry} geom the geometry
 * @return {number} the length of the geometry or 0 (if no geometry)
 */
export function getLength(geom) {
    if (!(geom instanceof Geometry)) return 0;
    return Length.lineStringLength(
        geom.flatCoordinates, 0,
        geom.flatCoordinates.length, geom.stride);
}


