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
 * Grid Overlay - Optimized for NDPI images in OMERO with labels
 */
export class GridOverlay {
    constructor(viewer) {
        this.viewer = viewer;
        this.gridLayer = null;
        this.labelLayer = null;
        this.enabled = false;
        
        // Default configuration
        this.config = {
            cellSize: null,
            lineWidth: null,
            gridColor: 'rgba(255, 0, 0, 0.9)',
            showLabels: true,
            labelSize: 30
        };
    }

    /**
     * Show grid with quadrant labels
     */
    showGrid(customLineWidth = null, customCellSize = null, showLabels = true, customLabelSize = null) {
        if (this.gridLayer) {
            this.hideGrid();
        }

        try {
            const imageInfo = this.viewer.image_info_;
            if (!imageInfo || !imageInfo.size) {
                console.error('Could not get image information');
                return;
            }
            
            const width = imageInfo.size.width;
            const height = imageInfo.size.height;

            console.log('=== GRID OVERLAY DEBUG ===');
            console.log('Image dimensions:', width, 'x', height);
            console.log('Requested cell size:', customCellSize);

            // Calculate parameters if not specified
            let cellSize, lineWidth, labelSize;
            
            // Cell size: use custom value or fallback to auto-calculation
        if (customCellSize) {
            cellSize = customCellSize;  // ← USE THE VALUE PROVIDED
        } else {
            // Fallback: auto-calculate only if not provided
            if (Math.max(width, height) > 50000) {
                cellSize = Math.floor(Math.min(width, height) / 6);
            } else if (Math.max(width, height) > 10000) {
                cellSize = Math.floor(Math.min(width, height) / 10);
            } else {
                cellSize = Math.floor(Math.min(width, height) / 12);
            }
        }
        
        // Line width: always 5px
        lineWidth = customLineWidth || 5;
        
        // Label size: based on image size
        if (Math.max(width, height) > 50000) {
            labelSize = customLabelSize || 20;
        } else if (Math.max(width, height) > 10000) {
            labelSize = customLabelSize || 20;
        } else {
            labelSize = customLabelSize || 20;
        }

            this.config.cellSize = cellSize;
            this.config.lineWidth = lineWidth;
            this.config.labelSize = labelSize;
            this.config.showLabels = showLabels;

            console.log('Cell size:', cellSize, 'px');
            console.log('Line width:', lineWidth, 'px');
            console.log('Label size:', labelSize, 'px');

            // Create line features
            const gridFeatures = [];

            // Vertical lines
            for (let x = 0; x <= width; x += cellSize) {
                const line = new LineString([
                    [x, -height],
                    [x, 0]
                ]);
                const feature = new Feature({
                    geometry: line,
                    type: 'grid-vertical'
                });
                // Mark feature as non-interactive
                feature.set('non-interactive', true);
                feature.setId('grid-line-v-' + x); // Unique ID
                gridFeatures.push(feature);
            }

            // Horizontal lines
            for (let y = 0; y <= height; y += cellSize) {
                const line = new LineString([
                    [0, -y],
                    [width, -y]
                ]);
                const feature = new Feature({
                    geometry: line,
                    type: 'grid-horizontal'
                });
                // Mark feature as non-interactive
                feature.set('non-interactive', true);
                feature.setId('grid-line-h-' + y); // Unique ID
                gridFeatures.push(feature);
            }

            // Create grid layer
            const gridSource = new VectorSource({ 
                features: gridFeatures,
                wrapX: false
            });

            this.gridLayer = new VectorLayer({
                source: gridSource,
                style: new Style({
                    stroke: new Stroke({
                        color: this.config.gridColor,
                        width: lineWidth,
                        lineCap: 'square'
                    })
                }),
                zIndex: 9999,
                updateWhileAnimating: true,
                updateWhileInteracting: false,
                className: 'grid-overlay-layer',
                properties: {
                    'non-interactive': true,
                    'grid-layer': true
                }
            });
            
            // Mark layer as non-selectable and non-interactive
            this.gridLayer.set('selectable', false);
            this.gridLayer.set('grid-layer', true);
            this.gridLayer.set('name', 'grid-overlay');

            // Create quadrant labels
            if (showLabels) {
                const labelFeatures = [];
                const cols = Math.ceil(width / cellSize);
                const rows = Math.ceil(height / cellSize);

                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const colLabel = this.numberToLetter(col);
                        const rowLabel = row + 1;
                        const label = `${colLabel}${rowLabel}`;

                        const x = col * cellSize + cellSize / 2;
                        const y = -(row * cellSize + cellSize / 2);

                        const point = new Point([x, y]);
                        const feature = new Feature({
                            geometry: point,
                            label: label,
                            type: 'grid-label'
                        });
                        
                        // CRITICAL: Mark feature as non-interactive
                        feature.set('non-interactive', true);
                        feature.setId('grid-label-' + colLabel + rowLabel);
                        labelFeatures.push(feature);
                    }
                }

                const labelSource = new VectorSource({ 
                    features: labelFeatures,
                    wrapX: false
                });

                this.labelLayer = new VectorLayer({
                    source: labelSource,
                    style: (feature) => {
                        return new Style({
                            text: new Text({
                                text: feature.get('label'),
                                font: `bold ${labelSize}px Arial`,
                                fill: new Fill({ color: 'rgba(255, 255, 255, 0.9)' }),
                                stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.8)', width: 3 }),
                                offsetX: 0,
                                offsetY: 0
                            })
                        });
                    },
                    zIndex: 10000,
                    updateWhileAnimating: true,
                    updateWhileInteracting: false,  // CRITICAL
                    className: 'grid-label-layer',
                    properties: {
                        'non-interactive': true,
                        'grid-layer': true
                    }
                });
                
                // CRITICAL: Mark layer as completely non-selectable
                this.labelLayer.set('selectable', false);
                this.labelLayer.set('grid-layer', true);
                this.labelLayer.set('name', 'grid-labels');
                this.labelLayer.set('interactive', false);
            }

            // Add layers to map
            const map = this.viewer.viewer_;
            map.addLayer(this.gridLayer);
            if (this.labelLayer) {
                map.addLayer(this.labelLayer);
            }

            // Don't put them at the end - insert before interactive layers
            const allLayers = map.getLayers().getArray();
            [this.gridLayer, this.labelLayer].forEach(layer => {
                if (layer) {
                    const idx = allLayers.indexOf(layer);
                    if (idx !== -1) {
                        allLayers.splice(idx, 1);
                        // Insert at position 1 (after base image, before ROI layers)
                        allLayers.splice(1, 0, layer);
                    }
                }
            });

            this.enabled = true;
            console.log(' Grid overlay added (fully non-interactive mode)');
            console.log('Grid layer selectable:', this.gridLayer.get('selectable'));
            if (this.labelLayer) {
                console.log('Label layer selectable:', this.labelLayer.get('selectable'));
            }
            console.log('=========================');

        } catch (error) {
            console.error(' Error showing grid:', error);
        }
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
                // Clear the source first
                const source = this.gridLayer.getSource();
                if (source) {
                    source.clear();
                }
                
                // Remove layer from map
                map.removeLayer(this.gridLayer);
                this.gridLayer = null;
                
                console.log(' Grid layer removed');
            } catch (error) {
                console.error('Error hiding grid:', error);
            }
        }
        
        if (this.labelLayer) {
            try {
                // Clear the source first
                const source = this.labelLayer.getSource();
                if (source) {
                    source.clear();
                }
                
                // Remove layer from map
                map.removeLayer(this.labelLayer);
                this.labelLayer = null;
                
                console.log(' Label layer removed');
            } catch (error) {
                console.error('Error hiding labels:', error);
            }
        }
        
        this.enabled = false;
        
        // Force map to re-render
        map.render();
        
        console.log(' Grid overlay removed completely');
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
            this.showGrid(this.config.lineWidth, this.config.cellSize, !this.config.showLabels);
        }
    }

    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
}