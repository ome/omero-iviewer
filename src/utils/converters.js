import {noView} from 'aurelia-framework';

/**
 * A converter
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
