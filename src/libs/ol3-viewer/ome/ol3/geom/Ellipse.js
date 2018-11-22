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
import Polygon from "ol/geom/polygon";
import * as TransformUtils from '../utils/Transform';
import * as MiscUtils from '../utils/Misc';
import * as RegionsUtils from '../utils/Regions';

/**
 * @classdesc
 * Ellipse is an extension of the built-in ol.geom.Polygon that will allow
 * you to create ellipses within the open layers framework.
 *
 * At present the approach taken is aiming at best integration into openlayers
 * as well as cross browser support. For HTMLCanvas there is a drawEllipse
 * method which, toDate, is only supported by Chrome.
 *
 * That said, there are letious methods out there how people accomplish the task
 * of drawing en ellipse on an HTMLCanvas. They range from scaled circles, over
 * sets of bezier curves to what is, undoubtedly, the most accurate method
 * mathematically, namely to trace the outline for a given step size according to
 * the following formulae for x,y:
 * <pre>x = a * cos(theta)</pre> and
 * <pre>y = b * sin(theta)</pre>
 * see: {@link https://en.wikipedia.org/wiki/Ellipse}
 *
 * The latter technique is used here since it's accurate enough and produces
 * a polygon of connected points which openlayers likes.
 *
 *
 * @constructor
 * @extends {ol.geom.Polygon}
 *
 * @param {number} cx the center x coordinate of the ellipse
 * @param {number} cy the center y coordinate of the ellipse
 * @param {number} rx the radius x distance of the ellipse
 * @param {number} ry the radius y distance of the ellipse
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
export default class Ellipse extends Polygon {

    /**
     * default step size for plotting
     * @type {number} 0.1
     * @private
     */
    static DEFAULT_STEP_SIZE = 0.1;

    static calcCoords(cx, cy, rx, ry, t, transform) {
        let coords = [];
        for (let i = 0, ii = 2 * Math.PI; i < ii; i += t) {
            let x = cx + rx * Math.cos(i);
            let y = cy + ry * Math.sin(i);
            coords.push(TransformUtils.applyTransform(transform, [x, y]));
        }
        if (coords.length > 0) coords.push(coords[0]); // close polygon
        return coords;
    }

    constructor(cx, cy, rx, ry, t, transform) {
        if (typeof cx !== 'number' || typeof cy !== 'number' ||
            typeof rx !== 'number' || typeof ry !== 'number')
            console.error("at least one ellipse param is not numeric!");

        // Convert affine transform to matrix
        const matrixTransform =
            TransformUtils.convertAffineTransformIntoMatrix(transform);

        // Call base class
        super(Ellipse.calcCoords(cx, cx, rx, ry, matrixTransform));

        /**
         * center x coordinate
         * @type {number}
         * @private
         */
        this.cx_ = cx;

        /**
         * center y coordinate
         * @type {number}
         * @private
         */
        this.cy_ = cy;

        /**
         * radius x distance
         * @type {number}
         * @private
         */
        this.rx_ = rx;

        /**
         * radius y distance
         * @type {number}
         * @private
         */
        this.ry_ = ry;

        /**
         * the transformation matrix of length 6
         * @type {Array.<number>|null}
         * @private
         */
        this.transform_ = matrixTransform;

        /**
         * the step size for plotting
         * @type {number}
         * @private
         */
        this.step_ = Ellipse.DEFAULT_STEP_SIZE;
    }

    /**
     * Traces out the ellipse and returns the coords
     * @return {Array.<number>} the coordinate array for the outline
     */
    getPolygonCoords() {
        // trace ellipse now and store coordinates
        return Ellipse.calcCoords(this.cx_, this.cy_, this.rx_, this.ry_,
            this.step_, this.transform_);
    }



    /**
     * Gets the transformation associated with the ellipse
     * @return {Object|null} the AffineTransform object (omero marshal) or null
     */
    getTransform() {
        return TransformUtils.convertMatrixToAffineTransform(this.transform_);
    }

    /**
     * Gets the center of the ellipse in array form [cx,cy]
     * @return {Array.<number>} the center of the ellipse as an array
     */
    getCenter() {
        return [this.cx_, this.cy_];
    }

    /**
     * Sets the center of the ellipse using a coordinate array [cx, cy]
     *
     * @param {Array.<number>} value the center of the ellipse as an array
     */
    setCenter(value) {
        if (!MiscUtils.isArray(value) ||
            typeof value[0] !== 'number' || typeof value[1] !== 'number')
            console.error(
                "the center needs to be given as a numeric array [cx,cy]");
        this.cx_ = value[0];
        this.cy_ = value[1];
    }

    /**
     * Gets the radius (distance x, distance y) of the ellipse in array form [rx,ry]
     * @return {Array.<number>} the radius of the ellipse as an array
     */
    getRadius() {
        return [this.rx_, this.ry_];
    }

    /**
     * Sets the radius (distance x, distance y) of the ellipse in array form [rx,ry]
     *
     * @param {Array.<number>} value the radius of the ellipse as an array
     */
    setRadius(value) {
        if (!MiscUtils.isArray(value) ||
            typeof value[0] !== 'number' || typeof value[1] !== 'number')
            console.error("the radius needs to be given as a numeric array [cx,cy]");
        this.rx_ = value[0];
        this.ry_ = value[1];
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
            this.setCoordinates([this.getPolygonCoords()]);
        } else {
            ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
            this.setCenter([this.cx_ + deltaX, this.cy_ + deltaY]);
        }
    };

    /**
     * First scale then store the newly scaled coords
     *
     * @private
     */
    scale(factor) {
        // delegate
        if (this.transform_) {
            this.transform_[0] *= factor;
            this.transform_[1] *= factor;
            this.transform_[2] *= factor;
            this.transform_[3] *= factor;
            this.setCoordinates([this.getPolygonCoords()]);
        } else {
            ol.geom.SimpleGeometry.prototype.scale.call(this, factor);
            let radius = this.getRadius();
            this.setRadius([radius[0] * factor, radius[1] * factor])
        }
    };

    /**
     * Returns the length of the ellipse
     *
     * @return {number} the length of the ellipse
     */
    getLength() {
        return RegionsUtils.getLength(this);
    }

    /**
     * Make a complete copy of the geometry.
     * @return {Ellipse} Clone.
     */
    clone() {
        return new Ellipse(
            this.cx_, this.cy_, this.rx_, this.ry_, this.getTransform());
    };
}



