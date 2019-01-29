
import TileGrid from 'ol/tilegrid/TileGrid.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import {getTopLeft} from 'ol/extent';

import OmeJSON from '../format/OmeJSON';


class OmeVectorTileSource extends VectorTileSource {

    constructor(image_info_, projection) {
        console.log('constructor', image_info_);
        // Load ROIs by tile
        let tileUrlFunction = (tileCoord) => {
            // let zoom = tileCoord[0];
            let x = tileCoord[1];
            let y = -tileCoord[2] - 1;
            var zoom = zoomLevelScaling.length - tileCoord[0] - 1;
            var tile = + zoom  + ',' + tileCoord[1] + ',' + (-tileCoord[2]-1);
            console.log('tileUrlFunction zoom', zoom, 'x', x, 'y', y);
            if (zoom > 0) {
                return
            }
            return `http://localhost:8080/iviewer/shapes_by_region/${ image_info_.id }/?tile=${ tile }`;
        }

        var zoomLevelScaling = null;
        var dims = image_info_['size'];
        if (image_info_['zoomLevelScaling']) {
            var tmp = [];
            for (var r in image_info_['zoomLevelScaling'])
                tmp.push(1 / image_info_['zoomLevelScaling'][r]);
            zoomLevelScaling = tmp.reverse();
        }
        var zoom = zoomLevelScaling ? zoomLevelScaling.length : -1;
        var extent = [0, -dims['height'], dims['width'], 0];
        var tgOpts = {
            tileSize: image_info_['tile_size'] ?
                [image_info_['tile_size'].width,
                image_info_['tile_size'].height] :
                [DEFAULT_TILE_DIMS.width, DEFAULT_TILE_DIMS.height],
            extent: extent,
            origin: getTopLeft(extent),
            resolutions: zoom > 1 ? zoomLevelScaling : [1],
        }
        console.log("TileGrid", tgOpts);
        var tileGrid = new TileGrid(tgOpts);

        let omeFormat = new OmeJSON({
            projection: projection
        })

        super({
            format: omeFormat,
            tileUrlFunction: tileUrlFunction,
            tileGrid: tileGrid,
        })
    }

    getTileGridForProjection(p) {
        return this.tileGrid;
    }
}

export default OmeVectorTileSource;
