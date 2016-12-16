import {noView} from 'aurelia-framework';

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

        let host = window.location.host.toLowerCase();
        if (server.trim() === '' ||
            host === server.toLowerCase()) return false;

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
     * 'Prepares' uri so as to have a leading slash and take off any
     * trailing slashes. This is how internally we expect them to be
     * to achieve a consistent concatination.
     *
     * @static
     * @param {string} uri the uri
     * @return {string} the uri in a form that we want it to be
     */
    static prepareURI(uri) {
        if (typeof uri === 'string' && uri.length > 1) {
            // check for leading slash and remove trailing one if there...
            let i=uri.length-1;
            while(i>0) {
                if (uri[i] === '/') uri = uri.substring(0,i);
                else break;
                i--;
            }
            if (uri[0] !== '/') uri = '/' + uri;
        }
        return uri;
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
            let rEnd = rTok[1].toLowerCase();
            // account for reverse flag
            let rPos = rEnd.indexOf("r");
            if (rPos != -1) {
                tmp['reverseIntensity'] =
                    rEnd.substring(rPos-1, rPos) === '-' ? false : true;
                rEnd =
                    parseInt(rEnd.substring(0, tmp['reverseIntensity'] ? rPos : rPos-1));
            } else rEnd = parseInt(rEnd);
            if (isNaN(rStart) || isNaN(rEnd)) continue;
            tmp['start'] = rStart;
            tmp['end'] = rEnd;

            // extract last bit: color tokens
            c = c.substring(pos+1); // shave off range info
            //if (c.length !== 3 && c.length !== 6) continue; // we need hex notation length
            tmp['color'] = c;

            // add to return
            ret.push(tmp);
        }

        return ret;
    }

    /**
     * Assembles link url from the image settings for openening with the viewer
     *
     * @static
     * @param {string} server the server
     * @param {string} prefixed_uri the (potentially prefixed) uri
     * @param {number} image_id the image_idr
     * @param {Object} settings the image settings
     * @return {string} the url representing a link to the image
     */
    static assembleImageLink(server="", prefixed_uri, image_id, settings={}) {
        // we have no server => we are relative
        // therefore we are going to have to use the hostname
        // at a minimum (localhost) or protocol plus hostname
        if (typeof server !== 'string' || server.length === 0) {
            // if we have the navigation info => use it
            let prot = null;
            if (window && window.location && window.location.protocol)
                prot = window.location.protocol + "//";
            server = "";
            if (window && window.location && window.location.hostname) {
                let hostname = window.location.hostname;
                if (hostname !== 'localhost' && hostname !== '127.0.0.1')
                    server = prot + hostname;
                else server = hostname;
            }
        }
        // the base url
        let url = server + prefixed_uri + "/img_detail/" + image_id + '/?';

        // append channel info
        if (Misc.isArray(settings.channels)) {
            url += "c="
            let count = 0;
            settings.channels.map((chan) => {
                if (count !== 0) url += ",";
                url += (chan.active ? "" : "-") + (count+1) + "|" +
                    chan.start + ":" + chan.end +
                    (typeof chan.reverseIntensity === 'boolean' ?
                        (chan.reverseIntensity ? 'r' : '-r')  : '') + "$" +
                chan.color;
                count++;
            });
            url+= "&";
        }
        // append time and plane
        if (typeof settings.plane === 'number')
            url += "z=" + (settings.plane+1) + "&";
        if (typeof settings.time === 'number')
            url += "t=" + (settings.time+1) + "&";
        // append projection and model
        if (typeof settings.projection === 'string')
            url += "p=" + settings.projection + "&";
        if (typeof settings.model === 'string')
            url += "m=" + settings.model + "&";
        // append resolution and and center
        if (typeof settings.resolution === 'number')
            url += "zm=" + parseInt((1 / settings.resolution) * 100) + "&";
        if (Misc.isArray(settings.center))
            url += "x=" + settings.center[0] + "&y=" + settings.center[1] + "&";

        // take off trailing & for last param
        return url.substring(0, url.length-1);
    }
}
