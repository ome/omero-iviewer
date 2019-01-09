//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import SimpleGeometry from 'ol/geom/SimpleGeometry';
import Circle from 'ol/geom/Circle';
import {applyTransform,
    convertAffineTransformIntoMatrix} from '../utils/Transform';
import {isArray} from '../utils/Misc';
import {inherits} from 'ol/util';

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
const Point = function(coords, transform) {
    // preliminary checks: are all mandatory paramters numeric
    if (!isArray(coords) || coords.length !== 2)
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
    this.transform_ = convertAffineTransformIntoMatrix(transform);

    // call super, handing in our coordinates and radius
    // goog.base(this, coords, this.radius_);
    Circle.call(this, coords, this.radius_);
    this.initial_coords_ = this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates = applyTransform(
            this.transform_, this.initial_coords_);
}
inherits(Point, Circle);


/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
Point.prototype.getPointCoordinates = function() {
    var ret =
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates();
    return ret.slice(0, 2);
}

/**
 * Gets the transformation associated with the point
 * @return {Object|null} the AffineTransform object (omero marshal) or null
 */
Point.prototype.getTransform = function() {
    return convertMatrixToAffineTransform(this.transform_);
}

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
Point.prototype.translate = function(deltaX, deltaY) {
    // delegate
    if (this.transform_) {
        this.transform_[4] += deltaX;
        this.transform_[5] -= deltaY;
        this.flatCoordinates = applyTransform(
                this.transform_, this.initial_coords_);
        this.changed();
    } else SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
};

/**
 * Make a complete copy of the geometry.
 * @return {Point} Clone.
 */
Point.prototype.clone = function() {
    return new Point(
        this.getPointCoordinates(), this.getTransform());
};

export default Point;
