goog.provide('ome.ol3.controls.ScaleBar');

goog.require('ol.control.ScaleLine');

/**
 * @classdesc
 * Extends the built ScaleLine
 *
 * @constructor
 * @extends {ol.control.ScaleLine}
 * @param {Object} opt_options optional options
 */
ome.ol3.controls.ScaleBar = function(opt_options) {
    if (typeof(opt_options) !== 'object') opt_options = {};

    /**
     * list available units for display incl. symbol, threshold for usage
     * and micron multiplication factor
     *
     * @type {Array.<objects>}
     * @private
     */
    this.UNITS = [
        { unit: 'angstrom',
          threshold: 0.1, multiplier: 10000, symbol: '\u212B'},
        { unit: 'nanometer',
          threshold: 1, multiplier: 1000, symbol: 'nm'},
        { unit: 'micron',
          threshold: 1000, multiplier: 1, symbol:  '\u00B5m'},
        { unit: 'millimeter',
          threshold: 100000, multiplier: 0.001, symbol: 'mm'},
        { unit: 'centimeter',
          threshold: 1000000, multiplier: 0.0001, symbol: 'cm'},
        { unit: 'meter',
          threshold: 100000000, multiplier: 0.000001, symbol: 'm'}];

    /**
     * default scale bar width in pixels
     * @type {number}
     * @private
     */
    this.bar_width_ = 100;

    goog.base(this, opt_options);
}
goog.inherits(ome.ol3.controls.ScaleBar, ol.control.ScaleLine);

/**
 * Overridden to deal with mere pixel to unit issues instead of geographic
 * projections
 * @private
 */
ome.ol3.controls.ScaleBar.prototype.updateElement_ = function() {
  var viewState = this.viewState_;

  if (!viewState) {
    if (this.renderedVisible_) {
      this.element_.style.display = 'none';
      this.renderedVisible_ = false;
    }
    return;
  }

  var micronsPerPixel = viewState.projection.getMetersPerUnit();
  var resolution = viewState.resolution;
  var scaleBarLengthInUnits = micronsPerPixel * this.bar_width_ * resolution;
  var symbol = '\u00B5m';
  for (var u=0;u<this.UNITS.length;u++) {
      var unit = this.UNITS[u];
      if (scaleBarLengthInUnits < unit.threshold) {
          scaleBarLengthInUnits *= unit.multiplier;
          symbol = unit.symbol;
          break;
      }
  }

  var html = scaleBarLengthInUnits.toFixed(5) + ' ' + symbol;
  if (this.renderedHTML_ !== html) {
    this.innerElement_.innerHTML = html;
    this.renderedHTML_ = html;
  }

  if (this.renderedWidth_ != this.bar_width_) {
    this.innerElement_.style.width = this.bar_width_ + 'px';
    this.renderedWidth_ = this.bar_width_;
  }

  if (!this.renderedVisible_) {
    this.element_.style.display = '';
    this.renderedVisible_ = true;
  }
};
