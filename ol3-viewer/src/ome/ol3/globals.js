//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
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

goog.require('ol.Kinetic');
goog.require('ol.control.Attribution');
goog.require('ol.control.Rotate');
goog.require('ol.control.FullScreen');
goog.require('ol.interaction.DragPan');
goog.require('ol.interaction.PinchZoom');
goog.require('ol.interaction.MouseWheelZoom');
goog.require('ol.interaction.KeyboardPan');
goog.require('ol.interaction.KeyboardZoom');
goog.require('ol.interaction.DragZoom');
goog.require('ol.interaction.DragRotate');
goog.require('ol.interaction.DoubleClickZoom');
goog.require('ol.interaction.PinchRotate');
goog.require('ol.interaction.DragBox');
goog.require('ol.events.condition');

goog.require('ol.plugins');
goog.require('ol.PluginType');
goog.require('ol.renderer.canvas.ImageLayer');
goog.require('ol.renderer.canvas.Map');
goog.require('ol.renderer.canvas.TileLayer');
goog.require('ol.renderer.canvas.VectorLayer');
goog.require('ol.renderer.canvas.VectorTileLayer');

ol.plugins.register(ol.PluginType.MAP_RENDERER, ol.renderer.canvas.Map);
ol.plugins.registerMultiple(ol.PluginType.LAYER_RENDERER, [
  ol.renderer.canvas.ImageLayer,
  ol.renderer.canvas.TileLayer,
  ol.renderer.canvas.VectorLayer,
  ol.renderer.canvas.VectorTileLayer
]);

/**
 * a simple string lookup constant for WEB_API_BASE
 * @const
 * @type {string}
 */
ome.ol3.WEB_API_BASE = 'WEB_API_BASE';

/**
 * the url for the regions request (relative to WEB_API_BASE)
 * @const
 * @type {string}
 */
ome.ol3.REGIONS_REQUEST_URL = '/m/rois';

/**
 * a simple string lookup constant for WEBGATEWAY
 * @const
 * @type {string}
 */
ome.ol3.WEBGATEWAY = 'WEBGATEWAY';

/**
 * a simple string lookup constant for WEBCLIENT
 * @const
 * @type {string}
 */
ome.ol3.WEBCLIENT = 'WEBCLIENT';

/**
 * a simple string lookup constant for PLUGIN_PREFIX
 * @const
 * @type {string}
 */
ome.ol3.PLUGIN_PREFIX = 'PLUGIN_PREFIX';

/**
 * a list of (possibly prefixed) uri resources we need
 *
 * @const
 * @type {Array.<string>}
 */
ome.ol3.PREFIXED_URIS = [
    ome.ol3.PLUGIN_PREFIX, ome.ol3.WEB_API_BASE,
    ome.ol3.WEBCLIENT, ome.ol3.WEBGATEWAY
];

/**
 * Limit for untiled image retrieval: 2K^2
 * @const
 * @type {number}
 */
ome.ol3.UNTILED_RETRIEVAL_LIMIT = 4000000;

/**
 * the default tile dimensions
 * @const
 * @type {Object}
 */
ome.ol3.DEFAULT_TILE_DIMS = {"width": 512, "height": 512};

/**
 * Enum for RequestParams.
 * @static
 * @enum {string}
 */
ome.ol3.REQUEST_PARAMS = {
    CHANNELS: 'C',
    CENTER_X: 'X',
    CENTER_Y: 'Y',
    IMAGE_ID : 'IMAGE_ID',
    MAPS: 'MAPS',
    MODEL: 'M',
    OMERO_VERSION: 'OMERO_VERSION',
    PLANE: 'Z',
    PROJECTION: 'P',
    SERVER: 'SERVER',
    TIME: 'T',
    ZOOM: 'ZM'
};

/**
 * Enum for RegionsState.
 * @static
 * @enum {number}
 */
ome.ol3.REGIONS_STATE = {
    /** the original state */
    "DEFAULT" : 0,
    /** the changed state */
    "MODIFIED" : 1,
    /** the new state */
    "ADDED" : 2,
    /** the deleted state */
    "REMOVED" : 3,
    /** a state used for rollback */
    "ROLLBACK" : 4
};

/**
 * Enum for RegionsMode.
 * Depending on the mode, various interactions will be active.
 * <p>
 * Note, however, that some modes are inclusive and others mutually exclusive!
 * </p>
 * <ul>
 * <li>DEFAULT: means no interaction at all. Takes precendence over any other and is mutually exclusive with any others</li>
 * <li>SELECT: means that features can be selected via click but nothing more</li>
 * <li>TRANSLATE: means features can be translates. Implies: SELECT</li>
 * <li>MODIFY: features can be modified. Implies: SELECT. Can be combined with TRANSLATE but NEVER DRAW</li>
 * <li>DRAW: features can be drawn. Mutually exclusive with all others</li>
 *</ul>
 *
 * @static
 * @enum {number}
 */
ome.ol3.REGIONS_MODE = {
    /** the original state i.e. no interaction possible, only display */
    "DEFAULT" : 0,
    /** select interaction */
    "SELECT" : 1,
    /** translate interaction */
    "TRANSLATE" : 2,
    /** modify interaction */
    "MODIFY" : 3,
    /** draw interaction */
    "DRAW" : 4
};

/**
 * Enum for Render Status.
 * @static
 * @enum {number}
 */
ome.ol3.RENDER_STATUS = {
    /** we did no render watching */
    "NOT_WATCHED" : 0,
    /** we are watching and in progress */
    "IN_PROGRESS" : 1,
    /** we watched and are fininshed rendering */
    "RENDERED" : 2,
    /** we watched and got tile load errors  */
    "ERROR" : 3
};

/**
 * Enum for Projection.
 * @static
 * @enum {string}
 */
ome.ol3.PROJECTION = {
    /** normal **/
    "NORMAL" : 'normal',
    /** intmax **/
    "INTMAX" : 'intmax'
};

/**
 * list of length units incl. symbol, threshold for usage
 * and micron multiplication factor
 *
 * @const
 * @type {Object}
 */
ome.ol3.UNITS_LENGTH = [
    { unit: 'angstrom',
      threshold: 0.1, multiplier: 10000, symbol: '\u212B'},
    { unit: 'nanometer',
      threshold: 1, multiplier: 1000, symbol: 'nm'},
    { unit: 'micron',
      threshold: 1000, multiplier: 1, symbol:  '\u00B5m'},
    { unit: 'millimeter',
      threshold: 100000, multiplier: 0.001, symbol: 'mm'},
    { unit: 'centimeter',
      threshold: 1000000, multiplier: 0.0001, symbol: 'cm'},
    { unit: 'meter',
      threshold: 100000000, multiplier: 0.000001, symbol: 'm'}
 ];

/**
 * A lookup table to get or set dimension indices
 *
 * @const
 * @type {Object}
 */
ome.ol3.DIMENSION_LOOKUP = {
    "x" : {"method" : "Width", "settable" : false},
    "width" : {"method" : "Width", "settable" : false}, // alias
    "y" : {"method" : "Height", "settable" : false},
    "height" : {"method" : "Width", "settable" : false}, // alias
    "z" : {"method" : "Plane", "settable" : true},
    "t" : {"method" : "Time", "settable" : true},
    "c" : {"method" : "Channels", "settable" : true}
};

/**
 * List of available viewer controls by key
 *
 * The bracket info tells whether they are built-in: (defaults: true)
 * or custom: (defaults: false), and if they are enabled or disabled by default
 * Another relevant information is whether the controls are linked to interactions
 * and vice versa, that is, if a rotate control is added, it's going to be a mere
 * dummy if not the corresponding interaction is active
 *
 * <ul>
 * <li>attribution [defaults:true, enabled: false]</li>
 * <li>zoom [defaults:true, enabled: true]</li>
 * <li>rotate [defaults:true, enabled: false]</li>
 * <li>fullscreen [defaults:true, enabled: false]</li>
 * <li>draw [defaults:false, enabled: false]</li>
 *</ul>
 *
 * @const
 * @type {Object}
 */
ome.ol3.AVAILABLE_VIEWER_CONTROLS = {
    "attribution" :
        {"clazz" : ol.control.Attribution,
         "options": {},
         "defaults": true,
         "enabled": false,
         "links" : []},
    "zoom" :
        {"clazz" : ome.ol3.controls.Zoom,
         "options": {},
         "defaults": true,
         "enabled": true,
         "links" : []},
    "rotate" :
        {"clazz" : ol.control.Rotate,
         "options": {autoHide: false},
         "defaults": true,
         "enabled": true,
         "links" : ["shiftRotate"]},
    "fullscreen" :
        {"clazz" : ol.control.FullScreen,
         "options": {},
         "defaults": true,
         "enabled": true,
         "links" : []},
    "birdseye" :
        {"clazz" : ome.ol3.controls.BirdsEye,
        "options": {collapsed : true},
        "defaults": true,
        "enabled": false,
        "links" : []},
    "scalebar" :
        {"clazz" : ome.ol3.controls.ScaleBar,
        "options": {},
        "defaults": true,
        "enabled": false,
        "links" : []},
    "intensity" :
        {"clazz" : ome.ol3.controls.IntensityDisplay,
        "options": {},
        "defaults": true,
        "enabled": false,
        "links" : []}
};

/**
 * List of available viewer interactions by key.
 *
 * The bracket info tells whether they are built-in (defaults: true)
 * or custom (defaults: false), and if they are enabled or disabled by default
 * Another relevant information is whether the interactions want controls
 * and vice versa, that is, if a rotate interaction is added we'd want the corresponding
 * control to go back into the original/unrotated state via the control click
 *
 * <ul>
 * <li>dragPan [defaults:true, enabled: true]</li>
 * <li>pinchZoom [defaults:true, enabled: true]</li>
 * <li>mouseWheelZoom [defaults:true, enabled: true]</li>
 * <li>keyboardPan [defaults:true, enabled: false]</li>
 * <li>keyboardZoom [defaults:true, enabled: false]</li>
 * <li>shiftDragZoom [defaults:true, enabled: false]</li>
 * <li>shiftDragRotate [defaults:true, enabled: false]</li>
 * <li>doubleClickZoom [defaults:true, enabled: false]</li>
 * <li>pinchRotate [defaults:true, enabled: false]</li>
 * <li>boxSelect [defaults:false, enabled: false]</li>
 *</ul>
 *
 * @const
 * @type {Object}
 */
ome.ol3.AVAILABLE_VIEWER_INTERACTIONS = {
    "dragPan" :
        {"clazz" : ol.interaction.DragPan,
         "options": {"kinetic" : new ol.Kinetic(-0.005, 0.05, 100)},
         "defaults": true, "enabled": true,
         "links" : []},
    "pinchZoom" :
        {"clazz" : ol.interaction.PinchZoom,
         "options": {"zoomDuration" : null},
         "defaults": true,
         "enabled": true,
         "links" : []},
    "mouseWheelZoom" :
        {"clazz" : ol.interaction.MouseWheelZoom,
         "options": {"duration" : 0, "timeout": 0},
         "defaults": true,
         "enabled": true,
         "links" : []},
    "keyboardPan" :
        {"clazz" : ol.interaction.KeyboardPan, "options": {},
         "defaults": true, "enabled": false, "links" : []},
         "keyboardZoom" : {"clazz" : ol.interaction.KeyboardZoom,
         "options": {"zoomDuration" : null, "zoomDelta": null},
         "defaults": true, "enabled": false, "links" : []},
    "shiftDragZoom" :
        {"clazz" : ol.interaction.DragZoom,
         "options": {"zoomDuration" : null},
         "defaults": true, "enabled": false, "links" : []},
    "doubleClickZoom" :
        {"clazz" : ol.interaction.DoubleClickZoom,
         "options": {"zoomDuration" : null, "zoomDelta": null},
         "defaults": true, "enabled": false, "links" : []},
    "pinchRotate" :
        {"clazz" : ol.interaction.PinchRotate,
         "options": {}, "defaults": true, "enabled": false,
         "links" : ["rotate"]},
    "shiftRotate" :
        {"clazz" : ome.ol3.interaction.Rotate,
         "options": {},
         "defaults": true, "enabled": true,
         "links" : ["rotate"]},
    "boxSelect" :
        {"clazz" : ome.ol3.interaction.BoxSelect,
         "options": {}, "defaults": false, "enabled": false, "links" : []}
};

/**
 * Return an associative array of all controls
 * that are to be enabled by default
 *
 * @static
 * @function
 * @returns {Object} the default controls
 */
ome.ol3.defaultControls = function() {
    var ret = {};
    for (var K in ome.ol3.AVAILABLE_VIEWER_CONTROLS) {
        var V = ome.ol3.AVAILABLE_VIEWER_CONTROLS[K];
        if (V['defaults'] && V['enabled']) {
            try {
                var Constructor = V['clazz'];
                ret[K] = {
                    "type": 'control',
                    "ref": new Constructor(V['options']),
                    "defaults" : V['defaults']
                };
            } catch(bad) {
                // this could happen because the clazz does not point to a valid
                // function definition, a ClassNotFound in a way ...
                console.error("Failed to construct control: " + bad);
            }
        }
    };
    return ret;
};

/**
 * Return an associative array of all interactions
 * that are to be enabled by default
 *
 * @static
 * @function
 * @returns {Object} the default interactions
 */
ome.ol3.defaultInteractions = function() {
    var ret = {};
    for (var K in ome.ol3.AVAILABLE_VIEWER_INTERACTIONS) {
        var V = ome.ol3.AVAILABLE_VIEWER_INTERACTIONS[K];
        if (V['defaults'] && V['enabled']) {
            try {
                var Constructor = V['clazz'];
                ret[K] = {
                    "type": 'interaction',
                    "ref": new Constructor(V['options']),
                    "defaults" : V["defaults"]
                };
            } catch(bad) {
                // this could happen because the clazz does not point to a valid
                // function definition, a ClassNotFound in a way ...
                console.error("Failed to construct interaction: " + bad);
            }
        }
    };
    return ret;
};


goog.exportSymbol(
    'ome.ol3.REGIONS_MODE',
    ome.ol3.REGIONS_MODE,
    OME);

goog.exportSymbol(
    'ome.ol3.UNTILED_RETRIEVAL_LIMIT',
    ome.ol3.UNTILED_RETRIEVAL_LIMIT,
    OME);
