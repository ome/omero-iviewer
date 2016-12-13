import {noView} from 'aurelia-framework';

/**
 * the app name
 * @type {string}
 */
export const APP_NAME = 'iViewer';

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
