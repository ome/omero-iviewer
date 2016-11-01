goog.provide('ome.ol3.geom.Line');

goog.require('ol.geom.LineString');

/**
 * @classdesc
 * An abstraction to add arrow info and if we are a polyline
 *
 * @constructor
 * @extends {ol.geom.LineString}
 *
 * @param {Array.<Array.<number>>} coordinates a coordinates array of x,y tuples
 * @param {boolean} draw_start_arrow flag if we need to draw an arrow at the head
 * @param {boolean} draw_end_arrow flag if we need to draw an arrow at the tail
 */
ome.ol3.geom.Line = function(
    coordinates, draw_start_arrow, draw_end_arrow) {
    if (!ome.ol3.utils.Misc.isArray(coordinates) || coordinates.length < 2)
        console.error("Line needs a minimum of 2 points!");

    /**
	 * flag whether we have a start arrow
	 *
	 * @type {Array}
	 * @private
	 */
	this.has_start_arrow_ =
        typeof draw_start_arrow === 'boolean' && draw_start_arrow;

    /**
	 * flag whether we have an end arrow
	 *
	 * @type {Array}
	 * @private
	 */
	this.has_end_arrow_ =
        typeof draw_end_arrow === 'boolean' && draw_end_arrow;

 	// call super
	goog.base(this, coordinates);
}
goog.inherits(ome.ol3.geom.Line, ol.geom.LineString);


/**
 * Make a complete copy of the geometry.
 * @return {boolean} true if we have more than 2 points, otherwise false
 * @api stable
 */
ome.ol3.geom.Line.prototype.isPolyline = function() {
    var coords = this.getCoordinates();
    if (coords.length > 2) return true;

    return false;
};


/**
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.Line} Clone.
 * @api stable
 */
ome.ol3.geom.Line.prototype.clone = function() {
  return new ome.ol3.geom.Line(this.getCoordinates().slice());
};
