import {noView} from 'aurelia-framework';

/**
 * the app name
 * @type {string}
 */
export const APP_NAME = 'iViewer';

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
 * the possible request params that we accept
 * @type {Object}
 */
export const REQUEST_PARAMS = {
    SERVER : 'SERVER',
    IMAGE_ID : 'IMAGE_ID',
    CHANNELS : 'C',
    PLANE : 'Z',
    TIME : 'T',
    PROJECTION : 'P',
    MODEL : 'M',
    CENTER_X : 'X',
    CENTER_Y : 'Y',
    ZOOM : 'ZM'
}

/**
 * the possible modes of channel settings
 * @type {Object}
 */
export const CHANNEL_SETTINGS_MODE = {
    MIN_MAX : 0,
    FULL_RANGE : 1,
    IMPORTED : 2
}

/**
 * the possible 'regions' modes
 * @type {Object}
 */
export const REGIONS_MODE = {
    DEFAULT : 0,
    SELECT : 1,
    TRANSLATE : 2,
    MODIFY : 3,
    DRAW : 4
}

/**
 * the possible region drawing modes
 * @type {Object}
 */
export const REGIONS_DRAWING_MODE = {
    Z_AND_T_VIEWED : 0,
    ALL_Z_AND_T : 1,
    ALL_Z: 2,
    ALL_T : 3,
    SELECTED_Z_AND_T : 4,
    NEITHER_Z_NOR_T : 5
}
