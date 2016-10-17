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
	 * list available units for display incl. symbol and
     * micron multiplicator
	 *
	 * @type {Array.<objects>}
	 * @private
	 */
    this.UNITS = [
        { unit: 'micron', multiplier: 1, symbol: 'µm'},
        { unit: 'millimeter', multiplier: 1000, symbol: 'mm'}];

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

  var micronsPerUnit = viewState.projection.getMetersPerUnit();
  var resolution = viewState.resolution;

  var totalMicronsForBarWidth =
    micronsPerUnit * this.bar_width_ * resolution;
  var choosenUnit = this.UNITS[0];
  for (var u=0;u<this.UNITS.length;u++) {
      if (u+1 === this.UNITS.length) break;

      var nextUnit = this.UNITS[u+1];
      if (totalMicronsForBarWidth / nextUnit.multiplier > 1) {
          choosenUnit = nextUnit;
          totalMicronsForBarWidth /= nextUnit.multiplier;
          continue;
      }
      break;
  }

  var html = totalMicronsForBarWidth.toFixed(5) + ' ' + choosenUnit.symbol;
  if (this.renderedHTML_ != html) {
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
