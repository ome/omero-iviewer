//
// Copyright (C) 2024 University of Dundee & Open Microscopy Environment.
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

import {featureToJsonObject} from '../viewers/viewer/utils/Conversion';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

function colorIntToHex(signed_integer) {
    if (typeof signed_integer !== 'number') return null;
    if (signed_integer < 0) signed_integer = signed_integer >>> 0;
    var intAsHex = signed_integer.toString(16);
    // pad with zeros to have 8 digits (rgba), slice to 6 (rgb)
    intAsHex = ("00000000" + intAsHex).slice(-8).slice(0, 6);
    return "#" + intAsHex;
}

function featureToFigureShape(feature) {
    let ft = featureToJsonObject(feature);
    let shapeType = ft['@type'].split('#')[1];
    let shapeJson;
    // {"type":"Ellipse","x":111.24363636363661,"y":178.26909090909086,"radiusX":144.0632573639581,"radiusY":72.03162868197904,"rotation":64.34564318455512,"strokeWidth":1,"strokeColor":"#FFFFFF","id":-4191737437767269}
    if (shapeType == "Ellipse") {
        shapeJson = {
            x: ft.X,
            y: ft.Y,
            radiusX: ft.RadiusX,
            radiusY: ft.RadiusY,
            rotation: 0
        }
    } else if (shapeType == "Polygon" || shapeType == "Polyline") {
        // "type":"Polygon","points":"188.0795898437498,182.61894531249982 188.0795898437498,182.61894531249982 186.3558
        shapeJson = {
            points: ft.Points
        }
    } else if (shapeType == "Rectangle") {
        // {"type":"Rectangle","x":119.15636363636364,"y":143.36,"width":193.62909090909093,"height":82.85090909090908,"strokeWidth":1,"strokeColor":"#FFFFFF","id":-967897903885322},
        shapeJson = {
            x: ft.X,
            y: ft.Y,
            width: ft.Width,
            height: ft.Height
        }
    } else if (shapeType == "Line") {
        // {"type":"Line","x1":226.2109090909091,"x2":256,"y1":102.4,"y2":331.40363636363634,"strokeWidth":1,"strokeColor":"#FFFFFF","id":-9286789994829994},{"type":"Arrow","x1":302.54545454545456,"x2":227.1418181818182,"y1":105.19272727272727,"y2":280.20363636363635,"strokeWidth":1,"strokeColor":"#FFFFFF","id":-3936136447472953}],
        if (ft.MarkerEnd == "Arrow") {
            shapeType = "Arrow"
        }
        shapeJson = {
            x1: ft.X1,
            y1: ft.Y1,
            x2: ft.X2,
            y2: ft.Y2
        }
    } else if (shapeType == "Point") {
        // 'Point' isn't supported by Figure, but we can use an Ellipse to appear the same
        shapeType = "Point";
        shapeJson = {
            x: ft.X,
            y: ft.Y
        }
    }
    
    if (shapeJson) {
        shapeJson.strokeWidth = ft.StrokeWidth ? ft.StrokeWidth.Value: undefined;
        shapeJson.strokeColor = colorIntToHex(ft.StrokeColor);
        shapeJson.type = shapeType;
    } else {
        console.log("Feature not converted!", ft);
    }

    return shapeJson;
}

export function exportViewersAsPanelsJson() {
    // We need zoom/pan info from each ol3-viewer, but there is no list of these components
    // since they are created in the html template to wrap each image_config 
    // The approach used here is from
    // https://discourse.aurelia.io/t/getting-component-state-from-child-class/5380/3
    
    const viewers = document.querySelectorAll("ol3-viewer");
    let panels = [];
    viewers.forEach((component) => {
        let viewModel = component.au["ol3-viewer"].viewModel;
        let view = viewModel.viewer.viewer_.getView();
        let image_config = viewModel.image_config;
        let image_info = image_config.image_info;
        let params = viewModel.viewer.getViewParameters();
        let rotationDegrees = params.rotation * 180 / Math.PI;
        if (rotationDegrees < 0) {
            rotationDegrees += 360;
        }
        rotationDegrees = rotationDegrees % 360;

        // Figure "100%" zoom means image fits in viewport
        // viewer_ is the OlMap.
        let viewportWidth = viewModel.viewer.viewer_.getViewport().offsetWidth;
        let viewportHeight = viewModel.viewer.viewer_.getViewport().offsetHeight;
        let zoomSizeX = image_info.dimensions.max_x / view.getResolution();
        let zoomSizeY = image_info.dimensions.max_y / view.getResolution();
        var xZoom = zoomSizeX / viewportWidth;
        var yZoom = zoomSizeY / viewportHeight;
        var panelZoom = 100 * Math.min(xZoom, yZoom);

        // Find visible shapes in viewport
        var shapes = [];
        let vpExtent = viewModel.viewer.viewer_.getView().calculateExtent();
        var regions = viewModel.viewer.getRegions();
        if (regions) {
            regions.forEachFeatureInExtent(vpExtent, function(feature){
                let shJson = featureToFigureShape(feature);
                if (shJson) {
                    shapes.push(shJson);
                }
            });
        }

        // dx and dy will be 0 if centre hasn't moved
        // calculate dx and dy (panning from centre)
        var halfWidth = image_info.dimensions.max_x / 2;
        var halfHeight = image_info.dimensions.max_y / 2;
        let center = view.getCenter();
        var dx = halfWidth - center[0];
        var dy = halfHeight + center[1];
        let channels = image_info.channels;
        // figure doesn't know about 'greyscale' so we fake it...
        if (image_info.model == "greyscale") {
            channels.forEach(ch => {
                if (ch.active) {
                    ch.color = "FFFFFF"
                }
            });
        }

        const pix_size = image_info.image_pixels_size

        let panel = {
            x: parseInt(image_config.position.left),
            y: parseInt(image_config.position.top),
            width: parseInt(image_config.size.width),
            height: parseInt(image_config.size.height),
            imageId: image_info.image_id,
            theZ: params.z,
            theT: params.t,
            channels,
            name: image_info.image_name,
            orig_width: image_info.dimensions.max_x,
            orig_height: image_info.dimensions.max_y,
            sizeZ: image_info.dimensions.max_z,
            sizeT: image_info.dimensions.max_t,
            pixel_size_x: pix_size.unit_x,  // e.g. 5.0
            pixel_size_y: pix_size.unit_y,
            pixel_size_z: pix_size.unit_z,
            pixel_size_x_unit: pix_size.unit_id_x, // e.g. "MILLIMETER"
            pixel_size_y_unit: pix_size.unit_id_y,
            pixel_size_z_unit: pix_size.unit_id_z,
            deltaT: image_info.image_delta_t,
            zoom: panelZoom,
            dx: dx,
            dy: dy,
            rotation: rotationDegrees,
            shapes,
        }
        if (image_info.dataset_name && image_info.dataset_name != "Multiple") {
            panel.datasetName = image_info.dataset_name;
            panel.datasetId = image_info.parent_id;
        }
        panels.push(panel);
    });

    // Scale all panels to fit on default A4 figure.
    let minX = panels.reduce((prev, p) => Math.min(prev, p.x), Infinity);
    let minY = panels.reduce((prev, p) => Math.min(prev, p.y), Infinity);
    let maxX = panels.reduce((prev, p) => Math.max(prev, p.x + p.width), 0);
    let figureA4width = A4_WIDTH;
    let figureMargin = 20;
    let availWidth = figureA4width - (2 * figureMargin);
    let scale = availWidth / (maxX - minX);

    panels.forEach(panel => {
        panel.x = (scale * (panel.x - minX)) + figureMargin;
        panel.y = (scale * (panel.y - minY)) + figureMargin;
        panel.width = panel.width * scale;
        panel.height = panel.height * scale;
    });

    return panels;
}

export function exportViewersAsFigureJson(figureName) {

    let panels = exportViewersAsPanelsJson()
    let figureJson = {
        version: 7,
        figureName: figureName,
        panels,
        page_size: "A4",
        paper_width: A4_WIDTH,
        paper_height: A4_HEIGHT,
    }
    return figureJson;
}
