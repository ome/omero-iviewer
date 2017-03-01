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
     * Likewise it will take map information in json format and add the reverse
     * intensity to the channels
     *
     * @param {string} channel_info a string containing encoded channel info
     * @param {string|Array.<Object>} maps_info
     *                    a string in json format containing reverse intensity
     *                    or an array of alrady parsed json (for convenience)
     *
     * @static
     * @return {Array|null} an array of channel objects or null
     */
    static parseChannelParameters(channel_info="", maps_info="") {
        if (typeof channel_info !== 'string' || channel_info.length === 0)
            return null;

        let ret = [];

        // first remove any whitespace there may be
        channel_info = channel_info.replace(/\s/g, "");

        // split up into channels
        let chans = channel_info.split(',');
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
            //if (c.length !== 3 && c.length !== 6) continue; // we need hex notation length
            tmp['color'] = c;

            // add to return
            ret.push(tmp);
        }

        // integrate reverse intensity from maps
        if (Misc.isArray(maps_info)) // we have an array of parsed objects
            return Misc.integrateReverseIntensityIntoChannels(ret, maps_info);

        // we need to parse the json still
        if (typeof maps_info !== 'string' || maps_info.length === 0)
            return ret;
        try {
            maps_info = maps_info.replace(/&quot;/g, '"');
            return Misc.integrateReverseIntensityIntoChannels(
                ret, JSON.parse(maps_info));
        } catch(malformedJson) {
            console.error("Error parsing maps json");
        }

        return ret;
    }

    /**
     * Integrate the reverse intensity from the maps contents into the channels
     *
     * @param {Array.<Object>} channels array with channels info
     * @param {Array.<Object>} maps array with maps info
     *
     * @static
     * @private
     * @return {Array} the channels with reverse intensity integrated
     */
    static integrateReverseIntensityIntoChannels(channels, maps) {
        if (!Misc.isArray(channels) || !Misc.isArray(maps) ||
            channels.length === 0 || maps.length === 0) return channels;

        let len = channels.length;
        for (let i=0;i<len && i<maps.length;i++) {
            let m = maps[i];
            if (typeof m !== 'object' || m === null) continue;
            channels[i]['reverseIntensity'] =
                typeof m['reverse'] === 'object' && m['reverse'] &&
                typeof m['reverse']['enabled'] === 'boolean' &&
                m['reverse']['enabled'];
        }

        return channels;
    }

    /**
     * Appends the channels and maps parameters
     *
     * @param {Array.<Object>} channels array with channel information
     * @param {string} url the url to append to
     * @return string the url with the appended parameters
     *
     * @static
     * @memberof Settings
     */
    static appendChannelsAndMapsToQueryString(channels, url) {
        if (typeof url !== 'string') return url;

        if (!Misc.isArray(channels) || channels.length === 0) return url;

        let lastChar = url[url.length-1];
        url += ((lastChar !== '?' && lastChar !== '&') ? '&' : '') + 'c=';
        let i=0;
        let maps = [];
        channels.map(
            (c) => {
                url+= (i !== 0 ? ',' : '') + (!c.active ? '-' : '') + (++i) +
                 "|" + c.window.start + ":" + c.window.end + "$" + c.color;
                 maps.push(
                     {"reverse" : { "enabled" :
                         typeof c.reverseIntensity === 'boolean' &&
                         c.reverseIntensity}
                     });
             });
        return url + "&maps=" + JSON.stringify(maps);
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
        // append channels and maps parameters
        url = Misc.appendChannelsAndMapsToQueryString(settings.channels, url);
        // append time and plane
        if (typeof settings.plane === 'number')
            url += "&z=" + (settings.plane+1);
        if (typeof settings.time === 'number')
            url += "&t=" + (settings.time+1);
        // append projection and model
        if (typeof settings.projection === 'string')
            url += "&p=" + settings.projection;
        if (typeof settings.model === 'string')
            url += "&m=" + settings.model;
        // append resolution and and center
        if (typeof settings.resolution === 'number')
            url += "&zm=" + parseInt((1 / settings.resolution) * 100);
        if (Misc.isArray(settings.center))
            url += "&x=" + settings.center[0] + "&y=" + settings.center[1];

        return url;
    }
}
