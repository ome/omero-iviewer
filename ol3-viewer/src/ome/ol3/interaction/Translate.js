goog.provide('ome.ol3.interaction.Translate');

goog.require('ol.interaction.Translate');
goog.require('ol.Collection');

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.Translate}
 * @param {ome.ol3.source.Regions} regions_reference an Regions instance.
 */
ome.ol3.interaction.Translate = function(regions_reference) {
	// we do need the regions reference to do translations
    if (!(regions_reference instanceof ome.ol3.source.Regions))
        console.error("Translate needs Regions instance!");

	/**
   * @type {ome.ol3.source.Regions}
   * @private
   */
   this.regions_ = regions_reference;

    /**
   * @type {number}
   * @private
   */
   this.hist_id_ = -1;

	// call super
    goog.base(this, {});

	// we use our event handlers altogether
	this.handleDownEvent_ = ome.ol3.interaction.Translate.handleDownEvent_;
	this.handleMoveEvent_ = ome.ol3.interaction.Translate.handleMoveEvent_;
	this.handleUpEvent_ = ome.ol3.interaction.Translate.handleUpEvent_;

	/**
   * @type {ol.Collection.<ol.Feature>}
   * @private
   */
  this.features_ = this.regions_.select_.getFeatures();

  // a listener to react on translate start
  ol.events.listen(
      this,
      ol.interaction.Translate.EventType.TRANSLATESTART,
      ome.ol3.interaction.Translate.prototype.handleTranslateStart,
      this);

	// a listener to react on translate end
	ol.events.listen(
		this,
		ol.interaction.Translate.EventType.TRANSLATEEND,
		ome.ol3.interaction.Translate.prototype.handleTranslateEnd,
		this);
};
goog.inherits(ome.ol3.interaction.Translate, ol.interaction.Translate);

/**
 * We want to react to the end of translation for some features
 * @param {ol.interaction.Translate.Event} event a translate event.
 */
ome.ol3.interaction.Translate.prototype.handleTranslateEnd = function(event) {
	var featuresTranslated = event.features.array_;
    var ids = [];
	for (var f in featuresTranslated) {
		if (featuresTranslated[f].getGeometry() instanceof ome.ol3.geom.Label)
			featuresTranslated[f].getGeometry().modifyOriginalCoordinates(
				event.target.getMap().getView().getRotation(),
				event.target.getMap().getView().getResolution()
			);
        ids.push(featuresTranslated[f].getId());
	}
    // complete history entry
    if (this.hist_id_ >= 0) {
        this.regions_.addHistory(featuresTranslated, false, this.hist_id_);
        this.regions_.sendHistoryNotification(this.hist_id_);
        this.hist_id_ = -1; // reset
    }
    // set modified flag
    if (ids.length > 0) this.regions_.setProperty(
        ids, "state", ome.ol3.REGIONS_STATE.MODIFIED);
}

/**
 * We want to react to the start of translation for some features
 * @param {ol.interaction.Translate.Event} event a translate event.
 */
ome.ol3.interaction.Translate.prototype.handleTranslateStart = function(event) {
    // start the history for the translate, snapshotting the geometry as is
    this.hist_id_ = this.regions_.addHistory(event.features.array_, true);
}

/**
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Start drag sequence?
 * @this {ol.interaction.Translate}
 * @private
 */
ome.ol3.interaction.Translate.handleDownEvent_ = function(mapBrowserEvent) {
	// short circuit right for click context menu
	if (!(mapBrowserEvent instanceof ol.MapBrowserPointerEvent) ||
			(mapBrowserEvent.originalEvent instanceof MouseEvent &&
				typeof(mapBrowserEvent.originalEvent.which) === 'number' &&
				mapBrowserEvent.originalEvent.which === 3))
		return false;

  this.lastFeature_ = this.featuresAtCoords_(mapBrowserEvent.pixel);
  if (!this.lastCoordinate_ && this.lastFeature_) {
    this.lastCoordinate_ = mapBrowserEvent.coordinate;
    ome.ol3.interaction.Translate.handleMoveEvent_.call(this, mapBrowserEvent);
    this.dispatchEvent(
        new ol.interaction.Translate.Event(
            ol.interaction.Translate.EventType.TRANSLATESTART, this.features_,
            mapBrowserEvent.coordinate));
    return true;
  }
  return false;
};

/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @this {ol.interaction.Translate}
 * @private
 */
ome.ol3.interaction.Translate.handleMoveEvent_ = function(mapBrowserEvent) {
	// short circuit right for click context menu
	if (!(mapBrowserEvent instanceof ol.MapBrowserPointerEvent) ||
			(mapBrowserEvent.originalEvent instanceof MouseEvent &&
				typeof(mapBrowserEvent.originalEvent.which) === 'number' &&
				mapBrowserEvent.originalEvent.which === 3))
		return;
};

/**
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Stop drag sequence?
 * @this {ol.interaction.Translate}
 * @private
 */
ome.ol3.interaction.Translate.handleUpEvent_ = function(mapBrowserEvent) {
	// short circuit right for click context menu
	if (!(mapBrowserEvent instanceof ol.MapBrowserPointerEvent) ||
			(mapBrowserEvent.originalEvent instanceof MouseEvent &&
				typeof(mapBrowserEvent.originalEvent.which) === 'number' &&
				mapBrowserEvent.originalEvent.which === 3))
		return true;

  if (this.lastCoordinate_) {
    this.lastCoordinate_ = null;
    ome.ol3.interaction.Translate.handleMoveEvent_.call(this, mapBrowserEvent);
    this.dispatchEvent(
        new ol.interaction.Translate.Event(
            ol.interaction.Translate.EventType.TRANSLATEEND, this.features_,
            mapBrowserEvent.coordinate));
    return true;
  }
  return false;
};

/**
 * Tests to see if the given coordinates intersects any of our features.
 * @param {ol.Coordinate} coord coordinate to test for intersection.
 * @return {ol.Feature} Returns the feature found at the specified pixel
 * coordinates.
 * @private
 */
ome.ol3.interaction.Translate.prototype.featuresAtCoords_ = function(coord) {
    var found = this.regions_.select_.featuresAtCoords_(coord);

    if (this.features_ &&
        ol.array.includes(this.features_.getArray(), found)) return found;
    else return null;
};

/**
 * a sort of desctructor
 */
ome.ol3.interaction.Translate.prototype.disposeInternal = function() {
	this.features_  = null;
	this.regions_ = null;
}
