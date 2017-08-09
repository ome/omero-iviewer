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
goog.provide('ome.ol3.geom.Polygon');

goog.require('ol.geom.Polygon');

/**
 * @classdesc
 * Polygon is an extension of the built-in ol.geom.Polygon to be able
 * to use affine transformations
 *
 *
 * @constructor
 * @extends {ol.geom.Polygon}
 *
 * @param {Array.<Array>} coords the coordinates for the polygon
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
ome.ol3.geom.Polygon = function(coords, transform) {
    // preliminary checks: are all mandatory paramters numeric
    if (!ome.ol3.utils.Misc.isArray(coords) || coords.length === 0)
        console.error("Polygon needs a non-empty array of coordinates!");

    /**
     * the initial coordinates as a flat array
     * @type {Array.<number>}
     * @private
     */
    this.initial_coords_ = null;

    /**
     * the transformation matrix of length 6
     * @type {Array.<number>|null}
     * @private
     */
    this.transform_ =
        ome.ol3.utils.Transform.convertAffineTransformIntoMatrix(transform);

    // call super and hand in our coordinate array
    goog.base(this, coords);
    this.initial_coords_ = this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates =
        ome.ol3.utils.Transform.applyTransform(
            this.transform_, this.initial_coords_);
}
goog.inherits(ome.ol3.geom.Polygon, ol.geom.Polygon);


/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
ome.ol3.geom.Polygon.prototype.getPolygonCoordinates = function() {
    return (
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
    );
}

/**
 * Gets the transformation associated with the polygon
 * @return {Object|null} the AffineTransform object (omero marshal) or null
 */
ome.ol3.geom.Polygon.prototype.getTransform = function() {
    return ome.ol3.utils.Transform.convertMatrixToAffineTransform(
        this.transform_);
}

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
ome.ol3.geom.Polygon.prototype.translate = function(deltaX, deltaY) {
    // delegate
    if (this.transform_) {
        this.transform_[4] += deltaX;
        this.transform_[5] -= deltaY;
        this.flatCoordinates =
            ome.ol3.utils.Transform.applyTransform(
                this.transform_, this.initial_coords_);
        this.changed();
    } else ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
};

/**
 * Returns the coordinates after (potentially) inverting a transformation
 * @return {Array} the coordinate array
 */
ome.ol3.geom.Polygon.prototype.getInvertedCoordinates = function() {
    if (this.transform_ === null) return this.getCoordinates();

    var coords = this.getCoordinates();
    var invCoords = new Array(coords[0].length);
    for (var i=0;i<coords[0].length;i++)
        invCoords[i] =
            ome.ol3.utils.Transform.applyInverseTransform(
                this.transform_, coords[0][i]);

    return [invCoords];
}

/**
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.Polygon} Clone.
 */
ome.ol3.geom.Polygon.prototype.clone = function() {
    return new ome.ol3.geom.Polygon(
            this.getInvertedCoordinates(), this.getTransform());
};
