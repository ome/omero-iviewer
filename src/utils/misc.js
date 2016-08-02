import {noView} from 'aurelia-framework';

@noView
export default class Misc {
    static isArray(something) {
        if (typeof something !== 'object' || something === null) return false;

        if (something instanceof Array ||
            Object.prototype.toString.call(null, something) === '[object Array]')
                return true;

        return false;
    }

    static convertSignedIntegerToHexColor(color) {
        if (typeof color !== 'number') return null;

        let alpha = (color & 0xFF000000) >>> 24;
        let red = (color & 0x00FF0000) >> 16;
        let green = (color & 0x0000FF00) >> 8;
        let blue = color & 0x000000FF;

        return {
            alpha: parseFloat(alpha) / 255,
            hex: "#" +
                ("00" + red.toString(16)).substr(-2) +
                ("00" + green.toString(16)).substr(-2) +
                ("00" + blue.toString(16)).substr(-2)};
    }

    static useJsonp(server="") {
        if (typeof server !== 'string') {
            return false;
        }
        if (server.trim() === '' ||
                server.indexOf("localhost") !== -1)
            return false;

        return true;
    }
}
