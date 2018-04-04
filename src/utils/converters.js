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

/**
 * A converter class that extracts the sync group number
 */
@noView
export class SyncGroupValueConverter {

  toView(syncGroup) {
    let len = "group".length;
    if (typeof syncGroup !== 'string' || syncGroup.length < len) return "";
    return syncGroup.substring(len);
  }
}

import Misc from './misc';

/*
 * Methods for data conversion
 */
@noView
export class Converters {

   /**
    * Encodes a color in rgba notation into a signed integer
    *
    * @static
    * @param {string} rgba the color in rgba notation
    * @return {number} the color encoded as signed integer or null (if error)
    */
   static rgbaToSignedInteger(rgba) {
      if (typeof rgba !== 'string' || rgba.length === 0) return null;

      let strippedRgba = rgba.replace(/\(rgba|\(|rgba|rgb|\)/g, "");
      let tokens = strippedRgba.split(",");
      if (tokens.length < 3) return null; // at a minimum we need 3 channels

      let color = {
          red:  parseInt(tokens[0]),
          green:  parseInt(tokens[1]),
          blue:  parseInt(tokens[2]),
          alpha: tokens.length > 3 ? parseFloat(tokens[3]) : 1.0
      };
      var decimalMultiplied = color.alpha * 255;
      var decimalOnly = decimalMultiplied - parseInt(decimalMultiplied);
      color.alpha = decimalOnly <= 0.5 ?
          Math.floor(decimalMultiplied) : Math.ceil(decimalMultiplied);

      return ((color.red << 24) | (color.green << 16) | (color.blue << 8) |
                color.alpha);
   }

   /**
    * Turns a color in signed integer encoding into a color in rgba notation
    * e.g. 'rgba(100,30,255,0.7)'
    *
    * @static
    * @param {number} signed_integer a color as integer
    * @return {string} the color in rgba notation
    */
    static signedIntegerToRgba(signed_integer) {
      if (typeof signed_integer !== 'number') return null;

      // prepare integer to be converted to hex for easier dissection
      if (signed_integer < 0) signed_integer = signed_integer >>> 0;
      let intAsHex = signed_integer.toString(16);
      // pad with zeros to have 8 digits
      intAsHex = ("00000000" + intAsHex).slice(-8);

      // we expect RGBA
      let rgba = "rgba(";
      for (let i=0;i<intAsHex.length-2;i+=2)
        rgba += parseInt(intAsHex.substr(i, 2),16) + ",";
      rgba += parseInt(intAsHex.substring(6,8), 16) / 255;

      return rgba + ")";
    }

    /**
     * Extracts the individual roi and shape id from a combined id (roi:shape)
     *
     * @static
     * @param {string} id the id in the format roi_id:shape_id, e.g. 2:4
     * @return {Object} an object containing the properties roi_id and shape_id
     */
    static extractRoiAndShapeId(id) {
      let ret = {
        roi_id: null,
        shape_id: null
      };
      if (typeof id !== 'string' || id.length < 3) return ret;

      // dissect roi:shape id
      let colon = id.indexOf(':');
      if (colon < 1) return ret;

      // check for numeric
      let roi_id = parseInt(id.substring(0, colon));
      if (!isNaN(roi_id)) ret.roi_id = roi_id;
      let shape_id = parseInt(id.substring(colon+1));
      if (!isNaN(shape_id)) ret.shape_id = shape_id;

      return ret;
    }

    /**
     * All this routine does after switching to omero marshal json
     * is to extract the type in a easily readable/comparable manner
     * as well as setting the ids from the oldId after saving and
     * rewritting unattached dimensions to use -1 internally
     *
     * @static
     * @param {object} shape a shape definition in omero marshal json
     * @return {object} an amended shape definition
     */
    static amendShapeDefinition(shape) {
      if (typeof shape !== 'object' || shape === null ||
          typeof shape['@type'] !== 'string') return null;

      // add pure type without schema info
      let typePos = shape['@type'].lastIndexOf("#");
      if (typePos === -1) return; // we really need this info
      let type = shape['@type'].substring(typePos + 1).toLowerCase();
      shape.type = type;

      // use permissions
      if (typeof shape['omero:details'] === 'object' &&
          shape['omero:details'] !== null) {
              if (typeof shape['omero:details']['permissions'] === 'object' &&
              shape['omero:details']['permissions'] !== null) {
                  shape.permissions =
                        Object.assign({}, shape['omero:details']['permissions']);
              }
              if (typeof shape['omero:details']['owner'] === 'object' &&
                  shape['omero:details']['owner'] !== null) {
                      let firstName =
                          typeof shape['omero:details']['owner']['FirstName'] === 'string' ?
                              shape['omero:details']['owner']['FirstName'] : '';
                      let lastName =
                          typeof shape['omero:details']['owner']['LastName'] === 'string' ?
                              shape['omero:details']['owner']['LastName'] : '';
                      let user =
                          typeof shape['omero:details']['owner']['UserName'] === 'string' ?
                              shape['omero:details']['owner']['UserName'] : '';
                      shape.owner = (firstName === '' && lastName === '') ?
                          user : firstName + " " + lastName;
              }
              delete shape['omero:details'];
      }

      // if there is an oldId (after storage), set ids from it
      let ids = Converters.extractRoiAndShapeId(shape.oldId);
      if (ids.shape_id !== null) {
        shape.shape_id = shape.oldId;
        shape['@id'] = ids.shape_id;
      }

      // unattached dimensions will be treated as -1 internally
      ['TheZ', 'TheT', 'TheC'].map((d) => {
        if (typeof shape[d] !== 'number') shape[d] = -1;
      });

      // initialize area/length info (if not there)
      if (typeof shape.Length !== 'number') shape.Length = -1;
      if (typeof shape.Area !== 'number') shape.Area = -1;

      return shape;
    }

    /**
     * Takes a css color string in hex notation and returns the RGB int values
     * (or null if malformed)
     * @static
     * @param {string} color a css color string (hex)
     * @return {Array.<number>|null} an array with 3 entries (RGB) or null
     */
    static convertHexColorToRGB(color) {
         if (typeof color !== 'string') return null;
         let len = color.length;
         if (len === 4 || len === 7) {
             color = color.substring(1);
             len--;
         }
         if (len !== 3 && len !== 6) return null;
         let stride = len / 3;
         let ret = [];
         for (let p=0;p<len;p+=stride) {
             let val = parseInt(color.substring(p, p+stride), 16);
             if (isNaN(val)) return null;
             ret.push(val);
         }
         return ret;
     }
}
