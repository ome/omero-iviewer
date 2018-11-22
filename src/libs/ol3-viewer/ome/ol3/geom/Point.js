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
import SimpleGeometry from "ol/geom/simplegeometry";
import Circle from "ol/geom/circle";
import * as MiscUtils from '../utils/Misc';
import * as TransformUtils from "../utils/Transform";


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
export default class Point extends Circle {

    static DEFAULT_RADIUS = 5;


    constructor(coords, transform) {
        // preliminary checks: are all mandatory paramters numeric
        if (!MiscUtils.isArray(coords) || coords.length !== 2)
            console.error("Point needs an array of coordinates (length: 2)!");

        super(coords, Point.DEFAULT_RADIUS);

        /**
         * the size of the point (radius of circle that is)
         * @type {Array.<number>}
         * @private
         */
        this.radius_ = Point.DEFAULT_RADIUS;

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
        this.transform_ = TransformUtils.convertAffineTransformIntoMatrix(transform);

        // call super, handing in our coordinates and radius

        this.initial_coords_ = this.getFlatCoordinates();

        // apply potential transform
        this.flatCoordinates = TransformUtils.applyTransform(
            this.transform_, this.initial_coords_);
    }

    /**
     * Returns the coordinates as a flat array (excl. any potential transform)
     * @return {Array.<number>} the coordinates as a flat array
     */
    getPointCoordinates() {
        let ret =
            this.transform_ ? this.initial_coords_ : this.getFlatCoordinates();
        return ret.slice(0, 2);
    }

    /**
     * Gets the transformation associated with the point
     * @return {Object|null} the AffineTransform object (omero marshal) or null
     */
    getTransform() {
        return TransformUtils.convertMatrixToAffineTransform(this.transform_);
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
            this.flatCoordinates =
                ome.ol3.utils.Transform.applyTransform(
                    this.transform_, this.initial_coords_);
            this.changed();
        } else {
            SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
        }
    }

    /**
     * Make a complete copy of the geometry.
     * @return {Point} Clone.
     */
    clone() {
        return new Point(this.getPointCoordinates(), this.getTransform());
    }
}


