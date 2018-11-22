import OLPolygon from "ol/geom/polygon";
import GeometryLayout from "ol/geom/geometrylayout";
import SimpleGeometry from "ol/geom/simplegeometry";
import * as RegionsUtils from "../utils/Regions";
import * as TransformUtils from "../utils/Transform";

/**
 * @classdesc
 * Rectangle is an extension of the built-in ol.geom.Polygon that will allow
 * you to create rectangles within the open layers framework.
 *
 * To be least intrusive and most compatible, we use the next obvious things
 * which is a polygon to represent the rectangle. Note that the given point
 * represents the upper left corner!
 *
 * @constructor
 * @extends {ol.geom.Polygon}
 *
 * @param {number} x the x coordinate of the upper left corner
 * @param {number} y the y coordinate of the upper left corner
 * @param {number} w the width of the rectangle
 * @param {number} h the height of the rectangle
 * @param {Object=} transform an AffineTransform object according to omero marshal
 */
export default class Rectangle extends OLPolygon {

    constructor(x, y, w, h, transform) {
        // preliminary checks: set sensible defaults if violated
        if (typeof x !== 'number') x = 0;
        if (typeof y !== 'number') y = 0;
        if (typeof w !== 'number' || w <= 0) w = 1;
        if (typeof h !== 'number' || h <= 0) h = 1;

        // set the rectangle coordinates
        const coords = [[
            [x, y],
            [x + w, y],
            [x + w, y - h],
            [x, y - h],
            [x, y]
        ]];

        // call super and hand in our coordinate array
        super(coords, GeometryLayout.XY);

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

        this.initial_coords_ = this.getFlatCoordinates();

        // apply potential transform
        this.flatCoordinates = TransformUtils.applyTransform(
            this.transform_, this.initial_coords_);
    }

    /**
     * Gets the upper left corner coordinates as an array [x,y]
     * @return {Array.<number>} the upper left corner
     */
    getUpperLeftCorner() {
        let flatCoords = this.getRectangleCoordinates();
        if (!Array.isArray(flatCoords) || flatCoords.length !== 10)
            return null;

        return [flatCoords[0], flatCoords[1]];
    }

    /**
     * sets the upper left corner using a coordinate array [x,y]
     *
     * @param {Array.<number>} value upper left corner
     */
    setUpperLeftCorner(value) {
        if (!Array.isArray(value)) return;
        this.changeRectangle(value[0], value[1]);
    }

    /**
     * Gets the width of the rectangle
     * @return {number} the width of the rectangle
     */
    getWidth() {
        let flatCoords = this.getRectangleCoordinates();
        if (!Array.isArray(flatCoords) || flatCoords.length !== 10)
            return 0;

        return flatCoords[2] - flatCoords[0];
    }

    /**
     * Sets the width of the rectangle
     *
     * @param {number} value the width of the rectangle
     */
    setWidth(value) {
        this.changeRectangle(null, null, value, null);
    }

    /**
     * Gets the height of the rectangle
     * @return {number} the height of the rectangle
     */
    getHeight() {
        let flatCoords = this.getRectangleCoordinates();
        if (!Array.isArray(flatCoords) || flatCoords.length !== 10)
            return 0;

        return Math.abs(flatCoords[5] - flatCoords[3]);
    }

    /**
     * Sets the height of the rectangle
     *
     * @param {number} value the height of the rectangle
     */
    setHeight(value) {
        this.changeRectangle(null, null, null, value);
    }

    /**
     * Changes the coordinates/dimensions of an existing rectangle.
     * Used internally.
     *
     * @private
     * @param {number} x the x coordinate of the upper left corner
     * @param {number} y the y coordinate of the upper left corner
     * @param {number} w the width of the rectangle
     * @param {number} h the height of the rectangle
     */
    changeRectangle(x, y, w, h) {
        let flatCoords = this.getRectangleCoordinates();
        if (!Array.isArray(flatCoords) || flatCoords.length !== 10)
            return;

        if (typeof(x) !== 'number') x = flatCoords[0];
        if (typeof(y) !== 'number') y = flatCoords[1];
        if (typeof(w) !== 'number') w = this.getWidth();
        if (typeof(h) !== 'number') h = this.getHeight();

        let coords = [[
            [x, y],
            [x + w, y],
            [x + w, y - h],
            [x, y - h],
            [x, y]
        ]];
        this.setCoordinates(coords);
    }

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
            this.flatCoordinates = TransformUtils.applyTransform(
                this.transform_, this.initial_coords_);
            this.changed();
        } else {
            SimpleGeometry.prototype.translate.call(this, deltaX, deltaY)
        }
    };

    /**
     * Turns the tansformation matrix back into the ome model object
     * @return {Object|null} the ome model transformation
     */
    getTransform() {
        if (!Array.isArray(this.transform_)) return null;

        return {
            '@type': "http://www.openmicroscopy.org/Schemas/OME/2016-06#AffineTransform",
            'A00': this.transform_[0], 'A10': this.transform_[1],
            'A01': this.transform_[2], 'A11': this.transform_[3],
            'A02': this.transform_[4], 'A12': this.transform_[5]
        };
    }

    /**
     * Returns the coordinates as a flat array (excl. any potential transform)
     * @return {Array.<number>} the coordinates as a flat array
     */
    getRectangleCoordinates() {
        return (
            this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
        );
    }

    /**
     * Make a complete copy of the geometry.
     * @return {Rectangle} Clone.
     */
    clone() {
        let topLeft = this.getUpperLeftCorner();
        return new Rectangle(
            topLeft[0], topLeft[1], this.getWidth(), this.getHeight(),
            this.getTransform());
    };

    /**
     * Returns the length of the rectangle
     *
     * @return {number} the length of the rectangle
     */
    getLength() {
        return RegionsUtils.getLength(this);
    }

}
