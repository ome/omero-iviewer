//
// Copyright (C) 2024 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import {Style, Stroke, Fill, Text} from 'ol/style';

/**
 * Grid Overlay - Optimized for NDPI images in OMERO with labels.
 */
export class GridOverlay {
    constructor(viewer) {
        this.viewer = viewer;
        this.gridLayer = null;
        this.enabled = false;

        // Default configuration
        this.config = {
            cellSize: 5000,
            lineWidth: 2,
            gridColor: 'rgba(255, 0, 0, 0.9)',
            showLabels: true,
            labelSize: 20
        };
    }

    /**
     * Show grid with quadrant labels.
     *
     * @param {number} customLineWidth line width in px (optional)
     * @param {number} customCellSize  cell size in px (optional)
     * @param {boolean} showLabels     whether to draw A1/B2 labels
     * @param {number} customLabelSize label font size in px (optional)
     */
    showGrid(customLineWidth = null, customCellSize = null,
             showLabels = true, customLabelSize = null) {

        // Resolve parameters (coerce to numbers; fall back to config defaults)
        const cellSize = parseInt(customCellSize, 10) || this.config.cellSize;
        const lineWidth = parseInt(customLineWidth, 10) || this.config.lineWidth;
        const labelSize = parseInt(customLabelSize, 10) || this.config.labelSize;

        // Guard: abort if cell size is invalid (prevents infinite loop / freeze)
        if (!cellSize || !isFinite(cellSize) || cellSize <= 0) {
            console.error('Invalid cell size, aborting grid render:', cellSize);
            return;
        }

        this.config.cellSize = cellSize;
        this.config.lineWidth = lineWidth;
        this.config.labelSize = labelSize;
        this.config.showLabels = showLabels;

        // Remove any previous layer first
        this.hideGrid();

        const map = this.viewer.viewer_;
        const imageInfo = this.viewer.image_info_;
        if (!map || !imageInfo || !imageInfo.size) {
            console.error('Could not get map / image information');
            return;
        }

        const width = imageInfo.size.width;
        const height = imageInfo.size.height;

        console.log('=== GRID OVERLAY ===');
        console.log('Image dimensions:', width, 'x', height);
        console.log('Cell size:', cellSize, 'px | Line width:', lineWidth,
                    'px | Label size:', labelSize, 'px');

        const features = [];

        // Vertical lines (inverted Y axis used by OMERO: [x, -y])
        for (let x = 0; x <= width; x += cellSize) {
            const f = new Feature({
                geometry: new LineString([[x, -height], [x, 0]]),
                gridType: 'line'
            });
            f.set('non-interactive', true);
            features.push(f);
        }
        // Horizontal lines
        for (let y = 0; y <= height; y += cellSize) {
            const f = new Feature({
                geometry: new LineString([[0, -y], [width, -y]]),
                gridType: 'line'
            });
            f.set('non-interactive', true);
            features.push(f);
        }

        // Labels (A1, B2, ...)
        if (showLabels) {
            const cols = Math.ceil(width / cellSize);
            const rows = Math.ceil(height / cellSize);
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const label = this.numberToLetter(col) + (row + 1);
                    const cx = col * cellSize + cellSize / 2;
                    const cy = -(row * cellSize + cellSize / 2);
                    const f = new Feature({
                        geometry: new Point([cx, cy]),
                        gridType: 'label',
                        label: label
                    });
                    f.set('non-interactive', true);
                    features.push(f);
                }
            }
        }

        const lineStyle = new Style({
            stroke: new Stroke({
                color: this.config.gridColor,
                width: lineWidth,
                lineCap: 'square'
            })
        });

        const source = new VectorSource({ features: features, wrapX: false });

        this.gridLayer = new VectorLayer({
            source: source,
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            // NB: deliberately NO className (see class comment)
            style: (feature) => {
                if (feature.get('gridType') === 'label') {
                    return new Style({
                        text: new Text({
                            text: feature.get('label'),
                            font: `bold ${labelSize}px Arial`,
                            fill: new Fill({ color: 'rgba(255, 255, 255, 0.9)' }),
                            stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.8)', width: 3 }),
                            overflow: true
                        })
                    });
                }
                return lineStyle;
            }
        });
        this.gridLayer.set('selectable', false);
        this.gridLayer.set('grid-layer', true);
        this.gridLayer.set('name', 'grid-overlay');

        // Insert at position 1 (just above the base image, below the ROI/regions
        // layers). iviewer's drawing assumes the regions layer is the topmost one,
        // so the grid must NOT be appended at the end or it captures the draw.
        // insertAt() is the correct Collection API (fires events; unlike a direct
        // getArray().splice(), which broke the enable/disable toggle).
        map.getLayers().insertAt(1, this.gridLayer);
        map.render();

        this.enabled = true;
        console.log('Grid overlay enabled (feature-based, no className). Features:',
                    features.length);
        console.log('====================');
    }

    /**
     * Convert number to letter (0=A, 1=B, 25=Z, 26=AA, etc.)
     */
    numberToLetter(num) {
        let letter = '';
        while (num >= 0) {
            letter = String.fromCharCode(65 + (num % 26)) + letter;
            num = Math.floor(num / 26) - 1;
        }
        return letter;
    }

    /**
     * Hide grid
     */
    hideGrid() {
        const map = this.viewer.viewer_;
        if (this.gridLayer) {
            try {
                const source = this.gridLayer.getSource();
                if (source) source.clear();
                if (map) map.removeLayer(this.gridLayer);
            } catch (error) {
                console.error('Error hiding grid:', error);
            }
            this.gridLayer = null;
        }
        this.enabled = false;
        if (map) map.render();
    }

    /**
     * Toggle grid on/off
     */
    toggle() {
        if (this.enabled) {
            this.hideGrid();
        } else {
            this.showGrid();
        }
    }

    /**
     * Update line width
     */
    updateLineWidth(newWidth) {
        if (this.enabled) {
            this.showGrid(newWidth, this.config.cellSize, this.config.showLabels);
        }
    }

    /**
     * Update cell size
     */
    updateCellSize(newSize) {
        if (this.enabled) {
            this.showGrid(this.config.lineWidth, newSize, this.config.showLabels);
        }
    }

    /**
     * Toggle labels
     */
    toggleLabels() {
        if (this.enabled) {
            this.showGrid(this.config.lineWidth, this.config.cellSize,
                          !this.config.showLabels);
        }
    }

    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
}
