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
import {noView} from 'aurelia-framework';

/**
 * @type {string}
 */
export const APP_NAME = 'iviewer';

/**
 * @type {string}
 */
export const APP_TITLE = 'OMERO.' + APP_NAME;

/**
 * the plugin name
 * @type {string}
 */
export const PLUGIN_NAME = 'omero_iviewer';

/**
 * a convenience string lookup for WEB_API_BASE
 * @type {string}
 */
export const WEB_API_BASE = "WEB_API_BASE";

/**
 * the datasets request url (relative to WEB_API_BASE)
 * @type {string}
 */
export const DATASETS_REQUEST_URL = "/m/datasets";

/**
 * the regions request url (relative to WEB_API_BASE)
 * @type {string}
 */
export const REGIONS_REQUEST_URL = "/m/rois";

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
 * the viewer's dom element prefix (complemented by config id)
 * @type {string}
 */
export const VIEWER_ELEMENT_PREFIX = "ol3_viewer_";

/**
 * the floating point precision used for channel settings
 * @type {number}
 */
export const FLOATING_POINT_PRECISION = 3;

/**
 * win 1252 charset encoding table
 * @type {Array.<number>}
 */
export const WINDOWS_1252 = [
    8364,129,8218,402,8222,8230,8224,8225,710,8240,352,8249,338,141,381,143,
    144,8216,8217,8220,8221,8226,8211,8212,732,8482,353,8250,339,157,382,376,
    160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,
    178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,
    196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,
    214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,
    232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,
    250,251,252,253,254,255
];

/**
 * the possible request params that we accept
 * @type {Object}
 */
export const REQUEST_PARAMS = {
    CHANNELS: 'C',
    CENTER_X: 'X',
    CENTER_Y: 'Y',
    DATASET_ID: 'DATASET',
    INTERPOLATE: 'INTERPOLATE',
    IMAGES: 'IMAGES',
    ROI: 'ROI',
    SHAPE: 'SHAPE',
    MAPS: 'MAPS',
    MODEL: 'M',
    NODEDESCRIPTORS: 'NODEDESCRIPTORS',
    OMERO_VERSION: 'OMERO_VERSION',
    PLANE: 'Z',
    PROJECTION: 'P',
    SERVER: 'SERVER',
    TIME: 'T',
    VERSION: 'VERSION',
    WELL_ID: 'WELL',
    ZOOM: 'ZM',
    ROI_PAGE_SIZE: 'ROI_PAGE_SIZE',
    MAX_PROJECTION_BYTES: 'MAX_PROJECTION_BYTES',
    MAX_ACTIVE_CHANNELS: 'MAX_ACTIVE_CHANNELS',
    ROI_COLOR_PALETTE: 'ROI_COLOR_PALETTE',
    SHOW_PALETTE_ONLY: 'SHOW_PALETTE_ONLY',
    ENABLE_MIRROR: 'ENABLE_MIRROR',
    FLIP_X: 'FX',
    FLIP_Y: 'FY',
    FULL_PAGE: 'FULL_PAGE',
    COLLAPSE_LEFT: 'COLLAPSE_LEFT',
    COLLAPSE_RIGHT: 'COLLAPSE_RIGHT'
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

/**
 * the luts png url (relative to webgateway prefix)
 * @type {string}
 */
export const LUTS_PNG_URL = '/img/luts_10.png';

/**
 * the right hand panel tab names
 * @type {Object}
 */
export const TABS = {
    INFO: 'info',
    SETTINGS: 'settings',
    ROIS: 'rois'
}

/**
 * IDs of the tabs within the ROI panel
 * @type {Object}
 */
export const ROI_TABS = {
    ROI_PLANE_GRID: "ROI_PLANE_GRID",
    ROI_TABLE: "ROI_TABLE",
}

/**
 * the possible intial types the viewer was openend with
 * @type {Object}
 */
export const INITIAL_TYPES = {
    NONE: 0,
    IMAGES: 1,
    DATASET: 2,
    WELL: 3,
    ROIS: 4,
    SHAPES: 5,
}

/**
 * possible projection values
 * @type {Object}
 */
export const PROJECTION = {
    NORMAL: 'normal',
    INTMAX: 'intmax'
}

/**
 * CSV line endings
 * @type {string}
 */
export const CSV_LINE_BREAK = '\u000D\u000A';

/**
 * lock option for syncing
 * @type {Object}
 */
export const SYNC_LOCK = {
    ZT: { CHAR: 'zt', LABEL: 'Z/T'},
    Z: { CHAR: 'z', LABEL: 'Z'},
    T: { CHAR: 't', LABEL: 'T'},
    VIEW: { CHAR: 'v', LABEL: 'View'},
    CHANNELS: { CHAR: 'c', LABEL: 'Channels'}
}

/**
 * enum for reload types
 * @type {Object}
 */
export const IMAGE_CONFIG_RELOAD = {
    IMAGE: 0,
    REGIONS: 1
}
