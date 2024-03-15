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

        // Figure "100%" zoom means image fits in viewport
        let viewportWidth = viewModel.viewer.viewer_.getViewport().offsetWidth;
        let viewportHeight = viewModel.viewer.viewer_.getViewport().offsetHeight;
        let zoomSizeX = image_info.dimensions.max_x / view.getResolution();
        let zoomSizeY = image_info.dimensions.max_y / view.getResolution();
        var xZoom = zoomSizeX / viewportWidth;
        var yZoom = zoomSizeY / viewportHeight;
        var panelZoom = 100 * Math.min(xZoom, yZoom);

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
            // TODO: check use of image_info.image_pixels_size.unit_x and .symbol_x etc
            // with images of different units
            pixel_size_x: image_info.image_pixels_size.x,
            pixel_size_y: image_info.image_pixels_size.y,
            pixel_size_z: image_info.image_pixels_size.z,
            deltaT: image_info.image_delta_t,
            zoom: panelZoom,
            dx: dx,
            dy: dy,
            rotation: 0,
        }
        panels.push(panel);
    });

    // Scale all panels to fit on default A4 figure.
    let minX = panels.reduce((prev, p) => Math.min(prev, p.x), Infinity);
    let minY = panels.reduce((prev, p) => Math.min(prev, p.y), Infinity);
    let maxX = panels.reduce((prev, p) => Math.max(prev, p.x + p.width), 0);
    let figureA4width = 595;
    let figureMargin = 20;
    let availWidth = figureA4width - (2 * figureMargin);
    let scale = availWidth / (maxX - minX);

    panels.forEach(panel => {
        panel.x = (scale * (panel.x - minX)) + figureMargin;
        panel.y = (scale * (panel.y - minY)) + figureMargin;
        panel.width = panel.width * scale;
        panel.height = panel.height * scale;
    });
}
