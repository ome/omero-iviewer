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
import LineString from "ol/geom/linestring";
import SimpleGeometry from 'ol/geom/simplegeometry';
import Polygon from "ol/geom/polygon";
import * as TransformUtils from '../utils/Transform';
import * as MiscUtils from '../utils/Misc';

/**
 * @classdesc
 * An abstraction to add arrow info and if we are a polyline
 *
 * @constructor
 * @extends {LineString}
 *
 * @param {Array.<Array.<number>>} coordinates a coordinates array of x,y tuples
 * @param {boolean} draw_start_arrow flag if we need to draw an arrow at the head
 * @param {boolean} draw_end_arrow flag if we need to draw an arrow at the tail
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
export default class Line extends LineString {

    constructor(coordinates, draw_start_arrow, draw_end_arrow, transform) {
        if (!MiscUtils.isArray(coordinates) || coordinates.length < 2)
            console.error("Line needs a minimum of 2 points!");

        super(coordinates);

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
             TransformUtils.convertAffineTransformIntoMatrix(transform);

        /**
         * flag whether we have a start arrow
         *
         * @type {Array}
         * @public
         */
        this.has_start_arrow_ =
            typeof draw_start_arrow === 'boolean' && draw_start_arrow;

        /**
         * flag whether we have an end arrow
         *
         * @type {Array}
         * @public
         */
        this.has_end_arrow_ =
            typeof draw_end_arrow === 'boolean' && draw_end_arrow;

        this.initial_coords_ = this.getFlatCoordinates();

        // apply potential transform
        this.flatCoordinates = TransformUtils.applyTransform(
                this.transform_, this.initial_coords_);
    }

    /**
     * Make a complete copy of the geometry.
     * @return {boolean} true if we have more than 2 points, otherwise false
     * @api stable
     */
    isPolyline() {
        let coords = this.getCoordinates();
        if (coords.length > 2) return true;

        return false;
    };

    /**
     * Override translation to take care of possible transformation
     *
     * @private
     */
    translate(deltaX, deltaY) {
        // delegate
        if (this.transform_) {
            this.transform_[4] += deltaX;
            this.transform_[5] -= deltaY;
            this.flatCoordinates =
                TransformUtils.applyTransform(
                    this.transform_, this.initial_coords_);
            this.changed();
        } else SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
    };

    /**
     * Generated the arrow geometry (triangle) for a given direction, base width
     * and height
     *
     * @param {boolean} head true will create a head arrow, false a tail one
     * @param {number} width the base with of the arrow
     * @param {number} height the height/length of the arrow
     * @return {ol.geom.Polygon} the arrowhead triangle
     * @api stable
     */
    getArrowGeometry(head, width, height) {
        // check params , using reasonable defaults
        if (typeof head !== 'boolean') head = true;
        if (typeof width !== 'number' || width <= 0) width = 10;
        if (typeof height !== 'number' || height <= 0) height = 2* width;

        // we need to half width
        width /= 2;

        // get coordinates
        let coords = this.getCoordinates();
        let coordsLength = coords.length;

        // grab last line segment
        let index = head ? coordsLength-1 : 1;
        let line = [coords[index][0] - coords[index-1][0],
            coords[index][1] - coords[index-1][1]];
        if (!head) index = 0;
        let tip = [coords[index][0],coords[index][1]];

        // get unit vector and perpendicular unit vector
        let magnitude =
            Math.sqrt(line[0]*line[0] + line[1]*line[1]);
        let unitLine = [line[0]/magnitude,line[1]/magnitude];
        let perpLine = [-unitLine[1], unitLine[0]];

        // calculate base points and tip
        let direction = head ? 1 : -1;
        let point1 = [tip[0] - direction*height*unitLine[0] - width*perpLine[0],
            tip[1] - direction*height*unitLine[1] - width*perpLine[1]];
        let point2 = [tip[0] - direction*height*unitLine[0] + width*perpLine[0],
            tip[1] - direction*height*unitLine[1] + width*perpLine[1]];

        return new Polygon([[tip, point1, point2]]);
    };

    /**
     * Returns the coordinates as a flat array (excl. any potential transform)
     * @return {Array.<number>} the coordinates as a flat array
     */
    getLineCoordinates() {
        return (
            this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
        );
    }

    /**
     * Gets the transformation associated with the Line
     * @return {Object|null} the AffineTransform object (omero marshal) or null
     */
    getTransform() {
        return TransformUtils.convertMatrixToAffineTransform(
            this.transform_);
    }

    /**
     * Returns the coordinates after (potentially) inverting a transformation
     * @return {Array} the coordinate array
     */
    getInvertedCoordinates() {
        if (this.transform_ === null) return this.getCoordinates();

        let coords = this.getCoordinates();
        let invCoords = new Array(coords.length);
        for (let i=0;i<coords.length;i++)
            invCoords[i] =
               TransformUtils.applyInverseTransform(
                    this.transform_, coords[i]);

        return invCoords;
    }

    /**
     * Make a complete copy of the geometry.
     * @return {Line} Clone.
     * @api stable
     */
    clone() {
        return new Line(
            this.getInvertedCoordinates().slice(),
            this.has_start_arrow_, this.has_end_arrow_, this.getTransform());
    };

    /**
     * Returns the length of the line
     *
     * @return {number} the length of the line
     */
    getLength() {
        return ome.ol3.utils.Regions.getLength(this);
    }

}


