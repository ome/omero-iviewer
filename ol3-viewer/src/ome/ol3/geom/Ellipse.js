goog.provide('ome.ol3.geom.Ellipse');

goog.require('ol.geom.Polygon');

/**
 * @classdesc
 * Ellipse is an extension of the built-in ol.geom.Polygon that will allow
 * you to create ellipses within the open layers framework.
 *
 * At present the approach taken is aiming at best integration into openlayers
 * as well as cross browser support. For HTMLCanvas there is a drawEllipse
 * method which, toDate, is only supported by Chrome.
 *
 * That said, there are various methods out there how people accomplish the task
 * of drawing en ellipse on an HTMLCanvas. They range from scaled circles, over
 * sets of bezier curves to what is, undoubtedly, the most accurate method
 * mathematically, namely to trace the outline for a given step size according to
 * the following formulae for x,y:
 * <pre>x = a * cos(theta)</pre> and
 * <pre>y = b * sin(theta)</pre>
 * see: {@link https://en.wikipedia.org/wiki/Ellipse}
 *
 * The latter technique is used here since it's accurate enough and produces
 * a polygon of connected points which openlayers likes.
 *
 *
 * @constructor
 * @extends {ol.geom.Polygon}
 *
 * @param {number} cx the center x coordinate of the ellipse
 * @param {number} cy the center y coordinate of the ellipse
 * @param {number} rx the radius x distance of the ellipse
 * @param {number} ry the radius y distance of the ellipse
 * @param {string=} transform a string of 6 numeric entries wrapped in a matrix( ... )
 * @param {number=} theta the (optional) angle for rotation (def: 0 - no rotation)
 * @param {number=} step the (optional) step size for tracing out the ellipse (def: 0.1)
 */
ome.ol3.geom.Ellipse = function(cx, cy, rx, ry, transform, theta, step) {

	// preliminary checks: are all mandatory paramters numeric
    if (typeof cx !== 'number' || typeof cy !== 'number' ||
            typeof rx !== 'number' || typeof ry !== 'number')
        console.error("at least one ellipse param is not numeric!");

	/**
	 * center x coordinate
	 * @type {number}
	 * @private
	 */
	this.cx_ = cx;

	/**
	 * center y coordinate
	 * @type {number}
	 * @private
	 */
	this.cy_ = cy;

	/**
	 * radius x distance
	 * @type {number}
	 * @private
	 */
	this.rx_ = rx;

	/**
	 * radius y distance
	 * @type {number}
	 * @private
	 */
	this.ry_ = ry;

    /**
	 * a 3x3 transformation matrix
	 * @type {Array.<number>|null}
	 * @private
	 */
	this.transform_ = null;
    this.setTransform(transform);

	// look at the optional params
	var opt =
		{ "theta" : (theta || 0),
	 		"step" : step || 0.1};
	for (var o in opt) {
		if (typeof(opt[o]) === 'string') { // see if the string can be made a number
			try {
				opt[o] = parseInt(opt[o]);
			} catch(oopsie) {}
		}
		if (typeof(opt[o]) !== 'number') { //final sanity checks, nonsense turns to default
			if (o === 'theta') opt[o] = 0;
			if (o === 'step') opt[o] = 0.1;
			if (opt[o] < 0)
                console.error("Optional Ellipse parameters cannot be negative numbers!");
		}
	}

	/**
	 * theta the angle of rotation
	 * @type {number}
	 * @private
	 */
	this.theta_ = opt['theta'];

	/**
	 * step the step size for plotting
	 * @type {number}
	 * @private
	 */
	this.step_ = opt['step'];

    // call super and hand in our coordinate array
	goog.base(this, [this.getPolygonCoords()]);
}
goog.inherits(ome.ol3.geom.Ellipse, ol.geom.Polygon);

/**
 * Traces out the ellipse and returns the coords
 * @return {Array.<number>} the coordinate array for the outline
 */
ome.ol3.geom.Ellipse.prototype.getPolygonCoords = function() {
    // trace ellipse now and store coordinates
    var coords = [];
    for (var i = 0 * Math.PI, ii=2*Math.PI; i < ii; i += this.step_) {
        var x = this.cx_ -
            (this.ry_ * Math.sin(i)) * Math.sin(this.theta_ * Math.PI) +
            (this.rx_ * Math.cos(i)) * Math.cos(this.theta_ * Math.PI);
        var y = this.cy_ +
            (this.rx_ * Math.cos(i)) * Math.sin(this.theta_ * Math.PI) +
            (this.ry_ * Math.sin(i)) * Math.cos(this.theta_ * Math.PI);

        coords.push(
            this.applyTransform([x, y]));
    }
    if (coords.length > 0) coords.push(coords[0]); // close polygon

    return coords;
}

/**
 * Turns a transformation string - matrix (....) - into an array and stores it
 * @param {string} transform the transformation info as a string
 */
ome.ol3.geom.Ellipse.prototype.setTransform = function(transform) {
    if (typeof transform !== 'string') {
        this.transform_ = null;
        return;
    }

    // dissect the string to get our 3*3 transform matrix
    // cut out tokens 'matrix, ( and )'
    var strippedTransform = transform.replace(/\matrix|\(|\)/g, "");
    var flatMatrixEntries =
        strippedTransform.split(" ").filter( // we want just the numbers
            function(entry) {
                if (entry.trim() === "") return false;
                else return true;})
    // we have to have 6 entries
    if (flatMatrixEntries.length === 6)
        this.transform_ =
            flatMatrixEntries.map(
                function(entry) { return parseFloat(entry);});
    else this.transform_ = null;
}

/**
 * If a transform exists we apply it to the list of flat coordinates
 * @return {Array.<number>} an array of transformed coords equal in dimensinonality to the input
 */
ome.ol3.geom.Ellipse.prototype.applyTransform = function(flatCoords) {
    // preliminary checks:
    // nothing's converted if we have no transform,
    // no coords (as an array) or
    // coords that are not a multiple of 2 (we need x and y)
    if (this.transform_ === null ||
        !ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length === 0 ||
        flatCoords.length % 2 !== 0) return flatCoords;

    var transCoords = new Array(flatCoords.length);
    for (var i=0;i<transCoords.length;i+=2) {
        transCoords[i] = //x
            this.transform_[0] * flatCoords[i] +
            this.transform_[2] * (-flatCoords[i+1]) +
            this.transform_[4];
        transCoords[i+1] = //y
            -(this.transform_[1] * flatCoords[i] +
            this.transform_[3] * (-flatCoords[i+1]) +
            this.transform_[5]);
    }
    return transCoords;
}

/**
 * Performs an inverse transform (if exists) to the list of flat coordinates
 * @return {Array.<number>} an array of transformed coords equal in dimensinonality to the input
 */
ome.ol3.geom.Ellipse.prototype.applyInverseTransform = function(flatCoords) {
    // preliminary checks:
    // nothing's converted if we have no transform,
    // no coords (as an array) or
    // coords that are not a multiple of 2 (we need x and y)
    if (this.transform_ === null ||
        !ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length === 0 ||
        flatCoords.length % 2 !== 0) return flatCoords;

    var inverseTransform = this.getInvertedTransformMatrix();
    if (inverseTransform === null) return flatCoords;

    var transCoords = new Array(flatCoords.length);
    for (var i=0;i<transCoords.length;i+=2) {
        transCoords[i] = //x
            inverseTransform[0] * flatCoords[i] +
            inverseTransform[2] * (-flatCoords[i+1]) +
            inverseTransform[4];
        transCoords[i+1] = //y
            -(inverseTransform[1] * flatCoords[i] +
            inverseTransform[3] * (-flatCoords[i+1]) +
            inverseTransform[5]);
    }
    return transCoords;
}

/**
 * Turns the tansformation matrix back into a string of the format matrix (...)
 * @return {string|null} the transformation string or null
 */
ome.ol3.geom.Ellipse.prototype.getInvertedTransformMatrix = function() {
    if (this.transform_ === null) return null;

    var det = this.transform_[0] * this.transform_[3] -
        this.transform_[1] * this.transform_[2];
    if (det === 0) return null;

    var inverse = new Array(this.transform_.length);
    var a = this.transform_[0];
    var b = this.transform_[1];
    var c = this.transform_[2];
    var d = this.transform_[3];
    var e = this.transform_[4];
    var f = this.transform_[5];

    inverse[0] = d / det;
    inverse[1] = -b / det;
    inverse[2] = -c / det;
    inverse[3] = a / det;
    inverse[4] = (c * f - d * e) / det;
    inverse[5] = -(a * f - b * e) / det;

    return inverse;
}

/**
 * Turns the tansformation matrix back into a string of the format matrix (...)
 * @return {string|null} the transformation string or null
 */
ome.ol3.geom.Ellipse.prototype.getTransform = function() {
    if (!ome.ol3.utils.Misc.isArray(this.transform_) ||
        this.transform_.length <= 2 ||
        this.transform.length % 2 !== 0) return null;

    var transform = "matrix (" +
        this.transform_[0] + " " + this.transform_[1];
    for (var i=2;i<this.transform_.length;i+=2)
        transform += " " + this.transform_[i] + " " + this.transform_[i+1];
    transform += ")";

    return transform;
}

/**
 * Gets the center of the ellipse in array form [cx,cy]
 * @return {Array.<number>} the center of the ellipse as an array
 */
ome.ol3.geom.Ellipse.prototype.getCenter = function() {
	  return [this.cx_,this.cy_] ;
}

/**
 * Sets the center of the ellipse using a coordinate array [cx, cy]
 *
 * @param {Array.<number>} value the center of the ellipse as an array
 */
ome.ol3.geom.Ellipse.prototype.setCenter = function(value) {
	if (!ome.ol3.utils.Misc.isArray(value) ||
        typeof value[0] !== 'number' || typeof value[1] !== 'number')
		      console.error("the center needs to be given as a numeric array [cx,cy]");
	this.cx_ = value[0];
	this.cy_ = value[1];
}

/**
 * Gets the radius (distance x, distance y) of the ellipse in array form [rx,ry]
 * @return {Array.<number>} the radius of the ellipse as an array
 */
ome.ol3.geom.Ellipse.prototype.getRadius = function() {
	  return [this.rx_, this.ry_];
}

/**
 * Sets the radius (distance x, distance y) of the ellipse in array form [rx,ry]
 *
 * @param {Array.<number>} value the radius of the ellipse as an array
 */
ome.ol3.geom.Ellipse.prototype.setRadius = function(value) {
	if (!ome.ol3.utils.Misc.isArray(value) ||
        typeof value[0] !== 'number' || typeof value[1] !== 'number')
            console.error("the radius needs to be given as a numeric array [cx,cy]");
	this.rx_ = value[0];
	this.ry_ = value[1];
}

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
ome.ol3.geom.Ellipse.prototype.translate = function(deltaX, deltaY) {
	// delegate
    if (this.transform_) {
            this.transform_[4] += deltaX;
            this.transform_[5] -= deltaY;
            this.setCoordinates([this.getPolygonCoords()]);
    } else {
        ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
        this.setCenter([this.cx_ + deltaX, this.cy_ + deltaY]);
    }
};

/**
 * First scale then store the newly scaled coords
 *
 * @private
 */
ome.ol3.geom.Ellipse.prototype.scale = function(factor) {
	// delegate
    if (this.transform_) {
        this.transform_[0] *= factor;
        this.transform_[1] *= factor;
        this.transform_[2] *= factor;
        this.transform_[3] *= factor;
        this.setCoordinates([this.getPolygonCoords()]);
    } else {
        ol.geom.SimpleGeometry.prototype.scale.call(this, factor);
        var radius = this.getRadius();
        this.setRadius([radius[0] * factor, radius[1] * factor])
    }
};

/**
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.Ellipse} Clone.
 */
ome.ol3.geom.Ellipse.prototype.clone = function() {
  return new ome.ol3.geom.Ellipse(
		this.cx_, this.cy_, this.rx_, this.ry_,
        this.getTransform(),
        this.theta_, this.step_);
};
