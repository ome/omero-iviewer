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