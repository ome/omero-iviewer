
import Control from 'ol/control/Control';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import { CLASS_CONTROL } from 'ol/css';

export class Grid extends Control {
    /**
     * @constructor
     */
    constructor(opt_options) {
        const options = opt_options || {};

        const element = document.createElement('div');
        super({
            element: element,
            target: options.target
        });

        const cssClasses = 'ol-grid ' + CLASS_CONTROL;

        // defaults
        this.config = {
            cellSize: 5000,
            lineWidth: 2,
            labelSize: 20,
            showLabels: false
        }

        // Create button elements
        element.className = cssClasses;
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'btn-group btn-group-sm';
        buttonGroup.innerHTML = this.getControlsHtml();
        buttonGroup.children[0].addEventListener('click', (event) => {
            this.toggleGrid();
        });
        buttonGroup.children[1].addEventListener('click', (event) => {
            this.toggleGridPanel();
        });
        element.appendChild(buttonGroup);

        // listen for input events on children of the element (e.g., sliders, checkboxes)
        element.addEventListener('input', (event) => {
            const target = event.target;
            switch (target.type) {
                case 'radio':
                    // handle radio input for line width
                    this.config.lineWidth = parseInt(target.value, 10);
                    this.refreshGrid();  // re-render grid with new line width
                    break;
                case 'range':
                    this.config.cellSize = parseInt(target.value, 10);
                    target.previousElementSibling.value = target.value;
                    this.refreshGrid();  // re-render grid with new cell size
                    break;
                case 'number':
                    this.config.cellSize = parseInt(target.value, 10);
                    target.nextElementSibling.value = target.value;
                    this.refreshGrid();  // re-render grid with new cell size
                    break;
                case 'checkbox':
                    this.config.showLabels = target.checked;
                    this.refreshGrid();
                    break;
            }
        });

        // Map setter override to initialize on map setup
        this.setMap_ = this.setMap;
        this.setMap = (map) => {
            this.setMap_(map);
            if (map != null) this.init();
        };
        this.element = element;
    }

    /**
     * Converts a number to a letter (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, etc.)
     * @param {number} num The number to convert
     * @returns {string} The corresponding letter(s)
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
     * Adds buttons and panel
     * @private
     */
    getControlsHtml() {
        // random number to ensure unique radio button names for when multiple image viewers are open
        let randomNumber = Math.floor(Math.random() * 1000);
        return `<button class="btn btn-default glyphicon grid-toggle-btn" title="Show Grid"
                        style="width:30px; height:30px; top:0; padding: 1px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid #ccc; cursor: pointer;">
                    <svg class="grid-icon" viewBox="0 0 16 16" fill="none"
                            stroke="currentColor" stroke-width="1.5" aria-hidden="true"
                            style="width: 16px; height: 16px; display: block;">
                        <line x1="5.33"  y1="0"   x2="5.33"  y2="16"/>
                        <line x1="10.66" y1="0"   x2="10.66" y2="16"/>
                        <line x1="0"     y1="5.33"  x2="16"  y2="5.33"/>
                        <line x1="0"     y1="10.66" x2="16"  y2="10.66"/>
                    </svg>
                </button>
                <button class="grid-collapse-btn" title="Show Settings">
                    ▲
                </button>

                <div class="grid-controls">
                    <div class="grid-control-item">
                        <label>Cell Size (px)</label>
                        <div class="grid-input-group">
                            <input type="number"
                                value="${this.config.cellSize}"
                                min="5000" max="10000" step="500"
                                class="grid-number-input">
                            <input type="range"
                                value="${this.config.cellSize}"
                                min="5000" max="10000" step="500"
                                class="grid-slider">
                        </div>
                    </div>

                    <div class="grid-control-item">
                        <label>Line Width</label>
                        <div class="grid-linewidth-group">
                            <label><input type="radio" name="gridLineWidth${randomNumber}" value="1">1 px</label>
                            <label><input type="radio" name="gridLineWidth${randomNumber}" value="2" checked>2 px</label>
                            <label><input type="radio" name="gridLineWidth${randomNumber}" value="5">5 px</label>
                        </div>
                    </div>

                    <div class="grid-control-item">
                        <label>
                            <input type="checkbox" style="margin-top: 0">
                            Show Labels (A1, B2...)
                        </label>
                    </div>
                </div>`;
    }

    /**
     * Initialization on map setup
     */
    init(opts) {
        this.map = this.getMap()
    }

    /**
     * Toggles the visibility of the grid settings panel
     */
    toggleGridPanel() {
        this.element.classList.toggle('panel-open');
    }

    /**
     * Toggles the grid overlay on the map
     */
    toggleGrid() {
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
            this.gridLayer = null;
        }
        this.element.classList.toggle('enabled');

        if (this.element.classList.contains('enabled')) {
            this.refreshGrid();
        }
    }

    /**
     * Recreates the grid overlay based on current configuration
     */
    refreshGrid() {
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
            this.gridLayer = null;
        }

        // Resolve parameters (coerce to numbers; fall back to config defaults)
        const cellSize = this.config.cellSize;
        const lineWidth = this.config.lineWidth;
        const labelSize = this.config.labelSize;
        const showLabels = this.config.showLabels;

        // Guard: abort if cell size is invalid (prevents infinite loop / freeze)
        if (!cellSize || !isFinite(cellSize) || cellSize <= 0) {
            console.error('Invalid cell size, aborting grid render:', cellSize);
            return;
        }

        // find image layer to get image dimensions
        let imgLayer = this.map.getLayers().item(0);
        let src = imgLayer.getSource();
        const width = src.getWidth();
        const height = src.getHeight();

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
                color: 'rgba(255, 0, 0, 0.9)',
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
        this.map.getLayers().insertAt(1, this.gridLayer);
        this.map.render();
    }
}

export default Grid;
