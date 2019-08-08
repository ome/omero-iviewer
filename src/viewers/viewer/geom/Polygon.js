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

import OlPolygon from 'ol/geom/Polygon';
import SimpleGeometry from 'ol/geom/SimpleGeometry';
import {isArray} from '../utils/Misc';
import {getLength} from '../utils/Regions';
import {applyTransform,
    applyInverseTransform,
    convertMatrixToAffineTransform,
    convertAffineTransformIntoMatrix} from '../utils/Transform';

/**
 * @classdesc
 * Polygon is an extension of the built-in ol.geom.Polygon to be able
 * to use affine transformations
 *
 * @extends {ol.geom.Polygon}
 */
class Polygon extends OlPolygon {

    /**
     * @constructor
     *
     * @param {Array.<Array>} coords the coordinates for the polygon
     * @param {Object=} transform an AffineTransform object according to omero marshal
     */
    constructor(coords, transform) {
        // preliminary checks: are all mandatory parameters numeric
        if (!isArray(coords) || coords.length === 0)
            console.error("Polygon needs a non-empty array of coordinates!");

        super(coords);

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
        this.flatCoordinates = applyTransform(this.transform_, this.initial_coords_);
    }

    /**
     * Returns the coordinates as a flat array (excl. any potential transform)
     * @return {Array.<number>} the coordinates as a flat array
     */
    getPolygonCoordinates() {
        return (
            this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
        );
    }

    /**
     * Gets the transformation associated with the polygon
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
     * Returns the coordinates after (potentially) inverting a transformation
     * @return {Array} the coordinate array
     */
    getInvertedCoordinates() {
        if (this.transform_ === null) return this.getCoordinates();

        var coords = this.getCoordinates();
        var invCoords = new Array(coords[0].length);
        for (var i=0;i<coords[0].length;i++)
            invCoords[i] = applyInverseTransform(
                    this.transform_, coords[0][i]);

        return [invCoords];
    }

    /**
     * Makes a complete copy of the geometry.
     * @return {Polygon} Clone.
     */
    clone() {
        return new Polygon(
                this.getInvertedCoordinates(), this.getTransform());
    };

    /**
     * Returns the length of the polygon
     *
     * @return {number} the length of the polygon
     */
    getLength() {
        return getLength(this);
    }

    /**
     * For displaying coords, this returns a list of [name, value] pairs
     * @return {List} 2D list of 'name', vaule pairs.
     */
    getDisplayCoords() {
        let coords = this.getInvertedCoordinates();
        // Expect only 1 set of coords
        if (coords.length !== 1) return [];
        coords = coords[0];
        return [['Points', coords.map(c => `${ c[0].toFixed(1) },${ -c[1].toFixed(1) }`).join(' ')]];
    }
}

export default Polygon;
