

import TileImage from 'ol/source/TileImage';
import TileGrid from 'ol/tilegrid/TileGrid';
import {getTopLeft} from 'ol/extent';

import * as omezarr from 'ome-zarr.js';

const DEFAULT_TILE_SIZE = {width: 256, height: 256};
const TRANSPARENT = [0, 0, 0, 0]; // RGBA for transparent

function colorHexToRgba(hexColor, alpha = 255) {
  // Remove the leading '#' if present
  hexColor = hexColor.replace(/^#/, '');
  // Parse the hex color into RGB components
  const bigint = parseInt(hexColor, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, alpha];
}

function createRgbDataUrl(rbgData, dataWidth, dataHeight, tileWidth, tileHeight) {
  // TEMP make any black pixel into 0 transparency
  for (let i = 0; i < rbgData.length; i += 4) {
    if (rbgData[i] === 0 && rbgData[i + 1] === 0 && rbgData[i + 2] === 0) {
      rbgData[i + 3] = 0; // Set alpha to 0 for black pixels
    }
  }
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
    const initialColor = options.color || "#00ffff";
    const initialZIndex = options.zIndex;
    const initialTIndex = options.tIndex;
    const channelIndex = options.channelIndex || 0;

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
          const resolution = tileCoord[0];
          const x = tileCoord[1];
          const y = -tileCoord[2] - 1;
          return `${resolution}/${x}/${y}`;
        };

    const tileLoadFunction = async (tile, src) => {

      let [resolution, x, y] = src.split('/').map(Number);
      let slices = {"x": [x * tileSize[0], (x + 1) * tileSize[0]], "y": [y * tileSize[1], (y + 1) * tileSize[1]]};
      // Map OL z level to the nearest Zarr dataset index.
      let datasetIndex = scales.length - 1 - resolution;

      // We assume we are rendering Labels here!
      if (!this.ngffImg) {
        this.ngffImg = await omezarr.LabelsImage.load(source, {datasetIndex});
        // handle label image with multiple channels - turn on only 1
        for (let c = 0; c < this.ngffImg.omero.channels.length; c++) {
          this.ngffImg.setChannelActive(c, c === channelIndex);
        }
      }

      // set Z and T index
      if (this.zIndex !== undefined || initialZIndex !== undefined) {
        this.ngffImg.setZIndex(this.zIndex !== undefined ? this.zIndex : initialZIndex);
      }
      if (this.tIndex !== undefined || initialTIndex !== undefined) {
        this.ngffImg.setTIndex(this.tIndex !== undefined ? this.tIndex : initialTIndex);
      }

      // We either render with a colorMap or LUT
      // Just set ONE of them, and clear the other...
      if (this.colorMap) {
        this.ngffImg.setChannelColorMap(channelIndex, this.colorMap);
        this.ngffImg.setChannelLut(channelIndex, undefined);
      } else {
        this.ngffImg.setChannelColorMap(channelIndex, undefined);
        // we use LUT for both following options...
        if (this.autoColor) {
          // Only '0' is transparent, GLASBEY used for others, wrapping around if more labels than colors in the LUT
          this.ngffImg.setChannelLut(channelIndex, [TRANSPARENT, ...omezarr.luts.GLASBEY]);
        } else {
          // All labels are same color, background '0' is transparent
          let color =  colorHexToRgba(this.color || initialColor);
          this.ngffImg.setChannelLut(channelIndex, [TRANSPARENT, color]);
        }
      }

      let result = await this.ngffImg.renderRgba({arrayPathOrIndex: datasetIndex, slices});
      let rgba = result.data;
      let width = result.width;
      let height = result.height;
      let datasrc = createRgbDataUrl(rgba, width, height, tileSize[0], tileSize[1]);
      const image = tile.getImage();
      image.src = datasrc;
    };

    super({
      transition: 0,
      crossOrigin: options.crossOrigin || 'anonymous',
      tileGrid,
      tileUrlFunction,
      tileLoadFunction: options.tileLoadFunction || tileLoadFunction
    });

    this.options_ = options;
  }

  setDimensionIndex(key, values) {
    // NB: we don't support Z-projection here, just take the first value of the array...
    if (key === 'z') {
      this.zIndex = values[0];
    } else if (key === 't') {
      this.tIndex = values[0];
    }
    // trigger reload of tiles to apply new dimension index
    this.refresh();
  }

  setRdef(zarrSource) {
    this.color = zarrSource.color;
    this.autoColor = zarrSource.autoColor;
    this.colorMap = zarrSource.colorMap;
    // trigger reload of tiles to apply new RDEF
    this.refresh();
  }
}

