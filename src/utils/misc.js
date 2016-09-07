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
 * A utility class with various static helper methods
 */
@noView
export default class Misc {

    /**
     * Checks if we have an arry on our hands, something we do quite frequently
     *
     * @static
     * @return {boolean} true if something is an Array
     */
    static isArray(something) {
        if (typeof something !== 'object' || something === null) return false;

        if (something instanceof Array ||
            Object.prototype.toString.call(null, something) === '[object Array]')
                return true;

        return false;
    }

    /**
     * A rudimentary check for when we send an ajax request using jsonp.
     * In essence, anything that is not localhost or an empty string
     * (relative assumed) should be handled via jsonp
     *
     * @static
     * @return {boolean} true if we regard the server string not localhost
     */
    static useJsonp(server="") {
        if (typeof server !== 'string') return false;

        if (server.trim() === '' ||
                server.indexOf("localhost") !== -1)
            return false;

        return true;
    }

    /**
     * Prunes a given url to just preserve anything that is before the last /
     *
     * @static
     * @return {string} the part of the url that is before the last dash
     */
    static pruneUrlToLastDash(url) {
        if (typeof url !== 'string' || url.length < 1) return "";

        let dash = url.lastIndexOf('/');
        if (dash < 0) return url;

        return url.substring(0,dash);
    }

    /**
     * Queries a cookie (value)
     *
     * @static
     * @param {string} name the name of the cookie
     * @return {string} the cookie
     */
    static getCookie(name="") {
        let  ret = null;
        if (document.cookie && document.cookie != '') {
            let cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                let cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    ret = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return ret;
    }

    /**
     * Takes a string with channel information in the form:
     * -1|111:343$808080,2|0:255$FF0000 and parses it into an object that contains
     * the respective channel information/properties
     *
     * @static
     * @param {string} some_string a string containing encoded channel info
     * @return {Array|null} an array of channel objects or null
     */
    static parseChannelParameters(some_string="") {
        if (typeof some_string !== 'string' || some_string.length === 0)
            return null;

        let ret = [];

        // first remove any whitespace there may be
        some_string = some_string.replace(/\s/g, "");

        // split up into channels
        let chans = some_string.split(',');
        if (chans.length === 0) return null;

        // iterate over channel tokens
        for (let k in chans) {
            // extract channel number
            let c = chans[k];
            let pos = c.indexOf('|');
            if (pos === -1) continue;

            let chanNum = parseInt(c.substring(0, pos));
            if (isNaN(chanNum)) continue;

            let tmp = {
                'index' : chanNum < 0 ? (-chanNum)-1 : chanNum-1,
                'active' : chanNum < 0 ? false : true
            };

            // extract range token
            c = c.substring(pos+1); // shave off number info
            pos = c.indexOf("$");
            if (pos === -1) continue;
            let rTok = c.substring(0, pos).split(':');
            if (rTok.length !== 2) continue; // we need start and end
            let rStart = parseInt(rTok[0]);
            let rEnd = parseInt(rTok[1]);
            if (isNaN(rStart) || isNaN(rEnd)) continue;
            tmp['start'] = rStart;
            tmp['end'] = rEnd;

            // extract last bit: color tokens
            c = c.substring(pos+1); // shave off range info
            if (c.length !== 3 && c.length !== 6) continue; // we need hex notation length
            tmp['color'] = c;

            // add to return
            ret.push(tmp);
        }

        return ret;
    }
}
