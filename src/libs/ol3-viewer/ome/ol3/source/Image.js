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

import TileImage from "ol/source/tileimage";
import EventType from 'ol/events/eventtype'
import TileState from "ol/tilestate";
import LRUCache from "ol/structs/lrucache";
import TileGrid from "ol/tilegrid/tilegrid";
import Events from "ol/events";
import Extent from 'ol/extent';

import {DEFAULT_TILE_DIMS, PROJECTION, RENDER_STATUS, UNTILED_RETRIEVAL_LIMIT} from "../Globals";
import ImageTile from "../tiles/ImageTile";
import * as NetUtils from "../utils/Net";

/**
 * @classdesc
 * Image represents the internal omero image layer source as needed by open layers.
 * It extends a tiled image source and encapsulates a number of settings and customizations.
 *
 * The mandatory properties are:
 * <ul>
 * <li>server (the omero server address/ip)</li>
 * <li>uri (the omero server uri for image requests)</li>
 * <li>image (the image id)</li>
 * <li>width (the image width)</li>
 * <li>height (the image height)</li>
 * </ul>
 *
 * The following properties are optional:
 * <ul>
 * <li>plane (the plane aka z index), default: 0</li>
 * <li>time (the time aka t index), default: 0</li>
 * <li>channels (the channels aka c indices) as an array, default: []</li>
 * <li>resolutions (the resolutions for tiled images), default: [1]</li>
 * <li>tile_size (the tile size {width: 256, height: 256}), default: 512^2</li>
 * </ul>
 *
 * Note: Properties plane, time and channels have setters as well
 *       since they can change at runtime
 *
 * @constructor
 * @extends {TileImage}
 *
 * @param {Object.<string, *>=} options all properties needed to create a tiled source
 *
 */
export default class Image extends TileImage {

    static newInstance(options) {
        let opts = options || {};

        let width = opts.width || -1;
        let height = opts.height || -1;

        let use_tiled_retrieval = opts.tiled || width * height > UNTILED_RETRIEVAL_LIMIT;
        let tile_size = use_tiled_retrieval ?
            opts.tile_size :
            {width: width, height: height};

        let resolutions = Array.isArray(opts.resolutions) ? opts.resolutions : [1];

        // get rest of parameters and instantiate a tile grid
        let extent = [0, -height, width, 0];
        let tileGrid = new TileGrid({
            tileSize: tile_size ?
                [tile_size.width, tile_size.height] :
                [DEFAULT_TILE_DIMS.width, DEFAULT_TILE_DIMS.height],
            extent: extent,
            origin: Extent.getTopLeft(extent),
            resolutions: resolutions
        });

        return new Image({
            crossOrigin: opts.crossOrigin,
            tileClass: ImageTile,
            tileGrid: tileGrid,
        })
    }

    constructor(options) {
        let opts = options || {};

        // call super constructor and set properties needed
        super({
            transition: 0,
            crossOrigin: opts.crossOrigin,
            tileClass: opts.tileClass,
            tileGrid: opts.tileGrid,
        });

        /**
         * the image id used for viewing
         * @type {number}
         * @private
         */
        this.id_ = opts.image || -1;
        if (typeof this.id_ !== 'number' || this.id_ <= 0)
            console.error("Image id must be a strictly positive integer");

        /**
         * an internal cache version which helps us invalidate
         * without clearing so that newer images are rendered 'on top' of olders
         * @type {number}
         * @private
         */
        this.cache_version_ = 0;

        /**
         * the image width
         * @type {number}
         * @private
         */
        this.width_ = opts.width || -1;
        if (typeof this.width_ !== 'number' || this.width_ <= 0)
            console.error("Image width must be a strictly positive integer");

        /**
         * the image height
         * @type {number}
         * @private
         */
        this.height_ = opts.height || -1;
        if (typeof this.height_ !== 'number' || this.height_ <= 0)
            console.error("Image height must be a strictly positive integer");

        /**
         * the plane (z) index
         * @type {number}
         * @private
         */
        this.plane_ = opts.plane || 0;
        if (typeof this.plane_ !== 'number' || this.plane_ < 0)
            console.error("Image plane must be a non negative integer");

        /**
         * the time (t) index
         * @type {number}
         * @private
         */
        this.time_ = opts.time || 0;
        if (typeof this.time_ !== 'number' || this.time_ < 0)
            console.error("Image time must be a non negative integer");

        /**
         * the channels info
         * @type {Array.<Object>}
         * @private
         */
        this.channels_info_ =
            Array.isArray(
                opts.channels) ? [].concat(opts.channels) : [];

        /**
         * Make an initial copy of the settings as current saved settings
         */
        this.updateSavedSettings();

        /**
         * the omero image projection - optional params, e.g. start/end
         * @type {Object}
         * @private
         */
        this.projection_opts_ = {
            'start': opts.img_proj.start,
            'end': opts.img_proj.end
        };

        /**
         * the omero image projection
         * @type {string}
         * @private
         */
        this.image_projection_ = opts.img_proj.projection;
        this.setImageProjection(this.image_projection_, this.projection_opts_);

        /**
         * the omero image model (color: 'c' or greyscale: 'g')
         * @type {string}
         * @private
         */
        this.image_model_ = "g";
        this.setImageModel(opts.img_model);

        /**
         * the resolutions array
         * @type {Array.<number>}
         * @private
         */
        this.resolutions_ = Array.isArray(opts.resolutions) ? opts.resolutions : [1];

        /**
         * are we treated as a tiled source
         * @type {boolean}
         * @private
         */
        this.tiled_ = opts.tiled;

        /**
         * should we use tiled retrieval methods?
         * for now use them only for truly tiled/pyramidal sources
         * and images that exceed {@link UNTILED_RETRIEVAL_LIMIT}
         * @type {boolean}
         * @private
         */
        this.use_tiled_retrieval_ = this.tiled_ ||
            this.width_ * this.height_ > UNTILED_RETRIEVAL_LIMIT;

        /**
         * for untiled retrieval the tile size equals the entire image extent
         * for tiled we use the default tile size
         * @type {Object}
         * @private
         */
        this.tile_size_ =
            this.use_tiled_retrieval_ ? opts.tile_size :
                {width: this.width_, height: this.height_};

        /**
         * the omero server information
         * @type {Object}
         * @private
         */
        this.server_ = opts.server;
        if (this.server_ === null)
            console.error("The given server information is invalid!");

        /**
         * the uri for image requests
         * @type {string}
         * @private
         */
        this.uri_ = NetUtils.checkAndSanitizeUri(opts.uri + '/' + (this.use_tiled_retrieval_ ? 'render_image_region' : 'render_image'));

        /**
         * the a function that can be called as a post tile load hook
         * @type {function|null}
         * @protected
         */
        this.postTileLoadFunction_ = null;

        /**
         * the present render status
         * @type {number}
         * @private
         */
        this.render_status_ = RENDER_STATUS.NOT_WATCHED;

        /**
         * the present render watch handle
         * @type {number}
         * @private
         */
        this.render_watch_ = null;

        /**
         * our custom tile url function
         * @type {function}
         * @private
         */
        this.tileUrlFunction_ = (tileCoord, pixelRatio, projection) => {
            if (!tileCoord) return undefined;

            let url =
                this.server_['full'] + "/" + this.uri_['full'] + '/' +
                this.id_ + '/' + this.plane_ + '/' + this.time_ + '/?';

            if (this.tiled_ || this.use_tiled_retrieval_) {
                let zoom = this.tiled_ ?
                    this.tileGrid.resolutions_.length - tileCoord[0] - 1 : 0;
                if (this.tiled_) {
                    url += 'tile=' + zoom + ',' +
                        tileCoord[1] + ',' + (-tileCoord[2] - 1);
                } else {
                    // for non pyramid images that are retrieved tiled
                    // force tile size with 'region' to be compatible
                    // with older versions of omero server
                    url += 'region=' +
                        (tileCoord[1] * this.tileGrid.tileSize_[0]) + ',' +
                        ((-tileCoord[2] - 1) * this.tileGrid.tileSize_[1]);
                }
                url += ',' + this.tileGrid.tileSize_[0] + ',' +
                    this.tileGrid.tileSize_[1] + '&';
            }

            // maps parameter (incl. inverted)
            let maps = [];
            // add channel param
            url += 'c=';
            let channelsLength = this.channels_info_.length;
            for (let c = 0; c < channelsLength; c++) {
                let channelInfo = this.channels_info_[c];
                if (c != 0) url += ',';

                // amend url with channel info
                url += (!channelInfo['active'] ? "-" : "") + (c + 1);
                url += "|" + channelInfo['start'] + ":" + channelInfo['end'];
                url += "$" + channelInfo['color']; // color info

                let m = {};
                if (channelInfo['active']) {
                    m["inverted"] = {
                        "enabled":
                            typeof channelInfo['inverted'] === 'boolean' &&
                            channelInfo['inverted']
                    };

                    // Only need to include family if different from default
                    let family = channelInfo['family'];
                    let family_not_default = (family !== "linear" ||
                        (family === "linear" && this.saved_channels_info_[c]["family"] !== "linear"));
                    if (typeof family === 'string' &&
                        family !== "" &&
                        family_not_default &&
                        typeof channelInfo['coefficient'] === 'number' &&
                        !isNaN(channelInfo['coefficient'])) {
                        m["quantization"] = {
                            "family": family,
                        };
                        // Only need coefficient if family is not 'linear' or 'logarithmic'
                        if (family !== 'linear' && family !== 'logarithmic') {
                            m["quantization"]["coefficient"] = channelInfo['coefficient'];
                        }
                    }
                }
                maps.push(m);
            }
            url += "&maps=" + JSON.stringify(maps);
            url += '&m=' + this.image_model_;
            url += '&p=' + this.image_projection_;
            if (this.image_projection_ === PROJECTION['INTMAX'] &&
                typeof this.projection_opts_ === 'object' &&
                this.projection_opts_ !== null) {
                url += '|' + this.projection_opts_.start +
                    ':' + this.projection_opts_.end;
            }
            url += '&q=0.9';

            return url;
        };

        // Set to base class
        this.setTileUrlFunction(this.tileUrlFunction_);
    }

    /**
     * overridden method from open layers
     *
     * @param {number} z Tile coordinate z (zoom).
     * @param {number} x Tile coordinate x.
     * @param {number} y Tile coordinate y.
     * @param {number} pixelRatio Pixel ratio.
     * @param {ol.proj.Projection} projection Projection.
     * @param {string} key The key set on the tile.
     *
     * @return {ol.Tile} Tile.
     * @private
     */
    createTile_(z, x, y, pixelRatio, projection, key) {
        let tileCoord = [z, x, y];
        let urlTileCoord =
            this.getTileCoordForTileUrlFunction(tileCoord, projection);

        let tileUrl =
            urlTileCoord ?
                this.tileUrlFunction(urlTileCoord, pixelRatio, projection) :
                undefined;

        let tile =
            new this.tileClass(
                tileCoord,
                tileUrl !== undefined ?
                    TileState.IDLE : TileState.EMPTY,
                tileUrl !== undefined ? tileUrl : '',
                this.crossOrigin, this.tileLoadFunction, this.tileOptions);

        tile.key = key;
        tile.source = this;

        Events.listen(
            tile, EventType.CHANGE, this.handleTileChange, this);

        return tile;
    };

    /**
     * Overridden getKey
     *
     * @return {number} the present cache version
     */
    getKey() {
        return this.cache_version_;
    }

    /**
     * Width (x index) getter
     *
     * @return {number} the width (x index)
     */
    getWidth() {
        return this.width_;
    }

    /**
     * Height (y index) getter
     *
     * @return {number} the height (y index)
     */
    getHeight() {
        return this.height_;
    }

    /**
     * Plane (z index) getter
     *
     * @return {number} the plane (z index)
     */
    getPlane() {
        return this.plane_;
    }

    /**
     * Plane (z index) setter
     *
     * @private
     * @param {number} value the plane (z index)
     */
    setPlane(value) {
        if (typeof value !== 'number' || value < 0)
            console.error("Image plane must be a non negative integer");
        this.plane_ = value;
    }

    /**
     * Time (t index) getter
     * @return {number} the time (t index)
     */
    getTime() {
        return this.time_;
    }

    /**
     * Time (t index) setter
     *
     * @private
     * @param {number} value the time (t index)
     */
    setTime(value) {
        if (typeof value !== 'number' || value < 0)
            console.error("Image time must be a non negative integer");
        this.time_ = value;
    }

    /**
     * Channels (c index) getter
     *
     * @return {Array.<number>} an array of channels (c indices)
     */
    getChannels() {
        let activeChannels = [];
        for (let i = 0; i < this.channels_info_.length; i++)
            if (this.channels_info_[i].active) activeChannels.push(i);

        return activeChannels;
    }

    /**
     * Channels (c indices) setter
     *
     * @private
     * @param {Array.<number>} value the channels array (c indices)
     */
    setChannels(value) {
        if (!Array.isArray(value)) return;

        let max = this.channels_info_.length;
        for (let c in value) {
            if (typeof value[c] !== 'number' || value[c] < 0 || value[c] >= max)
                continue;
            this.channels_info_[c].active = true;
        }
    }

    /**
     * Set the saved_channels_info to the current channels_info_
     * We use the difference between saved and current settings to
     * build the maps query string when rendering image.
     */
    updateSavedSettings() {
        this.saved_channels_info_ = this.channels_info_.map(c => Object.assign({}, c));
    }

    /**
     * Sets the image projection
     * Acceptable values are "normal", "intmax"
     *
     * @param {string} value a string indicating the image projection
     * @param {Object=} opts additional options, e.g. intmax projection start/end
     */
    setImageProjection(value, opts) {
        if (typeof value !== 'string' || value.length === 0) return;

        try {
            this.image_projection_ = PROJECTION[value.toUpperCase()];
            if (typeof opts === 'object' && typeof opts['start'] === 'number' &&
                opts['start'] >= 0 && typeof opts['end'] === 'number' &&
                opts['end'] >= 0 && opts['end'] >= opts['start']) {
                this.projection_opts_ =
                    {start: opts['start'], end: opts['end']};
            } else this.projection_opts_ = null;
        } catch (not_found) {
        }
    }

    /**
     * Sets the image model (color or gray)
     * Acceptable values are "g", "c", "greyscale" or "color"
     *
     * @param {string} value a string indicating the image model
     */
    setImageModel(value) {
        if (typeof value !== 'string' || value.length === 0 ||
            (value.toLowerCase() !== 'greyscale' &&
                value.toLowerCase() !== 'color' &&
                value.toLowerCase() !== 'g' &&
                value.toLowerCase() !== 'c')) return;

        this.image_model_ = value[0];
    }

    /**
     * Modifies the channel value ranges (start, end, color, active)
     * given an index for the  channel in question
     *
     * @param {Array.<Object>} ranges an array of objects with above mentioned props
     * @return {boolean} if true this indicates a rerender is needed, false otherwise
     */
    changeChannelRange(ranges) {
        if (!Array.isArray(ranges)) return false;

        // we don't rerender if there haven't been changes
        // or changes don't necessitate rerenders such as:
        // - any change on a disabled channel
        // - only color change in grayscale mode
        let needsRerender = false;
        let isGrayscale = this.image_model_.toLowerCase() === 'g';

        for (let r in ranges) {
            let range = ranges[r];

            // first sanity checks
            if (typeof range !== 'object' ||
                typeof range['index'] !== 'number' ||
                range['index'] < 0 ||
                range['index'] >= this.channels_info_.length ||
                typeof range['start'] !== 'number' ||
                typeof range['end'] !== 'number') continue;

            let channel_index = range['index'];

            // active flag changes
            if (typeof range['active'] === 'boolean' &&
                this.channels_info_[channel_index]['active'] !== range['active']) {
                this.channels_info_[channel_index]['active'] = range['active'];
                needsRerender = true;
            }
            let active = this.channels_info_[channel_index]['active'];
            // channel start/end changes
            if (this.channels_info_[channel_index]['start'] !== range['start'] ||
                this.channels_info_[channel_index]['end'] !== range['end']) {
                this.channels_info_[channel_index]['start'] = range['start'];
                this.channels_info_[channel_index]['end'] = range['end'];
                if (active) needsRerender = true;
            }
            // color changes
            if (typeof range['color'] === 'string' && range['color'].length !== 0 &&
                this.channels_info_[channel_index]['color'] !== range['color']) {
                this.channels_info_[channel_index]['color'] = range['color'];
                if (active && !isGrayscale) needsRerender = true;
            }
            // inverted change
            if (typeof range['inverted'] === 'boolean' &&
                this.channels_info_[channel_index]['inverted'] !== range['inverted']) {
                this.channels_info_[channel_index]['inverted'] = range['inverted'];
                if (active) needsRerender = true;
            }
            // quantization maps
            if (typeof range['family'] === 'string' && range['family'] !== '' &&
                this.channels_info_[channel_index]['family'] !== range['family']) {
                this.channels_info_[channel_index]['family'] = range['family'];
                if (active) needsRerender = true;
            }
            if (typeof range['coefficient'] === 'number' && !isNaN(range['coefficient']) &&
                this.channels_info_[channel_index]['coefficient'] !== range['coefficient']) {
                this.channels_info_[channel_index]['coefficient'] = range['coefficient'];
                if (active) needsRerender = true;
            }
        }

        return needsRerender;
    }

    /**
     * Captures the image settings
     *
     * @return {object} an object populated with the channel_info, model and projection
     */
    captureImageSettings() {
        let ret = {
            'projection':
                this.image_projection_ === PROJECTION['INTMAX'] ?
                    (this.image_projection_ + '|' + this.projection_opts_.start +
                        ':' + this.projection_opts_.end) : this.image_projection_,
            'model': this.image_model_,
            'channels': [],
            'time': this.time_,
            'plane': this.plane_
        };

        // loop over channels and add them
        for (let c in this.channels_info_) {
            let chan = this.channels_info_[c];
            let chanSnap = {
                "active": chan['active'],
                "color": chan['color'],
                "window": {
                    "min": chan['min'],
                    "max": chan['max'],
                    "start": chan['start'],
                    "end": chan['end']
                }
            };
            if (typeof chan['inverted'] === 'boolean')
                chanSnap['inverted'] = chan['inverted'];
            if (typeof chan['family'] === 'string' && chan['family'] !== "" &&
                typeof chan['coefficient'] === 'number' &&
                !isNaN(chan['coefficient'])) {
                chanSnap["family"] = chan['family'];
                chanSnap["coefficient"] = chan['coefficient'];
            }
            ;

            ret['channels'].push(chanSnap);
        }

        return ret;
    }

    /**
     * Returns the post tile function with signature: function(ol.Tile, string)
     *
     * @return {ol.TileLoadFunctionType|null} the post tile hook
     */
    getPostTileLoadFunction() {
        return this.postTileLoadFunction_;
    }

    /**
     * Sets a post tile load hook which can be used to work on the image data
     * such as the following:
     *
     * <pre>
     * function(image) {
     *         let context = this.getRenderedTileAsContext(image);
     *         if (context == null) return null;
     *
     *        let imageData =
     *            context.getImageData(0,0, context.canvas.width, context.canvas.height);
     *         let data = imageData.data;
     *         for (let i = 0, ii = data.length; i < ii; i++) {
     *             let avg = (data[i*4] + data[i*4+1] + data[i*4+2]) /3;
     *            data[i*4] = avg;
     *            data[i*4+1] = avg + 30;
     *            data[i*4+2] = avg;
     *        }
     *         context.putImageData(imageData, 0, 0);
     *        return context.canvas
     *}
     *</pre>
     *
     * @param {ol.TileLoadFunctionType} func the post tile load function
     *    with signature: function(tile) {}
     */
    setPostTileLoadFunction(func) {
        if (typeof(func) !== 'function') return;
        this.postTileLoadFunction_ = func;
    }

    /**
     * Removes the post tiling function
     */
    clearPostTileLoadFunction() {
        this.postTileLoadFunction_ = null;
    }

    /**
     * Watches the render status by setting up a post render event once
     * and registering the appropriate tile load listeners
     *
     * @param {PluggableMap} viewer a map reference for postrender
     * @param {boolean} stopOnTileLoadError we don't continue watching the load
     *                      progress if we experience tile load errors,
     *                      defaults to false
     * @return {boolean} true if the watch has been started, false otherwise
     */
    watchRenderStatus(viewer, stopOnTileLoadError) {
        if (this.render_watch_ !== null) return false;

        if (typeof stopOnTileLoadError !== 'boolean')
            stopOnTileLoadError = false;

        let tilesToBeLoaded = 0;
        let tilesLoaded = 0;

        this.render_watch_ = viewer.once("postrender", (event) => {
            // register tile listeners to keep track of tile load status
            let incToBeLoaded = (event) => {
                ++tilesToBeLoaded;
            };
            let checkLoaded = (event) => {
                ++tilesLoaded;
                // we are all rendered
                if (tilesLoaded >= tilesToBeLoaded) {
                    this.un("tileloadstart", incToBeLoaded);
                    this.un("tileloadend", checkLoaded, this);
                    this.un("tileloaderror", checkLoaded, this);
                    this.render_status_ = RENDER_STATUS.RENDERED;
                    this.render_watch_ = null;
                }
            };
            let checkError =
                stopOnTileLoadError ?
                    (event) => {
                        ++tilesLoaded;
                        this.un("tileloadstart", incToBeLoaded);
                        this.un("tileloadend", checkLoaded, this);
                        this.un("tileloaderror", checkError, this);
                        this.render_status_ = RENDER_STATUS.ERROR;
                        this.render_watch_ = null;
                    } : checkLoaded;

            this.on("tileloadstart", incToBeLoaded);
            this.on("tileloadend", checkLoaded, this);
            this.on("tileloaderror", checkError, this);

            // check if we have tiles loading, otherwise they are in the cache
            // already. to that end we give a delay of 50 millis
            this.render_status_ = RENDER_STATUS.IN_PROGRESS;
            setTimeout(() => {
                if (tilesToBeLoaded === 0) {
                    this.un("tileloadstart", incToBeLoaded);
                    this.un("tileloadend", checkLoaded, this);
                    this.un("tileloaderror", checkError, this);
                    this.render_status_ = RENDER_STATUS.NOT_WATCHED;
                    this.render_watch_ = null;
                }
            }, 50);
        }, this);
        return true;
    }

    /**
     * Returns the render status, resetting to not watched
     *
     * @params {boolean} reset if true we reset to NOT_WATCHED
     * @return {RENDER_STATUS} the render status
     */
    getRenderStatus(reset) {
        if (typeof reset !== 'boolean') reset = false;

        let ret = this.render_status_;
        if (reset) this.render_status_ = RENDER_STATUS.NOT_WATCHED;

        return ret;
    }


    /**
     * Clean up
     */
    disposeInternal() {
        if (this.tileCache instanceof LRUCache) this.tileCache.clear();
        this.channels_info_ = [];
    };

}


// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'getWidth',
//     getWidth);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'getHeight',
//     getHeight);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'getPlane',
//     getPlane);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'setPlane',
//     setPlane);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'getTime',
//     getTime);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'setTime',
//     setTime);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'getChannels',
//     getChannels);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'setChannels',
//     setChannels);
//
// goog.exportProperty(
//     ome.ol3.source.Image.prototype,
//     'updateSavedSettings',
//     updateSavedSettings);
