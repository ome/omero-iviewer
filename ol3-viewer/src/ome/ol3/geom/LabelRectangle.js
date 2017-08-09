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
goog.provide('ome.ol3.geom.Rectangle');

goog.require('ol.geom.Polygon');

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
ome.ol3.geom.Rectangle = function(x, y, w, h, transform) {
    // preliminary checks: set sensible defaults if violated
    if (typeof x !== 'number') x = 0;
    if (typeof y !== 'number') y = 0;
    if (typeof w !== 'number' || w <= 0) w = 1;
    if (typeof h !== 'number' || h <= 0) h = 1;

    /**
     * the initial coordinates as a flat array
     * @type {Array.<number>}
     * @private
     */
    this.initial_coords_ = null;

    // set the rectangle coordinates
    var coords = [[
        [x, y],
        [x+w, y],
        [x+w, y-h],
        [x, y-h],
        [x, y]
    ]];

    /**
     * the transformation matrix of length 6
     * @type {Array.<number>|null}
     * @private
     */
    this.transform_ =
        ome.ol3.utils.Transform.convertAffineTransformIntoMatrix(transform);

    // call super and hand in our coordinate array
    goog.base(this, coords, ol.geom.GeometryLayout.XY);
    this.initial_coords_ =  this.getFlatCoordinates();

    // apply potential transform
    this.flatCoordinates =
        ome.ol3.utils.Transform.applyTransform(
            this.transform_, this.initial_coords_);
}
goog.inherits(ome.ol3.geom.Rectangle, ol.geom.Polygon);

/**
 * Gets the upper left corner coordinates as an arry [x,y]
 * @return {Array.<number>} the upper left corner
 */
ome.ol3.geom.Rectangle.prototype.getUpperLeftCorner = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return null;

    return [flatCoords[0], flatCoords[1]];
}

/**
 * sets the upper left corner using a coordinate array [x,y]
 *
 * @param {Array.<number>} value upper left corner
 */
ome.ol3.geom.Rectangle.prototype.setUpperLeftCorner = function(value) {
    if (!ome.ol3.utils.Misc.isArray(value)) return;
    this.changeRectangle(value[0], value[1]);
}

/**
 * Gets the width of the rectangle
 * @return {number} the width of the rectangle
 */
ome.ol3.geom.Rectangle.prototype.getWidth = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return 0;

    return flatCoords[2]-flatCoords[0];
}

/**
 * Sets the width of the rectangle
 *
 * @param {number} value the width of the rectangle
 */
ome.ol3.geom.Rectangle.prototype.setWidth = function(value) {
    this.changeRectangle(null,null,value, null);
}

/**
 * Gets the height of the rectangle
 * @return {number} the height of the rectangle
 */
ome.ol3.geom.Rectangle.prototype.getHeight = function() {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return 0;

    return Math.abs(flatCoords[5]-flatCoords[3]);
}

/**
 * Sets the height of the rectangle
 *
 * @param {number} value the height of the rectangle
 */
ome.ol3.geom.Rectangle.prototype.setHeight = function(value) {
    this.changeRectangle(null,null,null, value);
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
ome.ol3.geom.Rectangle.prototype.changeRectangle = function(x,y,w,h) {
    var flatCoords = this.getRectangleCoordinates();
    if (!ome.ol3.utils.Misc.isArray(flatCoords) || flatCoords.length != 10)
        return;

    if (typeof(x) !== 'number') x = flatCoords[0];
    if (typeof(y) !== 'number') y = flatCoords[1];
    if (typeof(w) !== 'number') w = this.getWidth();
    if (typeof(h) !== 'number') h = this.getHeight();

    var coords = [[
        [x, y],
        [x+w, y],
        [x+w, y-h],
        [x, y-h],
        [x, y]
    ]];
 this.setCoordinates(coords);
}

/**
 * Override translation to take care of possible transformation
 *
 * @private
 */
ome.ol3.geom.Rectangle.prototype.translate = function(deltaX, deltaY) {
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
 * Turns the tansformation matrix back into the ome model object
 * @return {Object|null} the ome model transformation
 */
ome.ol3.geom.Rectangle.prototype.getTransform = function() {
    if (!ome.ol3.utils.Misc.isArray(this.transform_)) return null;

    return {'@type': "http://www.openmicroscopy.org/Schemas/OME/2016-06#AffineTransform",
            'A00' : this.transform_[0], 'A10' : this.transform_[1],
            'A01' : this.transform_[2], 'A11' : this.transform_[3],
            'A02' : this.transform_[4], 'A12' : this.transform_[5]
    };
}

/**
 * Returns the coordinates as a flat array (excl. any potential transform)
 * @return {Array.<number>} the coordinates as a flat array
 */
ome.ol3.geom.Rectangle.prototype.getRectangleCoordinates = function() {
    return (
        this.transform_ ? this.initial_coords_ : this.getFlatCoordinates()
    );
}

/**
 * Make a complete copy of the geometry.
 * @return {ome.ol3.geom.Rectangle} Clone.
 */
ome.ol3.geom.Rectangle.prototype.clone = function() {
    var topLeft = this.getUpperLeftCorner();
    return new ome.ol3.geom.Rectangle(
        topLeft[0], topLeft[1], this.getWidth(), this.getHeight(),
        this.getTransform());
};


goog.provide('ome.ol3.geom.Label');


/**
 * @classdesc
 * represents a label in ome regions terminoloy
 * since we need a geometry for text rendered by open layers we'd
 * like to use a rectangle as it is the best fit container for the text
 * which has the advantage that grabbing (selection interaction) the text
 * will work well. to find the rectangle that surrounds the text we have to
 * measure the dimensions of the text given a specific font
 *
 * see also: {@link ome.ol3.utils.Style.measureTextDimensions}
 *
 * @constructor
 * @extends {ome.ol3.geom.Rectangle}
 *
 * @param {number} x the x coordinate of the label location (upper left corner)
 * @param {number} y the y coordinate of the label location (upper left corner)
 * @param {font_dimensions=} font_dimensions the font dimensions or null
 */
ome.ol3.geom.Label = function(x, y, font_dimensions) {
    var fontDims = font_dimensions || null;
    if (fontDims == null || typeof(fontDims['width']) !== 'number' ||
        typeof(fontDims['height']) !== 'number')
        fontDims = {'width' : 10, 'height' : 10};

    // call super
    goog.base(this, x, y, fontDims['width'], fontDims['height']);

    /**
     * the original coordinates as set
     * we remember them since we have a need to alter them in case of non-rotation
     * of the surrounding rectangle
     * @type {Array.<number>}
     * @private
     */
    this.original_coordinates;
    this.setOriginalCoordinates = function() { // update function
        this.original_coordinates = [];
        var tmp = this.getFlatCoordinates();
        for (var c in tmp) this.original_coordinates.push(tmp[c]);
    };
    this.setOriginalCoordinates();
}
goog.inherits(ome.ol3.geom.Label, ome.ol3.geom.Rectangle);

/**
 * Override rectangle's changeRectangle
 *
 * @private
 * @param {number} x the x coordinate of the upper left corner
 * @param {number} y the y coordinate of the upper left corner
 * @param {number} w the width of the rectangle
 * @param {number} h the height of the rectangle
 */
ome.ol3.geom.Label.prototype.changeRectangle = function(x,y,w,h) {
    goog.base(this, 'changeRectangle', x, y,w, h);
    this.setOriginalCoordinates();
}

/**
 * Stores present coordinates as the new orginal ones
 * which is needed after translation for instance
 * @private
 * @param {number} rotation the angle of rotation
 * @param {number} scaling the scaling factor
 */
ome.ol3.geom.Label.prototype.modifyOriginalCoordinates = function(rotation, scaling) {
    if (typeof(rotation) !== 'number') rotation = 0;
    if (typeof(scaling) !== 'number') scaling = 1;

    if (rotation != 0) {
        var rotatedCoords = [];
        // we remember the rotated state, we want it back...
        var tmp = this.getFlatCoordinates();
        for (var c in tmp) rotatedCoords.push(tmp[c]);

        var oldWidth = this.getWidth();
        var oldHeight = this.getHeight();
        // we have to rotate back to get the unrotated rectangle
        var transform = function(coords_old, coords_new, stride) {
            coords_new[0] = coords_old[0]; //x
            coords_new[1] = coords_old[1]; //y
            coords_new[2] = coords_old[0]+oldWidth;
            coords_new[3] = coords_old[1];
            coords_new[4] = coords_old[0]+oldWidth;
            coords_new[5] = coords_old[1]-oldHeight;
            coords_new[6] = coords_old[0];
            coords_new[7] = coords_old[1]-oldHeight;
            coords_new[8] = coords_old[0];
            coords_new[9] = coords_old[1];

            return coords_new;
        }
        this.applyTransform(transform);
    }

    // store the unrotated/unscaled state
    this.setOriginalCoordinates();

    if (rotation != 0) {
        // now revert to the rotated state for viewing
        this.applyTransform(function(coords_old, coords_new, stride) {
            for (var i in rotatedCoords)
                coords_new[i] = rotatedCoords[i];
            return coords_new;
        });
    }
}

/**
 * We control the rotation/scale of the surrounding rectangle with this method
 * @param {number} rotation the angle of rotation
 * @param {Object} dims the dimensions of the text rectangle
 */
 ome.ol3.geom.Label.prototype.adjustCoordinates = function(rotation, dims) {
     if (typeof(rotation) !== 'number') return;

     // reset
    var oldCoords = this.original_coordinates;
    this.applyTransform(function(coords_old, coords_new, stride) {
        for (var i in oldCoords)
            coords_new[i] = oldCoords[i];
        return coords_new;
    });

    var newWidth = this.original_coordinates[2]-this.original_coordinates[0];
    var newHeight =
        Math.abs(this.original_coordinates[5]-this.original_coordinates[3]);
    if (typeof(dims) === 'object' && dims !== null &&
        typeof(dims['width']) === 'number' &&
        typeof(dims['height']) === 'number') {
            var newWidth = dims['width'] > 0 ? dims['width'] : 1;
            var newHeight = dims['height'] > 0 ? dims['height'] : 1;
    }
    this.resize({"width" : newWidth, "height" : newHeight});

    if (rotation !== 0) this.rotate(rotation);
};

/**
 * Rotates the label rectangle
 *
 * @param {number} rotation the angle of rotation
 */
ome.ol3.geom.Label.prototype.rotate = function(rotation) {
    var transform = function(coords_old, coords_new, stride) {
        var cos = Math.cos(rotation);
        var sin = Math.sin(rotation);

        var center = [coords_old[0], coords_old[1]];
        for (var i=2,ii=coords_old.length; i<ii;i+=2) {
            var oldX = coords_old[i];
            var oldY = coords_old[i+1]
            coords_new[i] = cos * (oldX-center[0]) + sin * (oldY-center[1]) + center[0];
            coords_new[i+1] = cos * (oldY-center[1]) - sin * (oldX-center[0]) + center[1];
        }
        return coords_new;
    }
    this.applyTransform(transform);
};

/**
 * Resizes the label rectangle
 *
 * @param {object} dims the dimensions object
 */
ome.ol3.geom.Label.prototype.resize = function(dims) {
    if (typeof(dims) !== 'object' || dims === null ||
        typeof(dims['width']) !== 'number' || typeof(dims['height']) !== 'number')
            return;
    if (dims['width'] < 0) dims['width'] = 1;
    if (dims['height'] < 0) dims['height'] = 1;

    var transform = function(coords_old, coords_new, stride) {
        coords_new[2] = coords_new[0]+dims['width'];
        coords_new[4] = coords_new[0]+dims['width'];
        coords_new[5] = coords_new[1]-dims['height'];
        coords_new[7] = coords_new[1]-dims['height'];

        return coords_new;
    }
    this.applyTransform(transform);
};

/**
 * First translate then store the newly translated coords
 *
 * @private
 */
ome.ol3.geom.Label.prototype.translate = function(deltaX, deltaY) {
    // delegate
    ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);

    this.setOriginalCoordinates();
};

/**
 * Make a complete copy of the geometry.
 * @return {!ome.ol3.geom.Label} Clone.
 */
ome.ol3.geom.Label.prototype.clone = function() {
    var topLeft = this.getUpperLeftCorner();
    return new ome.ol3.geom.Label(
        topLeft[0], topLeft[1],
        { "width" : this.getWidth(),
          "height" : this.getHeight()
     });
};
