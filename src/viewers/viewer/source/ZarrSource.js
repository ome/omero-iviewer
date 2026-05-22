

import TileImage from 'ol/source/TileImage';
import TileGrid from 'ol/tilegrid/TileGrid';
import {getTopLeft} from 'ol/extent';

const DEFAULT_TILE_SIZE = {width: 256, height: 256};

export default class ZarrSource extends TileImage {
  constructor(options = {}) {
    const width = options.width;
    const height = options.height;

    if (typeof width !== 'number' || typeof height !== 'number') {
      throw new Error('ZarrSource requires numeric width and height options.');
    }

    const tileSizeOption = options.tile_size || DEFAULT_TILE_SIZE;
    const tileSize = [
      tileSizeOption.width || DEFAULT_TILE_SIZE.width,
      tileSizeOption.height || DEFAULT_TILE_SIZE.height
    ];

    const resolutions =
      Array.isArray(options.resolutions) && options.resolutions.length > 0 ?
        options.resolutions : [1];

    const extent = [0, -height, width, 0];
    const tileGrid = new TileGrid({
      tileSize,
      extent,
      origin: getTopLeft(extent),
      resolutions
    });

    // OpenLayers only invokes tileLoadFunction when the source has a tile URL.
    const tileUrlFunction =
      typeof options.tileUrlFunction === 'function' ?
        options.tileUrlFunction :
        (tileCoord) => {
          console.log('Generating tile URL for tileCoord:', tileCoord);
          if (!tileCoord || !options.uri || !options.image) return undefined;

          const z = tileCoord[0];
          const x = tileCoord[1];
          const y = -tileCoord[2] - 1;
          return `${options.uri}/zarr_tile/${options.image}/${z}/${x}/${y}/`;
        };

    super({
      transition: 0,
      crossOrigin: options.crossOrigin || 'anonymous',
      tileGrid,
      tileUrlFunction,
      tileLoadFunction: options.tileLoadFunction || ZarrSource.tileLoadFunction
    });

    this.options_ = options;
  }

  static tileLoadFunction(tile, src) {
    console.log('Loading tile from URL:', src);
    
    const image = tile.getImage();
    image.src = src;
  }
}

