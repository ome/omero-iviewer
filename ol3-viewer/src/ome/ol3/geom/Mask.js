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
goog.provide('ome.ol3.geom.Mask');

goog.require('ol.geom.Point');

/**
 * @classdesc
 * In order to be able to conform to the general workflow for rois
 * masks have to be treated as points with IconImageStyle.
 *
 * @constructor
 * @extends {ol.geom.Point}
 *
 * @param {number} x the top left x coordinate of the mask
 * @param {number} y the top left y coordinate of the mask
 * @param {number} w the width of the mask
 * @param {number} h the height of the mask
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
ome.ol3.geom.Mask = function(x, y, w, h, transform) {
    // preliminary checks
    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof w !== 'number' || typeof h !== 'number' ||
        isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h))
            console.error("Mask needs x,y, width and height!");

    /**
     * the
     * @type {Array.<number>}
     * @private
     */
    this.size_ = [w, h];

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

    // call super
    goog.base(this, [x, y]);
    this.initial_coords_ = this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates =
        ome.ol3.utils.Transform.applyTransform(
            this.transform_, this.initial_coords_);
}
goog.inherits(ome.ol3.geom.Mask, ol.geom.Point);


/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
ome.ol3.geom.Mask.prototype.getPointCoordinates = function() {
    var ret =
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates();
    return ret.slice(0, 2);
}

/**
 * Gets the transformation associated with the point
 * @return {Object|null} the AffineTransform object (omero marshal) or null
 */
ome.ol3.geom.Mask.prototype.getTransform = function() {
    return ome.ol3.utils.Transform.convertMatrixToAffineTransform(
        this.transform_);
}

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
ome.ol3.geom.Mask.prototype.translate = function(deltaX, deltaY) {
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
 * @return {ome.ol3.geom.Mask} Clone.
 */
ome.ol3.geom.Mask.prototype.clone = function() {
    var pointCoords = this.getPointCoordinates();
    return new ome.ol3.geom.Mask(
        pointCoords[0], pointCoords[1],
        this.size_[0], this.size_[1], this.getTransform());
};

/**
 * Returns the area.of the mask
 * @return {number} the area of the mask.
 */
ome.ol3.geom.Mask.prototype.getArea = function() {
    return this.size_[0] * this.size_[1];
}

/**
 * Returns the length of the mask
 *
 * @return {number} the length of the mask
 */
ome.ol3.geom.Mask.prototype.getLength = function() {
    return 2 * (this.size_[0] + this.size_[1]);
}
