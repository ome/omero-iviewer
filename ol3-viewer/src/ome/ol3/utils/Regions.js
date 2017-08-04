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

/**
 * @namespace ome.ol3.utils.Regions
 */
goog.provide('ome.ol3.utils.Regions');

goog.require('ol.Feature');
goog.require('ol.geom.Circle');
goog.require('ol.geom.Polygon');
goog.require('ol.extent');

/**
 * The feature factory lookup table.
 * Access via {@link ome.ol3.utils.Regions.featureFactory} or
 * {@link ome.ol3.utils.Regions.lookupFeatureFunction}
 *
 * @static
 * @private
 */
ome.ol3.utils.Regions.FEATURE_FACTORY_LOOKUP_TABLE = {
    "point" : function(shape) {
        var feat =
            new ol.Feature({"geometry" : new ol.geom.Circle(
                [shape['X'], -shape['Y']], 5)});
        feat['type'] = "point";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
        return feat;
    },
    "ellipse" : function(shape) {
        var feat =
            new ol.Feature({"geometry" : new ome.ol3.geom.Ellipse(
                shape['X'], -shape['Y'], shape['RadiusX'], shape['RadiusY'],
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "ellipse";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
        return feat;
    },
    "rectangle" : function(shape) {
        var feat = new ol.Feature({"geometry" : new ome.ol3.geom.Rectangle(
            shape['X'], -shape['Y'], shape['Width'], shape['Height'],
            typeof shape['Transform'] === 'object' ?
                shape['Transform'] : null)});
        feat['type'] = "rectangle";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
        return feat;
    }, "line" : function(shape) {
        var drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
                shape['MarkerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
                shape['MarkerEnd'] === 'Arrow';
        var feat = new ol.Feature({"geometry" : new ome.ol3.geom.Line(
                [[shape['X1'], -shape['Y1']], [shape['X2'], -shape['Y2']]],
                drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "line";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
        return feat;
    }, "polyline" : function(shape) {
        if (typeof(shape['Points']) != 'string') return null;
        var coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(
                shape['Points']);
        if (coords === null) return null;
        var drawStartArrow =
            typeof shape['MarkerStart'] === 'string' &&
                shape['MarkerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['MarkerEnd'] === 'string' &&
                shape['MarkerEnd'] === 'Arrow';
        var feat = new ol.Feature({"geometry" : new ome.ol3.geom.Line(
                coords, drawStartArrow, drawEndArrow,
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "polyline";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
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
            ome.ol3.utils.Style.measureTextDimensions(shape['Text'], font);
        var feat = new ol.Feature({"geometry" :
            new ome.ol3.geom.Label(shape['X'], -shape['Y'], fontDims)});
        feat['type'] = "label";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape, true));
        return feat;
    }, "polygon" : function(shape) {
        if (typeof(shape['Points']) != 'string') return null;

        var coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(shape['Points']);
        if (coords === null) return null;

        var feat = new ol.Feature({"geometry" :
            new ome.ol3.geom.Polygon([coords],
                typeof shape['Transform'] === 'object' ?
                    shape['Transform'] : null)});
        feat['type'] = "polygon";
        feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
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
ome.ol3.utils.Regions.lookupFeatureFunction = function(type) {
    // the shape object and type has to be there
    if (typeof(type) !== 'string' || type.length === 0) return null;

    // lower case everything, just in case, no pun intended
    var type = type.toLowerCase();
    // a lookup check if we might have received an invalid type which we are
    // going to ignore
    if (typeof ome.ol3.utils.Regions.FEATURE_FACTORY_LOOKUP_TABLE === 'undefined')
        return null;

    return ome.ol3.utils.Regions.FEATURE_FACTORY_LOOKUP_TABLE[type];
};

/**
 * The feature factory takes roi the roi shape type and returns
 * an openlayers feature with associated style.
 * Uses {@link ome.ol3.source.Regions.lookupFeatureFunction} internally
 *
 * @static
 * @param {Object} shape_info the roi shape information
 * @return {ol.Feature|null} an open layers feature or null if something went wrong
 */
ome.ol3.utils.Regions.featureFactory = function(shape_info) {
    var lookedUpTypeFunction =
        ome.ol3.utils.Regions.lookupFeatureFunction(shape_info['type']);

    if (typeof(lookedUpTypeFunction) !== 'function') return null;

    // check if, at a minimum, we received style information to render the shapes
    ome.ol3.utils.Style.remedyStyleIfNecessary(shape_info);

    // instantiate the feature and create its associated style
    var actualFeature = lookedUpTypeFunction(shape_info);
    if (!(actualFeature instanceof ol.Feature)) return null; // something went wrong

    return actualFeature;
};

/**
 * A helper method to scale text and labels
 *
 * @static
 * @param {ol.Feature} feature the ol feature with its geometry and style
 * @param {number} factor the scale factor that should be applied
 */
ome.ol3.utils.Regions.scaleTextAndLabels = function(feature, factor) {
    if (!(feature instanceof ol.Feature) || typeof factor !== 'number') return;

    var featureStyle = feature.getStyle();
    if (!(featureStyle instanceof ol.style.Style) ||
        !(featureStyle.getText() instanceof ol.style.Text) ||
        typeof featureStyle.getText().getFont() !== 'string') return;

    var tok = featureStyle.getText().getFont().split(" ");
    if (tok.length === 3) {
        var scaledFontSize = parseInt(tok[1]) * factor;
        if (scaledFontSize < 10) scaledFontSize = 10;
        featureStyle.getText().font_ =
            tok[0] + " " + scaledFontSize + "px " + tok[2];
        if (feature.getGeometry() instanceof ome.ol3.geom.Label) {
            var resizedDims =
                ome.ol3.utils.Style.measureTextDimensions(
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
 *   ome.ol3.utils.Regions.generateRegion(shape_info, 10, [0, -100, 100, 0]);
 * </pre>
 *
 * @static
 * @param {Object} shape_info the roi shape information (in 'get_rois_json' format )
 * @param {number} number the number of shapes that should be generated
 * @param {ol.Extent} extent the portion of the image used for generation (bbox format)
 * @param {Array.<number>|null} position the position to place the shape(s) or null (meaning random placement)
 * @param {number=} scale_factor an optional scale factor to apply
 * @return {Array<ol.Feature>|null} an array of open layers feature or null if something went wrong
 */
ome.ol3.utils.Regions.generateRegions =
    function(shape_info, number, extent, position, scale_factor) {
        // sanity checks
        if (!ome.ol3.utils.Misc.isArray(extent) || extent.length != 4 ||
            typeof number !== 'number' || number <= 0) return;

        var lookedUpTypeFunction =
            ome.ol3.utils.Regions.lookupFeatureFunction(shape_info['type']);
        if (lookedUpTypeFunction == null) return null;

        // check if, at a minimum, we received style information to render the shapes
        ome.ol3.utils.Style.remedyStyleIfNecessary(shape_info);
        // check if, at a minimum, we received the essential information to construct the shape
        ome.ol3.utils.Style.remedyShapeInfoIfNecessary(shape_info);

        // generate the prototype feature
        var prototypeFeature = ome.ol3.utils.Regions.featureFactory(shape_info);
        if (prototypeFeature == null) return null;
            prototypeFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;

        var ret = []; // our return array

        // if we have a scale factor, apply it now
        if (typeof scale_factor === 'number' && scale_factor !== 1) {
            prototypeFeature.getGeometry().scale(scale_factor);
            ome.ol3.utils.Regions.scaleTextAndLabels(
                prototypeFeature, scale_factor);
        } else scale_factor = 1;

        // get the bounding box for our prototype
        var bboxPrototype = prototypeFeature.getGeometry().getExtent();
        var bboxWidth = ol.extent.getWidth(bboxPrototype);
        var bboxHeight = ol.extent.getHeight(bboxPrototype);

        // can happen for lines
        if (bboxHeight === 0) bboxHeight = 1;
        if (bboxWidth === 0) bboxWidth = 1;

        // check if the width/height exceeds our available extent still
        var availableWidth = ol.extent.getWidth(extent);
        var availableHeight = ol.extent.getHeight(extent);
        if (scale_factor !== 1 &&
            (availableWidth === 0 || availableHeight === 0 ||
            bboxWidth > availableWidth || bboxHeight > availableHeight)) {
                var deltaWidth = bboxWidth - availableWidth;
            var deltaHeight = bboxHeight - availableHeight;
            var higherOfTheTwo =
                deltaWidth > deltaHeight ? deltaWidth : deltaHeight;
            var scaleFactor =
                deltaWidth === higherOfTheTwo ?
                    availableWidth / bboxWidth : availableHeight / bboxHeight;
            prototypeFeature.getGeometry().scale(scaleFactor);
            ome.ol3.utils.Regions.scaleTextAndLabels(
                prototypeFeature, scaleFactor);
            bboxWidth = parseInt(bboxWidth * scaleFactor) - 1;
            bboxHeight = parseInt(bboxHeight * scaleFactor) - 1;
            bboxPrototype = prototypeFeature.getGeometry().getExtent();
        }

        // we take our prototype to the top left corner of our available Extent
        var upperLeftCornerOfPrototype = ol.extent.getTopLeft(bboxPrototype);
        prototypeFeature.getGeometry().translate(
            -upperLeftCornerOfPrototype[0], -upperLeftCornerOfPrototype[1]);
        // We'd like to adjust our future extent for randomization purposes
        // so that we are always going to be inside when we pick a random point
        // for the upper left corner
        var topLeftCornerOfExtent = ol.extent.getTopLeft(extent);
        extent =
            [0,0,(availableWidth - bboxWidth), (availableHeight - bboxHeight)];

        // the actual creation loop
        for (var n=0;n<number;n++) { // we want number instances of that type...
            // clone the feature
            var newFeature =
                new ol.Feature(
                    { "geometry" : prototypeFeature.getGeometry().clone()});
            newFeature['type'] = prototypeFeature['type'];
            newFeature.setStyle(
                ome.ol3.utils.Style.cloneStyle(prototypeFeature.getStyle()));
            // we generate an id of the form -1:-uid
            if (typeof shape_info['shape_id'] !== 'string' ||
                shape_info['shape_id'].length === 0 ||
                shape_info['shape_id'].indexOf(":") === -1)
                    newFeature.setId(
                        (typeof shape_info['roi_id'] === 'number' ?
                            "" + shape_info['roi_id'] + ":" : "-1:") +
                                (-ol.getUid(newFeature)));
            else newFeature.setId(shape_info['shape_id']); // state: added
                newFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;

            // put us either in the desired position or a random location
            var location = null;
            if (!ome.ol3.utils.Misc.isArray(position) || position.length !== 2) {
                newFeature.getGeometry().translate(
                    topLeftCornerOfExtent[0], topLeftCornerOfExtent[1]);
                location =
                    ome.ol3.utils.Regions.getRandomCoordinateWithinExtent(extent);
            } else location = position.slice();
            newFeature.getGeometry().translate(location[0], location[1]);

            ret.push(newFeature);
        }

        return ret;
};


/**
 * Returns a pair of random coordinates within a given extent
 *
 * @static
 * @private
 * @param {ol.Extent} extent the extent for randomization
 * @return {Array.<number>} a coordinate tuple
 */
ome.ol3.utils.Regions.getRandomCoordinateWithinExtent = function(extent) {
    if (!ome.ol3.utils.Misc.isArray(extent) || extent.length != 4) return null;

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
 * see: {@link ome.ol3.REGIONS_STATE}
 *
 * @private
 * @param {ome.ol3.source.Regions} regions an instance of the Regions
 * @param {boolean=} include_new_features should new, unsaved features be included?
 * @return {Array.<ol.Feature>|null} an array of converted shapes or null
 */
ome.ol3.utils.Regions.createFeaturesFromRegionsResponse =
    function(regions, include_new_features) {
        if (!(regions instanceof ome.ol3.source.Regions) ||
            !ome.ol3.utils.Misc.isArray(regions.regions_info_)) return null;

        var ret = [];
        for (var roi in regions.regions_info_) {
            // we gotta have an id and shapes, otherwise no features...
            if (typeof(regions.regions_info_[roi]['@id']) !== 'number' ||
                !ome.ol3.utils.Misc.isArray(regions.regions_info_[roi]['shapes']))
                    continue;

            var roiId = regions.regions_info_[roi]['@id'];
            // each 'level', roi or shape gets the state info property 'DEFAULT' assigned
            regions.regions_info_[roi]['state'] = ome.ol3.REGIONS_STATE.DEFAULT;

            // descend deeper into shapes for rois
            for (var s in regions.regions_info_[roi]['shapes']) {
                var shape = regions.regions_info_[roi]['shapes'][s];
                // id, TheT and TheZ have to be present
                if (typeof(shape['@id']) !== 'number') continue;

                var shapeType = shape['@type'];
                // we want the type only
                var hash = shapeType.lastIndexOf("#");
                shape['type'] = (hash !== -1) ?
                    shapeType.substring(hash+1).toLowerCase() : null;
                var shapeTindex =
                    typeof shape['TheT'] === 'number' ? shape['TheT'] : -1;
                var shapeZindex =
                    typeof shape['TheZ'] === 'number' ? shape['TheZ'] : -1;
                var shapeCindex =
                    typeof shape['TheC'] === 'number' ? shape['TheC'] : -1;
                // set state
                shape['state'] = ome.ol3.REGIONS_STATE.DEFAULT;

                // create the feature via the factory
                var nestedError = null;
                var actualFeature = null;
                try {
                    actualFeature = ome.ol3.utils.Regions.featureFactory(shape);
                    if (shape['type'] === 'mask') {
                        ome.ol3.utils.Regions.addMask(regions, shape);
                        continue;
                    }

                    /*
                     * To adjust the text style to custom rotation and scale schanges
                    * we override the style information with something more flexible,
                     * namely a styling function returning the style.
                     */
                    var rot = regions.viewer_.viewer_.getView().getRotation();
                    if (actualFeature.getGeometry() instanceof ome.ol3.geom.Label &&
                        rot !== 0 && !regions.rotate_text_)
                            actualFeature.getGeometry().rotate(-rot);
                    ome.ol3.utils.Style.updateStyleFunction(actualFeature, regions, true);
                } catch(some_error) {
                    nestedError = some_error;
                }

                var combinedId = '' + roiId + ":" + shape['@id'];
                if (!(actualFeature instanceof ol.Feature)) {
                    console.error("Failed to construct " +
                    shapeType + "(" + combinedId + ") from shape info!");
                    if (nestedError != null) console.error(nestedError);
                    continue;
                }

                // we set the id for the feature using the format:
                // 'rois_id:shape_id', e.g.: '1:4'
                actualFeature.setId(combinedId);
                actualFeature['TheT'] = shapeTindex;
                actualFeature['TheZ'] = shapeZindex;
                actualFeature['TheC'] = shapeCindex;
                actualFeature['state'] = ome.ol3.REGIONS_STATE.DEFAULT;
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
                // append owner info
                var o =
                    typeof shape['omero:details']['owner'] === 'object' ?
                        shape['omero:details']['owner'] : null;
                var owner = "";
                if (o !== null) {
                    if (typeof o['FirstName'] === 'string' &&
                        o['FirstName'].length > 0) owner = o['FirstName'] + " ";
                    if (typeof o['LastName'] === 'string' &&
                        o['LastName'].length > 0) owner += o['LastName'];
                    if (owner === '' && typeof o['UserName'] === 'string' &&
                        o['UserName'].length > 0) owner = o['UserName'];
                }
                actualFeature['owner'] = owner;
                actualFeature['permissions'] =
                    shape['omero:details']['permissions'];
                // add us to the return array
                ret.push(actualFeature);
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
 * Adds a mask layer for each mask on top of the original image
 * and prior to the rois.
 *
 * @private
 * @param {ome.ol3.source.Regions} regions an instance of the OmeroRegions
 * @param {Object} shape_info the shape info object (from json)
 */
ome.ol3.utils.Regions.addMask = function(regions, shape_info) {
    // some preliminary checks
    if (!(regions instanceof ome.ol3.source.Regions) ||
        typeof(shape_info) !== 'object' ||
        typeof(shape_info['type']) !== 'string') return;
    if (shape_info['type'].toLowerCase() !== 'mask') return;

    if (typeof shape_info['id'] !== 'number' ||
        shape_info['id'] <= 0 || typeof shape_info['x'] !== 'number' ||
        typeof shape_info['y'] !== 'number' ||
        typeof shape_info['width'] !== 'number' ||
        typeof shape_info['height'] !== 'number' ||
        shape_info['width'] <= 0 || shape_info['height'] <= 0)
            console.error("At least one Mask parameters is invalid!");

    // we place it before the regions layer
    var position = regions.viewer_.viewer_.getLayers().getLength() - 1;
    regions.viewer_.viewer_.getLayers().insertAt(
        position,
        new ol.layer.Image({
            source: new ol.source.ImageStatic({
                attributions: null,
                url: regions.viewer_.getServer()['full'] +
                        regions.viewer_.getPrefixedURI(ome.ol3.WEBGATEWAY) +
                        '/render_shape_mask/' +  shape_info['id'],
                    projection:
                    regions.viewer_.viewer_.getView().getProjection(),
                imageExtent: [
                    shape_info['x'],-shape_info['y'] - shape_info['height'],
                    shape_info['x'] + shape_info['width'], -shape_info['y']
                ]
        })}));
}
