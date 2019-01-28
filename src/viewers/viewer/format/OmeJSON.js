
import JSONFeature from 'ol/format/JSONFeature';
import {featureFactory} from '../utils/Regions';
import {Fill, Stroke, Style} from 'ol/style.js';

const testShape = {
  "FontStyle": "Normal",
  "Locked": false,
  "Width": 10085,
  "omero:details": {
  "owner": {
  "UserName": "will",
  "FirstName": "Will",
  "MiddleName": "J",
  "omero:details": {
  "@type": "TBD#Details",
  "permissions": {
  "isUserWrite": true,
  "isWorldWrite": false,
  "canDelete": false,
  "isWorldRead": false,
  "perm": "rw----",
  "canEdit": false,
  "canAnnotate": false,
  "isGroupAnnotate": false,
  "isGroupWrite": false,
  "canLink": false,
  "isUserRead": true,
  "@type": "TBD#Permissions",
  "isGroupRead": false
  }
  },
  "Email": "",
  "LastName": "Moöre",
  "@id": 3,
  "@type": "http://www.openmicroscopy.org/Schemas/OME/2016-06#Experimenter"
  },
  "group": {
  "omero:details": {
  "@type": "TBD#Details",
  "permissions": {
  "isUserWrite": true,
  "isWorldWrite": false,
  "canDelete": false,
  "isWorldRead": false,
  "perm": "rwra--",
  "canEdit": false,
  "canAnnotate": false,
  "isGroupAnnotate": true,
  "isGroupWrite": false,
  "canLink": false,
  "isUserRead": true,
  "@type": "TBD#Permissions",
  "isGroupRead": true
  }
  },
  "@id": 5,
  "@type": "http://www.openmicroscopy.org/Schemas/OME/2016-06#ExperimenterGroup",
  "Name": "read-ann"
  },
  "@type": "TBD#Details",
  "permissions": {
  "isUserWrite": true,
  "isWorldWrite": false,
  "canDelete": true,
  "isWorldRead": false,
  "perm": "rwra--",
  "canEdit": true,
  "canAnnotate": true,
  "isGroupAnnotate": true,
  "isGroupWrite": false,
  "canLink": true,
  "isUserRead": true,
  "@type": "TBD#Permissions",
  "isGroupRead": true
  }
  },
  "Height": 5007,
  "FontFamily": "sans-serif",
  "StrokeWidth": {
  "Symbol": "pixel",
  "Value": 1,
  "@type": "TBD#LengthI",
  "Unit": "PIXEL"
  },
  "FontSize": {
  "Symbol": "pt",
  "Value": 12,
  "@type": "TBD#LengthI",
  "Unit": "POINT"
  },
  "FillColor": 1073741824,
  "Y": 2007,
  "X": 1097,
  "StrokeColor": -993737532,
  "TheT": 0,
  "@id": 701,
  "@type": "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle",
  "TheZ": 1
  }
/**
 * @classdesc
 * Feature format for reading and writing data in the OME JSON format.
 *
  * @api
 */
class OmeJSON extends JSONFeature {

  /**
   * @param {Options=} opt_options Options.
   */
  constructor(opt_options) {

    const options = opt_options ? opt_options : {};

    super();

    this.projection = options.projection;

    /**
     * @inheritDoc
     */
    // this.dataProjection = getProjection(
    //   options.dataProjection ?
    //     options.dataProjection : 'EPSG:4326');

    // if (options.featureProjection) {
    //   this.defaultFeatureProjection = getProjection(options.featureProjection);
    // }

  }

  /**
   * @inheritDoc
   */
  readFeatureFromObject(object, opt_options) {
        console.log('readFeatureFromObject');
  }

  /**
   * @inheritDoc
   */
  readFeaturesFromObject(object, opt_options) {
    console.log('readFeaturesFromObject');
  }

  readFeatures(source, opt_options) {
    let responseJSON = JSON.parse(source);
    let roisJSON = responseJSON.data;
    let roi = roisJSON[3];
    let shape = roi.shapes[0];
    // let shape = testShape;
    shape.type = shape['@type'].split('#')[1].toLowerCase();
    let feature = featureFactory(shape);

    feature.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#f00',
            width: 20
          })
        })
    );

    return [feature];
  };

  readProjection(source) {
    return this.projection;
  }
}

export default OmeJSON;
