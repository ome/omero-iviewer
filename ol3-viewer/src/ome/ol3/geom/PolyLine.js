goog.provide('ome.ol3.geom.PolyLine');

goog.require('ol.geom.LineString');

/**
 * @classdesc
 * This PolyLine class makes it possible for us to distinguish in between
 * a regular line and a polyline as far as omero rois are concerned.
 * For openlayers this distinction is irrelevant. Both are ol.geom.LineString
 *
 * @constructor
 * @extends {ol.geom.LineString}
 *
 * @param {Array.<Array.<number>>} coordinates a coordinates array of x,y tuples
 */
ome.ol3.geom.PolyLine = function(coordinates) {
    if (!ome.ol3.utils.Misc.isArray(coordinates) || coordinates.length <= 2)
        console.error("PolyLine needs an array of more than 2 coordinate pairs!");

 	// call super
	goog.base(this, coordinates);
}
goog.inherits(ome.ol3.geom.PolyLine, ol.geom.LineString);

/**
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.PolyLine} Clone.
 * @api stable
 */
ome.ol3.geom.PolyLine.prototype.clone = function() {
  return new ome.ol3.geom.PolyLine(this.getCoordinates().slice());
};
