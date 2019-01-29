
import JSONFeature from 'ol/format/JSONFeature';
import {featureFactory} from '../utils/Regions';
import {Fill, Stroke, Style} from 'ol/style.js';

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
    let shapesJSON = responseJSON.data;

    let features = shapesJSON.map((shape) => {
      shape.type = shape['@type'].split('#')[1].toLowerCase();
      let feature = featureFactory(shape);
      feature.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#f00',
            width: 2
          })
        })
      );
      return feature;
    });

    return features;
  };

  readProjection(source) {
    return this.projection;
  }
}

export default OmeJSON;
