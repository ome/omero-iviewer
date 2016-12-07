goog.provide('ome.ol3.source.Image');

goog.require('ol');
goog.require('ol.source.TileImage');
goog.require('ol.Tile');
goog.require('ol.tilegrid.TileGrid');
goog.require('ol.extent');
goog.require('ol.events');
goog.require('ol.events.EventType');

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
 * <li>tile_size (the tile size {width: 256, height: 256}), default: ol.DEFAULT_TILE_SIZE (256)</li>
 * </ul>
 *
 * Note: Properties plane, time and channels have setters as well
 * 			 since they can change at runtime
 *
 * @constructor
 * @extends {ol.source.TileImage}
 *
 * @param {Object.<string, *>=} options all properties needed to create a tiled source
 *
 */
ome.ol3.source.Image = function(options) {
	var opts = options || {};

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
        ome.ol3.utils.Misc.isArray(opts.channels) ?
            [].concat(opts.channels) : [];

    /**
 	 * should split view be used
 	 * @type {boolean}
 	 * @private
 	 */
	this.split_ =
        typeof opts.split === 'boolean' ? opts.split : false;

    /**
 	 * the omero image projection
 	 * @type {string}
 	 * @private
 	 */
	this.image_projection_ = "normal";
    this.setImageProjection(opts.img_proj);

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
     this.resolutions_ =
        ome.ol3.utils.Misc.isArray(opts.resolutions) ? opts.resolutions : [1];

    /**
 	 * are we treated as a tiled source
 	 * @type {boolean}
 	 * @private
 	 */
     this.tiled_ = this.resolutions_.length > 1;

	/**
 	 * the omero server information
 	 * @type {Object}
 	 * @private
 	 */
	this.server_ = opts.server;
    if (this.server_ === null)
        console.error("The given server information is invalid!");

	/**
 	 * the omero server address/ip
 	 * @type {string}
 	 * @private
 	 */
	//this.uri_ = ome.ol3.utils.Net.checkAndSanitizeUri(opts.uri);
    //if (this.uri_ === null) console.error("The server uri is invalid!");
    this.uri_ =
        ome.ol3.utils.Net.checkAndSanitizeUri('/webgateway/' +
            (this.split_ ? 'render_split_channel' : 'render_image_region'));

	/**
 	 * the a function that can be called as a post tile load hook
 	 * @type {function|null}
 	 * @protected
 	 */
	this.postTileLoadFunction_ = null;

	// get rest of parameters and instantiate a tile grid
	var tileSize = opts.tile_size ||
		{ width: ol.DEFAULT_TILE_SIZE, height: ol.DEFAULT_TILE_SIZE };
	var extent = [0, -this.height_, this.width_, 0];
	var tileGrid = new ol.tilegrid.TileGrid({
		tileSize: [tileSize.width, tileSize.height],
	    extent: extent,
	    origin: ol.extent.getTopLeft(extent),
	    resolutions: this.resolutions_
	});

	// a custom tile url function concatinating all image specificiations
	// needed to retrieve the image from the server
	var tileUrlFunction =
		function tileUrlFunction(tileCoord, pixelRatio, projection) {
			if (!tileCoord) return undefined;

			var zoom = this.tileGrid.resolutions_.length - tileCoord[0] - 1;

			var url = this.server_['full'] + "/" + this.uri_['full'] + '/' + this.id_ + '/' +
				this.plane_ + '/' + this.time_ + '/?';

            if (!this.split_) { // only for non split view
    			if (this.tiled_) // for tiles we use &tile
    				url += 'tile=' + zoom + ',' + tileCoord[1] + ',' + (-tileCoord[2]-1);
    			else // for untiled we use &region to support 'tiled' behavior
    					url += 'region=' + (tileCoord[1] * this.tileGrid.tileSize_[0]) + ',' +
    							((-tileCoord[2]-1) * this.tileGrid.tileSize_[1]);
    			url += ',' + this.tileGrid.tileSize_[0] + ',' + this.tileGrid.tileSize_[1];
                url += '&';
            }

			// add channel param
            url += 'c=';
            var channelsLength = this.channels_info_.length;
            for (var c=0; c<channelsLength;c++) {
                var channelInfo = this.channels_info_[c];
                if (c != 0) url += ',';

                // amend url with channel info
                url += (!channelInfo['active'] ? "-" : "") + (c + 1);
                url += "|" + channelInfo['start'] + ":" + channelInfo['end'];
                if (typeof channelInfo['reverse'] === 'boolean')  // reverse int.
                    url += (channelInfo['reverse'] ? "" : "-") + "r";
                url += "$" + channelInfo['color']; // color info
            }
            url += '&m=' + this.image_model_;
            url += '&p=' + (this.split_ ? 'split' : this.image_projection_);
			url += '&q=0.9';

			return url;
		};

	// call super constructor and set proprerties needed
	goog.base(this, {
		crossOrigin: opts.crossOrigin,
		tileClass:  ome.ol3.tiles.ImageTile,
		tileGrid: tileGrid,
		tileUrlFunction: tileUrlFunction,
	});
};
goog.inherits(ome.ol3.source.Image, ol.source.TileImage);

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
ome.ol3.source.Image.prototype.createTile_ = function(z, x, y, pixelRatio, projection, key) {
  var tileCoord = [z, x, y];
  var urlTileCoord = this.getTileCoordForTileUrlFunction(tileCoord, projection);

	var tileUrl = urlTileCoord ?
      this.tileUrlFunction(urlTileCoord, pixelRatio, projection) : undefined;

	var tile = new this.tileClass(
      tileCoord,
      tileUrl !== undefined ? ol.Tile.State.IDLE : ol.Tile.State.EMPTY,
      tileUrl !== undefined ? tileUrl : '',
      this.crossOrigin,
      this.tileLoadFunction);

	tile.key = key;
	tile.source = this;

	ol.events.listen(tile, ol.events.EventType.CHANGE,
			this.handleTileChange, this);

	return tile;
};

ome.ol3.source.Image.prototype.getKey = function() {
    return this.cache_version_;
}

/**
 * Width (x index) getter
 *
 * @return {number} the width (x index)
 */
ome.ol3.source.Image.prototype.getWidth = function() {
	  return this.width_;
}

/**
 * Height (y index) getter
 *
 * @return {number} the height (y index)
 */
ome.ol3.source.Image.prototype.getHeight = function() {
	  return this.height_;
}

/**
 * Plane (z index) getter
 *
 * @return {number} the plane (z index)
 */
ome.ol3.source.Image.prototype.getPlane = function() {
	  return this.plane_;
}

/**
 * Plane (z index) setter
 *
 * @private
 * @param {number} value the plane (z index)
 */
ome.ol3.source.Image.prototype.setPlane = function(value) {
    if (typeof value !== 'number' || value < 0)
       console.error("Image plane must be a non negative integer");
	this.plane_ = value;
}

/**
 * Time (t index) getter
 * @return {number} the time (t index)
 */
ome.ol3.source.Image.prototype.getTime = function() {
	  return this.time_;
}

/**
 * Time (t index) setter
 *
 * @private
 * @param {number} value the time (t index)
 */
ome.ol3.source.Image.prototype.setTime = function(value) {
    if (typeof value !== 'number' || value < 0)
       console.error("Image time must be a non negative integer");
	this.time_ = value;
}

/**
 * Channels (c index) getter
 *
 * @return {Array.<number>} an array of channels (c indices)
 */
ome.ol3.source.Image.prototype.getChannels = function() {
    var activeChannels = [];
    for (var i=0;i<this.channels_info_.length;i++)
        if (this.channels_info_[i].active) activeChannels.push(i);

    return activeChannels;
}

/**
 * Channels (c indices) setter
 *
 * @private
 * @param {Array.<number>} value the channels array (c indices)
 */
ome.ol3.source.Image.prototype.setChannels = function(value) {
	if (!ome.ol3.utils.Misc.isArray(value)) return;
    var max = this.channels_info_.length;
	for (var c in value) {
		if (typeof value[c] !== 'number' ||
            value[c] < 0 || value[c] >= max) continue;
        this.channels_info_[c].active = true;
    }
}

/**
 * Sets the image projection
 * Acceptable values are "normal", "intmax"
 *
 * @param {string} value a string indicating the image projection
 */
ome.ol3.source.Image.prototype.setImageProjection = function(value) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        (value.toLowerCase() !== 'normal' &&
            value.toLowerCase() !== 'split' &&
            value.toLowerCase() !== 'intmax'))
            return;

    this.image_projection_ = value.toLowerCase();
    this.forceRender();
}

/**
 * Sets the image model (color or gray)
 * Acceptable values are "g", "c", "greyscale" or "color"
 *
 * @param {string} value a string indicating the image model
 */
ome.ol3.source.Image.prototype.setImageModel = function(value) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        (value.toLowerCase() !== 'greyscale' &&
            value.toLowerCase() !== 'color' &&
            value.toLowerCase() !== 'g' &&
            value.toLowerCase() !== 'c'))
            return;

    this.image_model_ = value[0];
    this.forceRender();
}

/**
 * Modifies the channel value ranges (start, end, color, active)
 * given an index for the  channel in question
 *
 * @param {Array.<Object>} ranges an array of objects with above mentioned props
 * @param {boolean} rerender flag to affect rerender (defaults to true)
 */
ome.ol3.source.Image.prototype.changeChannelRange = function(ranges, rerender) {
    if (!ome.ol3.utils.Misc.isArray(ranges)) return;

    for (var r in ranges) {
        var range = ranges[r];

        // first sanity checks
        if (typeof range !== 'object' ||
            typeof range['index'] !== 'number' ||
            range['index'] < 0 ||
            range['index'] >= this.channels_info_.length ||
            typeof range['start'] !== 'number' ||
            typeof range['end'] !== 'number') continue;

        var channel_index = range['index'];
        this.channels_info_[channel_index]['start'] = range['start'];
		this.channels_info_[channel_index]['end'] = range['end'];

        // second sanity check for optional color and reverse setting
        // cannot do much more to accomodate lookup table strings
        if (typeof range['color'] === 'string' && range['color'].length !== 0)
            this.channels_info_[channel_index]['color'] = range['color'];
        if (typeof range['reverse'] === 'boolean')
            this.channels_info_[channel_index]['reverse'] =
                range['reverse'];

        // third sanity check for optional act setting
        if (typeof range['active'] === 'boolean')
            this.channels_info_[channel_index]['active'] = range['active'];
    }
    rerender = typeof rerender !== 'boolean' ? true : rerender;
    if (rerender) this.forceRender();
}

/**
 * Captures the image settings
 *
 * @return {object} an object populated with the channel_info, model and projection
 */
ome.ol3.source.Image.prototype.captureImageSettings = function() {
    var ret = {
        'projection' : this.image_projection_,
        'model' : this.image_model_,
        'channels' : [],
        'time' : this.time_,
        'plane' : this.plane_
    };

    // loop over channels and add them
    for (var c in this.channels_info_) {
            var chan = this.channels_info_[c];
            var chanSnap = {
                "active" : chan['active'],
                "color" : chan['color'],
                "min" : chan['min'],
                "max" : chan['max'],
                "start" : chan['start'],
                "end" : chan['end']
            };
            if (typeof chan['reverse'] === 'boolean')
                chanSnap['reverseIntensity'] = chan['reverse'];
            ret['channels'].push(chanSnap);
        }

    return ret;
}

/**
 * Returns the post tile function with signature: function(ol.Tile, string)
 *
 * @return {ol.TileLoadFunctionType|null} the post tile hook
 */
ome.ol3.source.Image.prototype.getPostTileLoadFunction = function() {
	return this.postTileLoadFunction_;
}

/**
 * Sets a post tile load hook which can be used to work on the image data
 * such as the following:
 *
 * <pre>
 * function(image) {
 * 		var context = this.getRenderedTileAsContext(image);
 * 		if (context == null) return null;
 *
 *		var imageData =
 *			context.getImageData(0,0, context.canvas.width, context.canvas.height);
 * 		var data = imageData.data;
 *	 	for (var i = 0, ii = data.length; i < ii; i++) {
 *	 		var avg = (data[i*4] + data[i*4+1] + data[i*4+2]) /3;
 *			data[i*4] = avg;
 *			data[i*4+1] = avg + 30;
 *			data[i*4+2] = avg;
 *		}
 * 		context.putImageData(imageData, 0, 0);
 *		return context.canvas
 *}
 *</pre>
 *
 * @param {ol.TileLoadFunctionType} func the post tile load function
 *	with signature: function(tile) {}
 */
ome.ol3.source.Image.prototype.setPostTileLoadFunction = function(func) {
	if (typeof(func) !== 'function')
		 return;
	this.postTileLoadFunction_ =  func;
	this.forceRender();
}

/**
 * Removes the post tiling function, forcing a rerender of the layers
 */
ome.ol3.source.Image.prototype.clearPostTileLoadFunction = function() {
	this.postTileLoadFunction_ =  null;
	this.forceRender();
}

/**
 * Forces a rerendering of the layers
 *
 * @param {boolean} clearCache empties the tile cache if true
 * @private
 */
ome.ol3.source.Image.prototype.forceRender = function(clearCache) {
    try {
        // if we didn't get a flag we clear the cache for tiled sources only
        if (typeof clearCache !== 'boolean')
            clearCache = this.tiled_;

        if (clearCache) this.tileCache.clear();
        else this.cache_version_++;
        this.changed();
    } catch(canHappen) {}
}

/**
 * Clean up
 */
ome.ol3.source.Image.prototype.disposeInternal = function() {
	if (this.tileCache instanceof ol.structs.LRUCache) this.tileCache.clear();
	this.channels_info_ = [];
};


goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'getWidth',
	ome.ol3.source.Image.prototype.getWidth);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'getHeight',
	ome.ol3.source.Image.prototype.getHeight);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'getPlane',
	ome.ol3.source.Image.prototype.getPlane);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'setPlane',
	ome.ol3.source.Image.prototype.setPlane);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'getTime',
	ome.ol3.source.Image.prototype.getTime);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'setTime',
	ome.ol3.source.Image.prototype.setTime);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'getChannels',
	ome.ol3.source.Image.prototype.getChannels);

goog.exportProperty(
	ome.ol3.source.Image.prototype,
	'setChannels',
	ome.ol3.source.Image.prototype.setChannels);
