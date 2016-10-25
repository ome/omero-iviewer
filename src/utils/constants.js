import {noView} from 'aurelia-framework';

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
