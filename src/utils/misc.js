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
}
