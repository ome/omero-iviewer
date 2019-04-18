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

import Point from 'ol/geom/Point';
import SimpleGeometry from 'ol/geom/SimpleGeometry';
import {intersectsLinearRing} from 'ol/geom/flat/intersectsextent';
import Rectangle from './Rectangle';
import {applyTransform,
    convertMatrixToAffineTransform,
    convertAffineTransformIntoMatrix} from '../utils/Transform';

/**
 * @classdesc
 * In order to be able to conform to the general workflow for rois
 * masks have to be treated as points with IconImageStyle.
 *
 * @extends {ol.geom.Point}
 */
class Mask extends Point {

    /**
     * @constructor
     *
     * @param {number} x the top left x coordinate of the mask
     * @param {number} y the top left y coordinate of the mask
     * @param {number} w the width of the mask
     * @param {number} h the height of the mask
     * @param {Object=} transform an AffineTransform object according to omero marshal
     */
    constructor(x, y, w, h, transform) {
        // preliminary checks
        if (typeof x !== 'number' || typeof y !== 'number' ||
            typeof w !== 'number' || typeof h !== 'number' ||
            isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h))
                console.error("Mask needs x,y, width and height!");

        super([x, y]);

        /**
         * the size of the Mask [w, h]
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
        this.transform_ = convertAffineTransformIntoMatrix(transform);

        this.initial_coords_ = this.getFlatCoordinates();

        // apply potential transform
        this.flatCoordinates = applyTransform(
                this.transform_, this.initial_coords_);
    }

    /**
     * Returns the coordinates as a flat array (excl. any potential transform)
     * @return {Array.<number>} the coordinates as a flat array
     */
    getPointCoordinates() {
        var ret =
            this.transform_ ? this.initial_coords_ : this.getFlatCoordinates();
        return ret.slice(0, 2);
    }

    /**
     * Gets the transformation associated with the point
     * @return {Object|null} the AffineTransform object (omero marshal) or null
     */
    getTransform() {
        return convertMatrixToAffineTransform(this.transform_);
    }

    /**
     * First translate then store the newly translated coords
     *
     * @private
     */
    translate(deltaX, deltaY) {
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
     * Makes a complete copy of the geometry.
     * @return {Mask} Clone.
     */
    clone() {
        var pointCoords = this.getPointCoordinates();
        return new Mask(
            pointCoords[0], pointCoords[1],
            this.size_[0], this.size_[1], this.getTransform());
    };

    /**
     * Returns the area of the mask
     * @return {number} the area of the mask.
     */
    getArea() {
        return this.size_[0] * this.size_[1];
    }

    /**
     * Returns the length of the mask
     *
     * @return {number} the length of the mask
     */
    getLength() {
        return 2 * (this.size_[0] + this.size_[1]);
    }

    /**
     * Overrides getExtent of point geometry
     *
     * @return {Array.<number>} the extent of the mask
     */
    getExtent() {
        var pointCoords = this.getPointCoordinates();
        return [
            pointCoords[0], pointCoords[1] - this.size_[1],
            pointCoords[0] + this.size_[0], pointCoords[1],
        ];
    }

    /**
     * Overrides intersectsExtent of point geometry
     *
     * @param {Array.<number>} extent the extent to test against
     * @return {boolean} true if the given extent intersects with the mask
     */
    intersectsExtent(extent) {
        var extRect = this.getOutline().getRectangleCoordinates();
        return intersectsLinearRing(
            extRect, 0, [extRect.length], 2, extent);
    }

    /**
     * Returns a rectangle outline surrounding the mask
     *
     * @return {Array.<number>} the rectangle outline
     */
    getOutline() {
        var point = this.getPointCoordinates();
        return new Rectangle(point[0], point[1], this.size_[0], this.size_[1]);
    }

    /**
     * For displaying coords, this returns a list of [name, value] pairs
     * @return {List} 2D list of 'name', vaule pairs.
     */
    getDisplayCoords() {
        var point = this.getPointCoordinates();
        return [['X', point[0].toFixed(1)],
                ['Y', point[1].toFixed(1)],
                ['Width', this.size_[0].toFixed(1)],
                ['Height', this.size_[1].toFixed(1)]];
    }
}

export default Mask;
