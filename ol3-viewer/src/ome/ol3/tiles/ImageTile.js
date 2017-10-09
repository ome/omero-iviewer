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
goog.provide('ome.ol3.tiles.ImageTile');

goog.require('ol.dom')
goog.require('ol.ImageTile')
goog.require('ol.Tile')

/**
 * @classdesc
 * ImageTile is a custom extention of ol.ImageTile in order to allow peforming
 * byte operations on the image data after the tile has been loaded
 *
 *
 * @constructor
 * @extends {ol.ImageTile}
 *
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.TileState} state State.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {ol.TileLoadFunctionType} tileLoadFunction Tile load function.
 * @param {olx.TileOptions=} opt_options Tile options.
 */
ome.ol3.tiles.ImageTile = function(
    tileCoord, state, src, crossOrigin, tileLoadFunction, opt_options) {
    goog.base(
        this, tileCoord, state, src, crossOrigin, tileLoadFunction, opt_options);

    /**
     * @type {object}
     * @private
     */
    this.imageByContext_ = {};
};
goog.inherits(ome.ol3.tiles.ImageTile, ol.ImageTile);

/**
 * A convenience method to draw the tile into the context to then be called
 * within the scope of the post tile load hook for example...
 *
 * @function
 * @private
 * @param {Object} tile the tile as an img object
 * @param {Array.<number>} tileSize the tile size as an array [width, height]
 * @param {boolean=} createContextOnlyForResize renders on canvas only if resize is needed
 * @param {string=} key the uid (for createContextOnlyForResize is true)
 * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} the image drawn on the context.
 */
ome.ol3.tiles.ImageTile.prototype.getRenderedTileAsContext =
    function(tile, tileSize, createContextOnlyForResize, key) {
        if ((typeof(tile) !== 'object') ||
            (typeof(tile['width']) !== 'number') ||
            (typeof(tile['height']) !== 'number')) return tile;

        if (typeof createContextOnlyForResize !== 'boolean')
            createContextOnlyForResize = false;

        var w = tile.width;
        var h = tile.height;
        if (ome.ol3.utils.Misc.isArray(tileSize) && tileSize.length > 1) {
            w = tileSize[0];
            h = tileSize[1];
        }

        // no need to use a canvas if we don't resize
        if (createContextOnlyForResize && w === tile.width && h === tile.height)
            return tile;

        var context = ol.dom.createCanvasContext2D(w,h);
        context.drawImage(tile, 0,0);

        // we'd like to store the resized tile so that we don't have to do it again
        if (createContextOnlyForResize && key)
            this.imageByContext_[key] = context.canvas;

        return context.canvas;
}

/**
 * Get the HTML image element for this tile (may be a Canvas, Image, or Video).
 * @function
 * @param {Object=} opt_context Object.
 * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} Image.
 */
ome.ol3.tiles.ImageTile.prototype.getImage = function(opt_context) {
    // call super.getImage
    var image = goog.base(this, 'getImage', opt_context);
    // we are not loaded yet => good byes
    if (this.state !== ol.TileState.LOADED) return image;

    // do we have the image already (resized or post tile function applied)
    var key = ol.getUid(image);
    if (key in this.imageByContext_)
         return this.imageByContext_[key];

    // do we have a post tile function
    var postTileFunction = this.source.getPostTileLoadFunction();
    var tileSize = this.source.tileGrid.tileSize_;
    if (typeof(postTileFunction) !== 'function') // no => return
        return this.getRenderedTileAsContext(image, tileSize, true, key);

    // post tile function
    image = this.getRenderedTileAsContext(image);
    try {
        var context =  postTileFunction.call(this, image);
        if (context === null) context = image;

        this.imageByContext_[key] = context;

        return context;
    } catch(planb) {
        return image;
    }
};


goog.exportProperty(
    ome.ol3.tiles.ImageTile.prototype,
    'getRenderedTileAsContext',
    ome.ol3.tiles.ImageTile.prototype.getRenderedTileAsContext);
