

import TileImage from 'ol/source/TileImage';
import TileGrid from 'ol/tilegrid/TileGrid';
import {getTopLeft} from 'ol/extent';

import * as omezarr from 'ome-zarr.js';

const DEFAULT_TILE_SIZE = {width: 256, height: 256};

function createRgbDataUrl(rbgData, dataWidth, dataHeight, tileWidth, tileHeight) {
  // paste rgbData onto a canvas to match the tile size
  let h = rbgData.length / (dataWidth * 4);
  const canvas = document.createElement("canvas");
  canvas.width = tileWidth;
  canvas.height = tileHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(rbgData, dataWidth, dataHeight), 0, 0);
  return canvas.toDataURL("image/png");
};

export default class ZarrSource extends TileImage {
  constructor(options = {}) {

    // zarr url
    const source = options.source;

    // scales is list of scale-shape for each resolution
    // e.g. [[1, 0.5, 0.36, 0.36], [1, 0.5, 0.72, 0.72], ...]
    const scales = options.scales;
    const width = options.width;
    const height = options.height;
    const chunks = options.chunks;

    if (typeof width !== 'number' || typeof height !== 'number') {
      throw new Error('ZarrSource requires numeric width and height options.');
    }

    const tileSizeOption = options.tile_size || DEFAULT_TILE_SIZE;
    const tileSize = [
      tileSizeOption.width || DEFAULT_TILE_SIZE.width,
      tileSizeOption.height || DEFAULT_TILE_SIZE.height
    ];

    // e.g. [16, 8, 4, 2, 1]
    let resolutions = scales.map(shape => shape[shape.length - 1] / scales[0][scales[0].length - 1]);
    resolutions = resolutions.reverse();
    console.log("RESOLUTIONS:", resolutions);
    console.log("EXTENT:", [0, -height, width, 0]);


    const extent = [0, -height, width, 0];
    const tileGrid = new TileGrid({
      tileSize,
      // or tileSizes: [[256, 256], [128, 128], ...] if tile size varies by zoom level
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

          const z = tileCoord[0];
          const x = tileCoord[1];
          const y = -tileCoord[2] - 1;
          return `${z}/${x}/${y}`;
        };

    const tileLoadFunction = (tile, src) => {
      console.log('Loading tile from URL:', src, "tile width", tileSizeOption.width, "tile height", tileSizeOption.height);

      let [zm, x, y] = src.split('/').map(Number);
      console.log("Parsed tile coordinates:", {zm, x, y});
      let slices = {"x": [x * tileSize[0], (x + 1) * tileSize[0]], "y": [y * tileSize[1], (y + 1) * tileSize[1]]};

      // Map OL z level to the nearest Zarr dataset index.
      let datasetIndex = scales.length - 1 - zm;
      console.log("DatasetIndex:", datasetIndex, "Slices:", slices);

      omezarr.NgffImage.load(source, {datasetIndex}).then(ngffImg => {
        
        ngffImg.renderRgba({arrayPathOrIndex: datasetIndex, slices}).then(result => {
          let rgba = result.data;
          let width = result.width;
          let height = result.height;
          let src = createRgbDataUrl(rgba, width, height, tileSize[0], tileSize[1]);
          const image = tile.getImage();
          console.log("Tile image element:", image);
          image.src = src;
        });
      });
    }

    super({
      transition: 0,
      crossOrigin: options.crossOrigin || 'anonymous',
      tileGrid,
      tileUrlFunction,
      tileLoadFunction: options.tileLoadFunction || tileLoadFunction
    });

    this.options_ = options;
  }
}

