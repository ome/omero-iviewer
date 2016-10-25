/**
 * @namespace ome.ol3.utils.Regions
 */
goog.provide('ome.ol3.utils.Regions');

goog.require('ol.Feature');
goog.require('ol.geom.Circle');
goog.require('ol.geom.LineString');
goog.require('ol.geom.Polygon');
goog.require('ol.extent');
goog.require('ol.structs.RBush');

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
			new ol.geom.Circle([x, -y], 2)});
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
		var feat = new ol.Feature({"geometry" :
			new ome.ol3.geom.Ellipse(x, -y, rx, ry, shape['transform'])});
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
		var feat = new ol.Feature({"geometry" :
			new ol.geom.LineString([[shape['x1'], -shape['y1']], [shape['x2'], -shape['y2']]])});
		feat['type'] = "line";
		feat.setStyle(ome.ol3.utils.Style.createFeatureStyle(shape));
		return feat;
	}, "polyline" : function(shape) {
		if (typeof(shape['points']) != 'string')
			return null;

		var coords = ome.ol3.utils.Misc.parseSvgStringForPolyShapes(shape['points']);
		if (coords === null) return null;

		var feat = new ol.Feature({"geometry" : new ome.ol3.geom.PolyLine(coords)});
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
 * <p>The first parameter is an Object with the usual parameters needed
 * for the type of roi specified to be generated. Any coordinates given are to be taken
 * as the 'starting point' for the first shape generated. If none are given they
 * are spaced out in regular intervals over the extent argument, starting in the top left corner.
 * If for more complex shapes, i.e. polygons/polylines no coordinates are given,
 * a rather short/small polyline/gon will be generated randomly. If, fpr labels,
 * no text is given, a short random string will be constructed.
 * If random_placement is set to true, they'll be randomly placed.</p>
 * <p>Note: if a special style ought to be applied, you have to hand it in as well.
 * Otherwise a default style will be applied. See example below for usage</p>
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
 * @param {boolean=} random_placement should the shapes be generated in random places?
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

	// if no number has been given, we default to 1
	if (typeof(number) !== 'number' || number < 0)
		number = 1;
	if (number > 25000) {
		console.info("The generation is limited to 25,000 at once for now!");
		return null;
	}

	// random_placement is optional, we default to false
	if (typeof(random_placement) !== 'boolean')
		random_placement = false;

	// check if, at a minimum, we received style information to render the shapes
	ome.ol3.utils.Style.remedyStyleIfNecessary(shape_info);

	// check if, at a minimum, we received the essential information to construct the shape
	ome.ol3.utils.Style.remedyShapeInfoIfNecessary(
		shape_info, number, extent, random_placement);

	// generate the prototype feature
	var prototypeFeature = ome.ol3.utils.Regions.featureFactory(shape_info);
	if (prototypeFeature == null) {
		console.error("Failed to create generation prototype!");
		return null;
	}
	prototypeFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;

	// get the bounding box for our prototype
	// we need to know the width and height of the bounding box to see how we
	// can place them within the extent
	var bboxPrototype = prototypeFeature.getGeometry().getExtent();
	var bboxWidth = ol.extent.getWidth(bboxPrototype);
	var bboxHeight = ol.extent.getHeight(bboxPrototype);
	if (bboxHeight === 0) {
		// can happen for lines
		bboxHeight = 1;
	}
	if (bboxWidth === 0) {
		// can happen for lines
		bboxWidth = 1;
	}
	// check if the width/height exceeds our available extent
	var availableWidth = ol.extent.getWidth(extent);
	var availableHeight = ol.extent.getHeight(extent);
	if (availableWidth === 0 || availableHeight === 0 ||
		 bboxWidth > availableWidth || bboxHeight > availableHeight) {
		console.error("the protoype shape to be generated does not fit into the given extent!");
		return null;
	}

	var ret = []; // our return array

	// we take our prototype to the top left corner of our available Extent
	// this facilitates matters even for randomized placement
	// bear in mind that internally our y axes is inverterted while the handed
	// in extent will be strictly positive!
	var upperLeftCorner = ol.extent.getTopLeft(extent);
	var bottomRightCorner = ol.extent.getBottomRight(extent);
	var upperLeftCornerOfPrototype = ol.extent.getTopLeft(bboxPrototype);
	prototypeFeature.getGeometry().translate(
		-(upperLeftCornerOfPrototype[0]-upperLeftCorner[0]),
		-(upperLeftCornerOfPrototype[1]+bottomRightCorner[1]));

	// this if deals with randomized placement
	if (random_placement) {
		// We'd like to adjust our future extent for randomization purposes
		// so that we are always going to be inside when we pick a random point
		// for the upper left corner
		extent = [
				0,
				0,
				(availableWidth - bboxWidth),
				(availableHeight - bboxHeight)];

		for (var n=0;n<number;n++) { // we want number instances of that type...
			var randomTopLeftCorner =
				ome.ol3.utils.Regions.getRandomCoordinateWithinExtent(extent);
			if (randomTopLeftCorner === null) {
				console.error("couldn't get random coordinate");
				break;
			}
			// clone the feature, then translate
			var newFeature =
				new ol.Feature({ "geometry" : prototypeFeature.getGeometry().clone()});
			newFeature['type'] = prototypeFeature['type'];
			newFeature.setStyle(
				ome.ol3.utils.Style.cloneStyle(prototypeFeature.getStyle()));
			// we translate relative to our origin based on the randomized offset
			newFeature.getGeometry().translate(
				randomTopLeftCorner[0], -randomTopLeftCorner[1]);
			// we generate an id of the form -1:uid
			newFeature.setId("-1:" + ol.getUid(newFeature));
			newFeature['state'] = ome.ol3.REGIONS_STATE.ADDED; // state: added
			ret.push(newFeature);
		}
		return ret;
	}

	// find out how many we could fit in a row/column next to each other
	var fits =
		ome.ol3.utils.Regions.getFitsWithinExtent(
			number, extent, bboxWidth, bboxHeight);

	// generate shapes
	var featureCount = 0;
	for (var y=0; y*fits['stepY'] < availableHeight; y++) {
		if (featureCount >= number) break;

		for (var x=0; x*fits['stepX'] < availableWidth; x++) {
			if (featureCount >= number) break;
			// clone the feature, then translate
			var newFeature =
				new ol.Feature(
					{ "geometry" : prototypeFeature.getGeometry().clone()});
			newFeature['type'] = prototypeFeature['type'];
			newFeature.setStyle(
				ome.ol3.utils.Style.cloneStyle(prototypeFeature.getStyle()));
			// we shift coordinates
			newFeature.getGeometry().translate(
				x*fits['stepX'], -y*fits['stepY']);
			// we generate an id of the form -1:uid
			newFeature.setId("-1:" + ol.getUid(newFeature));
			newFeature['state'] = ome.ol3.REGIONS_STATE.ADDED; // state: added
			ret.push(newFeature);
			featureCount++;
		}
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

/*
 * Clusters a given rtree returning an array of rtrees of clustered features
 *
 * @static
 * @param {ol.struct.RBush} rTree an rTree
 * @param {number=} threshold a limit that needs to be exceeded to cluster another rtree level higher up
 * @return {Array.<ol.struct.RBush>|null} an array of rtrees according to levels or null if something went wrong
 */
ome.ol3.utils.Regions.clusterFeatures = function(rTree, threshold) {
	if (!(rTree instanceof ol.structs.RBush) ||
				typeof(rTree.rbush_) !== 'object' ||
				typeof(rTree.rbush_.data) !== 'object')
		return null;

	if (typeof(threshold) !== 'number' || threshold <= 100)
		threshold = 100;

	// go recursively
	var clusterLevels = [];
	ome.ol3.utils.Regions.clusterFeaturesRecursively(rTree.rbush_.data, clusterLevels);

	// we now construct an rtree for each level
	var clusteredRTrees = []
	for (var l in clusterLevels) {
		var rTreeForLevel = new ol.structs.RBush();
		var extents = [];
		var clusters = [];
		var clusterLevel = clusterLevels[l];
		for (var f in clusterLevel) {
			var cluster = clusterLevel[f];
			extents.push(cluster.getBBox());
			clusters.push(cluster);
		}
		rTreeForLevel.load(extents, clusters);
		clusteredRTrees.push(rTreeForLevel);

		if (clusterLevels[l].length < threshold)
			break; // we don't need more levels
	}

	return clusteredRTrees;
};

/**
 * Is called by {@link ome.ol3.utils.Regions#clusterFeatures} internally
 * to descend recursively and then propagate clusters up the tree to the top.
 *
 * @static
 * @private
 * @param {Object} node an rbush node with bbox/height/leaf info as well as children arrays
 * @param {Array.<Array.<ome.ol3.feature.Cluster>>} levels the array levels (each an array) of cluster objects
 * @return {Array.<ome.ol3.feature.Cluster>} the combined clusters of what's below
 */
ome.ol3.utils.Regions.clusterFeaturesRecursively = function(node, levels) {
	// we stop in case we don't have information we expect
	// e.g. node is not object, node does not have either leaf/height property
	// or, in the expected case, once we reach height 1 which means leaf: true
	if (typeof(node) !== 'object' ||
				!ome.ol3.utils.Misc.isArray(levels) ||
				(typeof(node.height) !== 'number' &&
				 typeof(node.leaf) !== 'boolean')) return null;

	// end of recursion at height 1
	if ((typeof(node.leaf) === 'boolean' && node.leaf) ||
			(typeof(node.height) === 'number' && node.height == 1)) {
		// loop over children to get all features into array as we want them to be
		var tmp = [];
		var newCluster = new ome.ol3.feature.Cluster();
		for (var child in node.children) {
			if (typeof node.children[child] !== 'object' ||
                    !(node.children[child].value instanceof ol.Feature))
				return null;
            // we need arrays of length 5 (4 bbox coords + 1 feature object)
			var tmpFeature = node.children[child].value;
			tmpFeature['cluster'] = newCluster; // set a reference back
			tmp.push(tmpFeature);
		}
		newCluster.initializeCluster(
            [node.minX, node.minY, node.maxX, node.maxY], tmp);

		if (!ome.ol3.utils.Misc.isArray(levels[0]))
			levels.push([]);

		levels[0].push(newCluster);
		return newCluster;
	}

	// we descend deeper for each child
	var ret = [];
	for (var child in node.children)
		ret.push(
			ome.ol3.utils.Regions.clusterFeaturesRecursively(
				node.children[child], levels));

	// now that we have been through all children
	// let's combine all child clusters into one bigger cluster
	var presentLevel = node.height -1;
	if (!ome.ol3.utils.Misc.isArray(levels[presentLevel]))
		levels.push([]);
	var tmp = [];
	for (var r in ret)
		tmp = tmp.concat(ret[r].features_);
	var combinedCluster = new ome.ol3.feature.Cluster(
        [node.minX, node.minY, node.maxX, node.maxY], tmp);
	levels[presentLevel].push(combinedCluster);

	return combinedCluster;
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

			// we only display shapes meant for the present T and Z index
			// we also need a type to be able to continue
			if (regions.viewer_ === null ||
				typeof(shapeType) !== 'string' ||
				(shapeTindex !== -1 && regions.viewer_.getDimensionIndex('t') !== shapeTindex) ||
				(shapeZindex !== -1 && regions.viewer_.getDimensionIndex('z') !== shapeZindex))
				continue;

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
			if (shapeTindex != -1)
				actualFeature['theT'] = shapeTindex;
			if (shapeZindex != -1)
				actualFeature['theZ'] = shapeZindex;
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
