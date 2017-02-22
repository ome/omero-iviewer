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
		var x = typeof(shape['cx']) === 'number' ? shape['cx'] :
		 					(typeof(shape['x']) === 'number' ? shape['x'] : -1);
		var y = typeof(shape['cy']) === 'number' ? shape['cy'] :
		 					(typeof(shape['y']) === 'number' ? shape['y'] : -1);

		var feat = new ol.Feature({"geometry" :
			new ol.geom.Circle([x, -y], 5)});
		feat['type'] = "point";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	},
	"ellipse" : function(shape) {
        var x = typeof shape['cx'] === 'number' ? shape['cx'] : shape['x'];
        var y = typeof shape['cy'] === 'number' ? shape['cy'] : shape['y'];
        var rx =
            typeof shape['rx'] === 'number' ? shape['rx'] : shape['radiusX'];
        var ry =
            typeof shape['ry'] === 'number' ? shape['ry'] : shape['radiusY'];
        var trans =
            typeof shape['transform'] === 'string' ? shape['transform'] : null;
		var feat = new ol.Feature({"geometry" :
			new ome.ol3.geom.Ellipse(x, -y, rx, ry, trans)});
		feat['type'] = "ellipse";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	},
	"rectangle" : function(shape) {
		var feat = new ol.Feature({"geometry" :
			new ome.ol3.geom.Rectangle(shape['x'], -shape['y'], shape['width'], shape['height'])});
		feat['type'] = "rectangle";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	}, "line" : function(shape) {
        var drawStartArrow =
            typeof shape['markerStart'] === 'string' &&
                shape['markerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['markerEnd'] === 'string' &&
                shape['markerEnd'] === 'Arrow';
		var feat = new ol.Feature({"geometry" :
			new ome.ol3.geom.Line(
                [[shape['x1'], -shape['y1']], [shape['x2'], -shape['y2']]],
                drawStartArrow, drawEndArrow)});
		feat['type'] = "line";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	}, "polyline" : function(shape) {
		if (typeof(shape['points']) != 'string')
			return null;

		var coords = ome.ol3.utils.Misc.parseSvgStringForPolyShapes(shape['points']);
		if (coords === null) return null;

        var drawStartArrow =
            typeof shape['markerStart'] === 'string' &&
                shape['markerStart'] === 'Arrow';
        var drawEndArrow =
            typeof shape['markerEnd'] === 'string' &&
                shape['markerEnd'] === 'Arrow';

		var feat = new ol.Feature(
            {"geometry" : new ome.ol3.geom.Line(
                coords, drawStartArrow, drawEndArrow)});
		feat['type'] = "polyline";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	}, "label" : function(shape) {
		if (typeof(shape['textValue']) !== 'string' || shape['textValue'].length === 0)
			shape['textValue'] = 'missing textValue';
		if (typeof(shape['fontSize']) !== 'number') {
			try {
				shape['fontSize'] = parseInt(shape['fontSize']);
			} catch(overruled) {
				shape['fontSize'] = 10;
			}
		}
		if (typeof(shape['fontFamily']) !== 'string') {
				shape['fontFamily'] = 'sans-serif'; // use as default instead
		}
		if (typeof(shape['fontStyle']) !== 'string') {
				shape['fontStyle'] = 'normal'; // use as default instead
		}
		// combine all font properties to form a font string
		var font = shape['fontStyle'] + " " + shape['fontSize'] + "px " +
			shape['fontFamily'];
		// calculate the font dimensions for label
		var fontDims = ome.ol3.utils.Style.measureTextDimensions(shape['textValue'], font);
		var feat =
			new ol.Feature({"geometry" :
				new ome.ol3.geom.Label(shape['x'], -shape['y'], fontDims)});
		feat['type'] = "label";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape, true));
		return feat;
	}, "polygon" : function(shape) {
		if (typeof(shape['points']) != 'string')
			return null;

		var coords = ome.ol3.utils.Misc.parseSvgStringForPolyShapes(shape['points']);
		if (coords === null) return null;

		var feat = new ol.Feature({"geometry" : new ol.geom.Polygon([coords])});
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
	if (typeof(type) !== 'string' || type.length === 0)
		return null;

	// lower case everything, just in case, no pun intended
	var type = type.toLowerCase();
	// a lookup check if we might have received an invalid type which we are
	// going to ignore
	if (typeof(ome.ol3.utils.Regions.FEATURE_FACTORY_LOOKUP_TABLE) === 'undefined')
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
 * A helper method to generate a certain number of regions.
 *
 * <pre>
 *   var shape_info =
 * 		{ "type" : "rectangle", "x" : 10, "y" : 10, "width" : 5, "height" : 5,
 * 			"strokeColor" : "#ffffff", strokeAlpha : 0.7 };
 *   ome.ol3.utils.Regions.generateRegion(shape_info, 10, [0, -100, 100, 0]);
 * </pre>
 *
 * @static
 * @param {Object} shape_info the roi shape information (in 'get_rois_json' format )
 * @param {number} number the number of shapes that should be generated
 * @param {ol.Extent} extent the portion of the image used for generation (bbox format)
 * @param {boolean} random_placement should the shapes be generated in random places?
 * @return {Array<ol.Feature>|null} an array of open layers feature or null if something went wrong
 */
ome.ol3.utils.Regions.generateRegions =
	function(shape_info, number, extent, random_placement) {
	// sanity checks
	var lookedUpTypeFunction =
		ome.ol3.utils.Regions.lookupFeatureFunction(shape_info['type']);
	if (lookedUpTypeFunction == null) // something went wrong
		return null;

	// we also need an extent to have an idea of placement
	if (!ome.ol3.utils.Misc.isArray(extent) || extent.length != 4)
		return null;

	// check if, at a minimum, we received style information to render the shapes
	ome.ol3.utils.Style.remedyStyleIfNecessary(shape_info);

	// check if, at a minimum, we received the essential information to construct the shape
	ome.ol3.utils.Style.remedyShapeInfoIfNecessary(
		shape_info, number, extent, random_placement);

	// generate the prototype feature
	var prototypeFeature = ome.ol3.utils.Regions.featureFactory(shape_info);
	if (prototypeFeature == null) return null;
    prototypeFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;

    var ret = []; // our return array

    // all of this section deals with randomized placement and the
    // adjustments that are necessary
	if (random_placement) {
    	// get the bounding box for our prototype
    	var bboxPrototype = prototypeFeature.getGeometry().getExtent();
    	var bboxWidth = ol.extent.getWidth(bboxPrototype);
    	var bboxHeight = ol.extent.getHeight(bboxPrototype);
        // can happen for lines
    	if (bboxHeight === 0) bboxHeight = 1;
    	if (bboxWidth === 0) bboxWidth = 1;

    	// check if the width/height exceeds our available extent
    	var availableWidth = ol.extent.getWidth(extent);
    	var availableHeight = ol.extent.getHeight(extent);
    	if (availableWidth === 0 || availableHeight === 0 ||
    		 bboxWidth > availableWidth || bboxHeight > availableHeight) {
    		var deltaWidth = bboxWidth - availableWidth;
            var deltaHeight = bboxHeight - availableHeight;
            var higherOfTheTwo =
                deltaWidth > deltaHeight ? deltaWidth : deltaHeight;
            var scaleFactor =
                deltaWidth === higherOfTheTwo ?
                    availableWidth / bboxWidth : availableHeight / bboxHeight;
            prototypeFeature.getGeometry().scale(scaleFactor);
            var prototypeStyle = prototypeFeature.getStyle();
            if (prototypeStyle &&
                prototypeStyle.getText() instanceof ol.style.Text &&
                typeof prototypeStyle.getText().getFont() === 'string') {
                    var tok = prototypeStyle.getText().getFont().split(" ");
                    if (tok.length === 3) {
                        var scaledFontSize = parseInt(tok[1]) * scaleFactor;
                        if (scaledFontSize < 10) scaledFontSize = 10;
                        prototypeStyle.getText().font_ =
                            tok[0] + " " + scaledFontSize + "px " + tok[2];
                        if (prototypeFeature.getGeometry()
                                instanceof ome.ol3.geom.Label) {
                            var resizedDims =
                                ome.ol3.utils.Style.measureTextDimensions(
                                    prototypeStyle.getText().getText(),
                                    prototypeStyle.getText().getFont(), null);
                            prototypeFeature.getGeometry().resize(resizedDims);
                      }
                    }
            }
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
		extent =
            [0,0,(availableWidth - bboxWidth), (availableHeight - bboxHeight)];
    }

    // the actual creation loop
	for (var n=0;n<number;n++) { // we want number instances of that type...
		// clone the feature
		var newFeature =
			new ol.Feature({ "geometry" : prototypeFeature.getGeometry().clone()});
		newFeature['type'] = prototypeFeature['type'];
		newFeature.setStyle(
			ome.ol3.utils.Style.cloneStyle(prototypeFeature.getStyle()));
        // we generate an id of the form -1:uid
        if (typeof shape_info['shape_id'] !== 'string' ||
            shape_info['shape_id'].length === 0 ||
            shape_info['shape_id'].indexOf(":") === -1)
		        newFeature.setId(
                    (typeof shape_info['roi_id'] === 'number' &&
                     shape_info['roi_id'] < 0 ?
                        "" + shape_info['roi_id'] + ":" : "-1:") +
                            ol.getUid(newFeature));
        else newFeature.setId(shape_info['shape_id']);
		newFeature['state'] = ome.ol3.REGIONS_STATE.ADDED; // state: added

        // put us in a random location within the extent
        if (random_placement) {
            var randomTopLeftCorner =
                ome.ol3.utils.Regions.getRandomCoordinateWithinExtent(extent);
            if (randomTopLeftCorner === null) break;

    		// we translate relative to our origin based on the randomized offset
    		newFeature.getGeometry().translate(
    			randomTopLeftCorner[0], -randomTopLeftCorner[1]);
        }

		ret.push(newFeature);
	}

	return ret;
};

/**
 * Determines the row and column fits of objects of a certain width/height
 * given an extent and the number of overall objects to achieve
 * Do only call internally/with care since no sanity checks are applied any more
 *
 * @static
 * @private
 * @param {number} number the overall number of objects
 * @param {ol.Extent} extent the maximum extent for fitting
 * @param {number} width the width of one such object
 * @param {number} height the height of one such object
 * @return {Array.<number>} an object with properties fitsPerRow/fitsPerColumn
 */
ome.ol3.utils.Regions.getFitsWithinExtent =
	function(number, extent, width, height) {

	if (width <= 0) width = 1;
	if (height <= 0) height = 1;

	var ret = {
		"fitsPerRow" : parseInt(ol.extent.getWidth(extent) / width),
		"fitsPerColumn" : parseInt(ol.extent.getHeight(extent) / height)
	};
	var ratio = number / (ret["fitsPerRow"] * ret["fitsPerColumn"]);
	if (ratio > 1) {
		// we cannot just align them next to each other, they will have to overlap
		// we'll double the capacity of row/column iteratively to reach our desired
		// number, which should not take long at all
		while (ratio > 1) {
			ret["fitsPerRow"] *= 2;
			ret["fitsPerColumn"] *= 2;
			ratio = number / (ret["fitsPerRow"] * ret["fitsPerColumn"]);
		}
		// let's determine the step size for a row/column based on the calculated fits...
		ret['stepX'] = parseInt(ol.extent.getWidth(extent)  / ret['fitsPerRow']);
		ret['stepY'] = parseInt(ol.extent.getHeight(extent) / ret['fitsPerColumn']);
	} else {
		if (ret['fitsPerRow'] >  number)
			ret['stepX'] = parseInt(ol.extent.getWidth(extent)  / number);
		else
			ret['stepX'] = parseInt(ol.extent.getWidth(extent)  / ret['fitsPerRow']);
		ret['stepY'] = parseInt(ol.extent.getHeight(extent)  / ret['fitsPerColumn']);
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
ome.ol3.utils.Regions.getRandomCoordinateWithinExtent = function(extent) {
	if (!ome.ol3.utils.Misc.isArray(extent) || extent.length != 4) return null;

	var randomMin = 0;
	var randomMax = extent[2];

	var randomX =
		Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

	randomMax = extent[3];
	var randomY =
		Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;

	return [randomX, randomY];
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
		if (typeof(regions.regions_info_[roi]['id']) !== 'number' ||
			!ome.ol3.utils.Misc.isArray(regions.regions_info_[roi]['shapes']))
			continue; // we gotta have an id and shapes, otherwise no features...

		var roiId = regions.regions_info_[roi]['id'];
		// each 'level', roi or shape gets the state info property 'DEFAULT' assigned
		regions.regions_info_[roi]['state'] = ome.ol3.REGIONS_STATE.DEFAULT;

		// descend deeper into shapes for rois
		for (var shape in regions.regions_info_[roi]['shapes']) { // id, theT and theZ have to be present
			if (typeof(regions.regions_info_[roi]['shapes'][shape]['id']) !== 'number')
				continue;

			var shapeId = regions.regions_info_[roi]['shapes'][shape]['id'];
			var shapeType = regions.regions_info_[roi]['shapes'][shape]['type'];
			var shapeTindex =
				typeof(regions.regions_info_[roi]['shapes'][shape]['theT']) === 'number' ?
				regions.regions_info_[roi]['shapes'][shape]['theT'] : -1;
			var shapeZindex =
				typeof(regions.regions_info_[roi]['shapes'][shape]['theZ']) === 'number' ?
				regions.regions_info_[roi]['shapes'][shape]['theZ'] : -1;
            var shapeCindex =
				typeof(regions.regions_info_[roi]['shapes'][shape]['theC']) === 'number' ?
				regions.regions_info_[roi]['shapes'][shape]['theC'] : -1;

			// set state
			regions.regions_info_[roi]['shapes'][shape]['state'] = ome.ol3.REGIONS_STATE.DEFAULT;

			// create the feature via the factory
			var nestedError = null;
			var actualFeature = null;
			try {
				actualFeature =
					ome.ol3.utils.Regions.featureFactory(regions.regions_info_[roi]['shapes'][shape]);

				// if we are null, we might be a mask, check the type
				var type = null;
				if (typeof(regions.regions_info_[roi]['shapes'][shape]['type']) === 'string')
					type = regions.regions_info_[roi]['shapes'][shape]['type'].toLowerCase();
				if (type === 'mask') {
					ome.ol3.utils.Regions.addMask(
						regions, regions.regions_info_[roi]['shapes'][shape]);
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

			var combinedId = '' + roiId + ":" + shapeId;
			if (!(actualFeature instanceof ol.Feature)) {
				console.error("Failed to construct " +
					shapeType + "(" + combinedId + ") from shape info!");
				if (nestedError != null) console.error(nestedError);
				continue;
			}

			// we set an id for the feature which we then use for select/modify/translate
			// interactions to quickly pinpoint the feature in question.
			// the foramat is: 'rois_id:shape_id', e.g.: '1:4'
			actualFeature.setId(combinedId);
			actualFeature['theT'] = shapeTindex;
			actualFeature['theZ'] = shapeZindex;
            actualFeature['theC'] = shapeCindex;
			actualFeature['state'] = ome.ol3.REGIONS_STATE.DEFAULT;
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
				typeof newUnsFeat['theT'] === 'number' ? newUnsFeat['theT'] : -1;
            var newUnsFeatZ =
				typeof newUnsFeat['theZ'] === 'number' ? newUnsFeat['theZ'] : -1;
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
			 	typeof(shape_info['type']) !== 'string')
		return;
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
				 			'/webgateway/render_shape_mask/' +  shape_info['id'],
				projection:
					regions.viewer_.viewer_.getView().getProjection(),
				imageExtent: [
					shape_info['x'],-shape_info['y'] - shape_info['height'],
					shape_info['x'] + shape_info['width'], -shape_info['y']
				 ]
	})}));
}
