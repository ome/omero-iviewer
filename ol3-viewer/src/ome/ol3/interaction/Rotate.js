goog.provide('ome.ol3.interaction.Rotate');

goog.require('ol.events.condition');
goog.require('ol.interaction.DragRotate');

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.DragRotate}
 */
ome.ol3.interaction.Rotate = function() {
  goog.base(this);

	/**
   * @private
   * @type {ol.events.ConditionType}
   */
	this.condition_ = ol.events.condition.shiftKeyOnly;
};
goog.inherits(ome.ol3.interaction.Rotate, ol.interaction.DragRotate);
