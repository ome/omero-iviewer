import {noView} from 'aurelia-framework';

/**
 * A converter class that maps strings to booleans and vice versa
 */
@noView
export class ImageModelValueConverter {

  toView(model) {
    let grayscale_flag = true;
    if (typeof model === 'string' && model.length > 0 &&
            (model.toLowerCase() === 'color' ||
                model[0].toLowerCase() === 'c'))
        grayscale_flag = false;

    return grayscale_flag;
  }

  fromView(flag) {
      let model = 'greyscale';
      if (typeof flag === 'boolean' && !flag) model = 'color';

      return model;
  }
}

import Misc from './misc';

/*
 * Methods for color conversion
 */
@noView
export class Converters {

    /**
     * Creates a color in rgba notation from a hex string and an alpha value
     *
     * @static
     * @param {string} hex the color in hex notation
     * @param {number} alpha the alpha value
     * @return {string} the color (incl. alpha) as rgba string
     */
    static hexColorToRgba(hex, alpha) {
            if (typeof hex !== 'string' || hex.length === 0) return null;
            if (typeof alpha !== 'number') alpha = 1.0;

           try {
               // strip white space and #
               let strippedHex = hex.replace(/#|\s/g, "");
            if (strippedHex.length === 3)
                strippedHex = '' +
                    strippedHex[0] + strippedHex[0] +
                    strippedHex[1] + strippedHex[1] +
                    strippedHex[2] + strippedHex[2];
               if (strippedHex.length != 6) return null;

               // prepare return object
               let ret =
                "rgba(" + parseInt(strippedHex.substring(0,2), 16) + "," +
                parseInt(strippedHex.substring(2,4), 16) + "," +
                parseInt(strippedHex.substring(4,6), 16) + "," + alpha + ")";
            return ret;
           } catch (parse_error) {
               return null;
           }
   }

   /**
    * Turns a color in rgba notation into an array of a hex string with alpha
    *
    * @static
    * @param {string} rgba the color in rgba notation
    * @return {Array.<string, number>} an array with 2 entries, first hex, second alpha
    */
   static rgbaToHexAndAlpha(rgba) {
       if (typeof rgba !== 'string' || rgba.length === 0) return null;

      try {
          let strippedRgba = rgba.replace(/\(rgba|\(|rgba|rgb|\)/g, "");
          let tokens = strippedRgba.split(",");
          if (tokens.length < 3) return null; // at a minimum we need 3 channels

          let ret = [];
          let hex =
            "#" +
                ("00" + parseInt(tokens[0], 10).toString(16)).substr(-2) +
                ("00" + parseInt(tokens[1], 10).toString(16)).substr(-2) +
                ("00" + parseInt(tokens[2], 10).toString(16)).substr(-2);
          ret.push(hex);

          let alpha = tokens.length > 3 ? parseFloat(tokens[3], 10) : 1.0;
          ret.push(alpha);

          return ret;
      } catch (parse_error) {
          return null;
      }
   }

   /**
    * Turns a color in signed integer encoding into an array that contains
    * the hex representation in the first slot, the alpha value in the second
    *
    * @static
    * @param {number} signed_integer a color as integer
    * @return {Array.<string, number>} an array with 2 entries, first hex, second alpha
    */
    static signedIntegerColorToHexAndAlpha(signed_integer) {
        if (typeof signed_integer !== 'number') return null;

        // prepare integer to be converted to hex for easier dissection
        if (signed_integer < 0) signed_integer = signed_integer >>> 0;
        let intAsHex = signed_integer.toString(16);
        // pad with zeros to have 8 digits
        intAsHex = ("00" + intAsHex).slice(-8);

        // we expect RGBA
        let hex = "#";
        for (let i=0;i<intAsHex.length-2;i+=2)
            hex += intAsHex.substr(i, 2);
        let alpha = parseInt(intAsHex.substring(6,8), 16) / 255;

        return [hex, alpha];
    }

    /**
     * Makes omero marshal generated objects backwards compatible
     *
     * @static
     * @param {object} shape a shape created from omero marshal json
     * @return {object} a shape as if it was returned by the webgateway
     */
     static makeShapeBackwardsCompatible(shape) {
         if (typeof shape !== 'object' || shape === null ||
                typeof shape['@type'] !== 'string') return null;

        let typePos = shape['@type'].lastIndexOf("#");
        if (typePos === -1) return; // we really need this info
        let type = shape['@type'].substring(typePos + 1).toLowerCase();

        // create shape copy in 'webgateway format'
        let compatibleShape = {type : type}; // type
        if (typeof shape.oldId === 'string' && shape.oldId.indexOf(":") > 0) {
            compatibleShape.shape_id = shape.oldId; // dissect id
            compatibleShape.id =
                parseInt(
                    compatibleShape.shape_id.substring(
                        compatibleShape.shape_id.indexOf(":") + 1));
        }

        // loop over individual properties
        for (let p in shape) {
            // we skip those
            if (p === '@type' || p === 'oldId') continue;
            // first letter will be lower case converted
            let pComp = p[0].toLowerCase() + p.substring(1);
            let value = shape[p];
            // color value are signed integers and need to be converted
            let colorPos = p.indexOf('Color');
            if (colorPos !== -1 && typeof value === 'number') {
                let color = Converters.signedIntegerColorToHexAndAlpha(value);
                if (!Misc.isArray(color)) continue;
                compatibleShape[pComp.substring(0,colorPos) + "Alpha"] = color[1];
                value = color[0];
            }
            // text => textValue
            if (p === 'Text') pComp = 'textValue';
            // stroke width object => number
            if (p === 'StrokeWidth') value = shape[p].Value;
            // font size object => number
            if (p === 'FontSize') value = shape[p].Value;
            // transform
            if (p === 'Transform')
                value = "matrix(" +
                    shape[p].A00 + " " + shape[p].A10 + " " +
                    shape[p].A01 + " " + shape[p].A11 + " " +
                    shape[p].A02 + " " + shape[p].A12 + ")";
            if (p === 'Points') {
                try {
                    let coords = [];
                    let points = shape[p].split(" ");
                    if (type === 'polygon') points.splice(points.length-1);
                    points.map((point) => {
                        let tuple = point.split(",");
                        coords.push( // x/y
                            [parseFloat(tuple[0]),
                             parseFloat(tuple[1])]);});
                    value = "M ";
                    let i = 0;
                    coords.map((c) => {
                        if (i !== 0) value += " L ";
                        value += c[0] + " " + c[1];
                        i++;
                    });
                    if (type === 'polygon') value += " Z";
                } catch(ignored) {}
            }
            // set propery and value
            compatibleShape[pComp] = value;
        }

        return compatibleShape;
     }
}
