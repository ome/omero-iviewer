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
goog.provide('ome.ol3.geom.Point');

goog.require('ol.geom.Circle');

/**
 * @classdesc
 * Point extends of the built-in ol.geom.Circle
 *
 * @constructor
 * @extends {ol.geom.Circle}
 *
 * @param {Array.<number>} coords the point coordinates
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
ome.ol3.geom.Point = function(coords, transform) {
    // preliminary checks: are all mandatory paramters numeric
    if (!ome.ol3.utils.Misc.isArray(coords) || coords.length !== 2)
        console.error("Point needs an array of coordinates (length: 2)!");

    /**
     * the size of the point (radius of circle that is)
     * @type {Array.<number>}
     * @private
     */
    this.radius_ = 5;

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

    // call super, handing in our coordinates and radius
    goog.base(this, coords, this.radius_);
    this.initial_coords_ = this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates =
        ome.ol3.utils.Transform.applyTransform(
            this.transform_, this.initial_coords_);
}
goog.inherits(ome.ol3.geom.Point, ol.geom.Circle);


/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
ome.ol3.geom.Point.prototype.getPointCoordinates = function() {
    var ret =
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates();
    return ret.slice(0, 2);
}

/**
 * Gets the transformation associated with the point
 * @return {Object|null} the AffineTransform object (omero marshal) or null
 */
ome.ol3.geom.Point.prototype.getTransform = function() {
    return ome.ol3.utils.Transform.convertMatrixToAffineTransform(
        this.transform_);
}

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
ome.ol3.geom.Point.prototype.translate = function(deltaX, deltaY) {
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
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.Point} Clone.
 */
ome.ol3.geom.Point.prototype.clone = function() {
    return new ome.ol3.geom.Point(
        this.getPointCoordinates(), this.getTransform());
};
