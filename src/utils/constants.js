import {noView} from 'aurelia-framework';

/**
 * @type {string}
 */
export const APP_NAME = 'iViewer';

/**
 * the plugin name
 * @type {string}
 */
export const PLUGIN_NAME = 'omero_iviewer';

/**
 * a convenience string lookup for API_PREFIX
 * @type {string}
 */
export const API_PREFIX = "API_PREFIX";

/**
 * a convenience string lookup for URI_PREFIX
 * @type {string}
 */
export const URI_PREFIX = "URI_PREFIX";

/**
 * a convenience string lookup for IVIEWER
 * @type {string}
 */
export const IVIEWER = "IVIEWER";

/**
 * a convenience string lookup for WEBGATEWAY
 * @type {string}
 */
export const WEBGATEWAY = "WEBGATEWAY";

/**
 * a convenience string lookup for WEBCLIENT
 * @type {string}
 */
export const WEBCLIENT = "WEBCLIENT";

/**
 * a convenience string lookup for PLUGIN_PREFIX
 * @type {string}
 */
export const PLUGIN_PREFIX = "PLUGIN_PREFIX";

/**
 * the possible request params that we accept
 * @type {Object}
 */
export const REQUEST_PARAMS = {
    CHANNELS: 'C',
    CENTER_X: 'X',
    CENTER_Y: 'Y',
    DATASET_ID: 'DATASET',
    IMAGE_ID: 'IMAGE_ID',
    MAPS: 'MAPS',
    MODEL: 'M',
    PLANE: 'Z',
    PROJECTION: 'P',
    SERVER: 'SERVER',
    TIME: 'T',
    ZOOM: 'ZM'
}

/**
 * the possible modes of channel settings
 * @type {Object}
 */
export const CHANNEL_SETTINGS_MODE = {
    MIN_MAX: 0,
    FULL_RANGE: 1,
    IMPORTED: 2
}

/**
 * the possible 'regions' modes
 * @type {Object}
 */
export const REGIONS_MODE = {
    DEFAULT: 0,
    SELECT: 1,
    TRANSLATE: 2,
    MODIFY: 3,
    DRAW: 4
}

/**
 * the possible region drawing modes
 * @type {Object}
 */
export const REGIONS_DRAWING_MODE = {
    PRESENT_Z_AND_T: 1,
    ALL_Z_AND_T: 2,
    ALL_Z: 3,
    ALL_T: 4,
    NEITHER_Z_NOR_T: 5,
    NOT_Z: 6,
    NOT_T: 7,
    CUSTOM_Z_AND_T: 8
}

/**
 * the render status
 * @type {Object}
 */
export const RENDER_STATUS = {
    NOT_WATCHED: 0,
    IN_PROGRESS: 1,
    RENDERED: 2,
    ERROR: 3
}

/**
 * the text for the tooltips in case of missing permission
 * @type {Object}
 */
export const PERMISSION_TOOLTIPS = {
    CANNOT_EDIT: "No permission to edit",
    CANNOT_DELETE: "No permission to delete"
}

/*
 * luts list for pre-generated png
 * @type {Object}
 */
export const LUTS_NAMES = [
    '16_colors.lut',
    '3-3-2_rgb.lut',
    '5_ramps.lut',
    '6_shades.lut',
    'blue_orange_icb.lut',
    'brgbcmyw.lut',
    'cool.lut',
    'cyan_hot.lut',
    'edges.lut',
    'fire.lut',
    'gem.lut',
    'glasbey.lut',
    'glasbey_inverted.lut',
    'glow.lut',
    'grays.lut',
    'green_fire_blue.lut',
    'hilo.lut',
    'ica.lut',
    'ica2.lut',
    'ica3.lut',
    'ice.lut',
    'magenta_hot.lut',
    'orange_hot.lut',
    'phase.lut',
    'physics.lut',
    'rainbow_rgb.lut',
    'red-green.lut',
    'red_hot.lut',
    'royal.lut',
    'sepia.lut',
    'smart.lut',
    'spectrum.lut',
    'thal.lut',
    'thallium.lut',
    'thermal.lut',
    'unionjack.lut',
    'yellow_hot.lut'
];
