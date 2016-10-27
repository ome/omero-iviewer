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

	// call super
    goog.base(this, {});

	// we use our event handlers altogether
	this.handleDownEvent_ = ome.ol3.interaction.Translate.handleDownEvent_;
	this.handleMoveEvent_ = ome.ol3.interaction.Translate.handleMoveEvent_;
	this.handleUpEvent_ = ome.ol3.interaction.Translate.handleUpEvent_;

	/**
   * @type {string|null}
   * @private
   */
  this.previousCursor_ = null;

	/**
   * @type {ol.Collection.<ol.Feature>}
   * @private
   */
  this.features_ = this.regions_.select_.getFeatures();

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
    if (ids.length > 0) this.regions_.setProperty(
        ids, "state", ome.ol3.REGIONS_STATE.MODIFIED);
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

  this.lastFeature_ = this.featuresAtCoords_(mapBrowserEvent.coordinate);
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

  var elem = mapBrowserEvent.map.getTargetElement();
  var intersectingFeature = this.featuresAtCoords_(mapBrowserEvent.coordinate);

  if (intersectingFeature) {
    var isSelected = false;

    if (this.features_ &&
        ol.array.includes(this.features_.getArray(), intersectingFeature)) {
      isSelected = true;
    }

    this.previousCursor_ = elem.style.cursor;
    // WebKit browsers don't support the grab icons without a prefix
    elem.style.cursor = this.lastCoordinate_ ?
        '-webkit-grabbing' : '-webkit-grab';

       // Thankfully, attempting to set the standard ones will silently fail,
       // keeping the prefixed icons
       elem.style.cursor = this.lastCoordinate_ ?  'grabbing' : 'grab';
  } else {
    elem.style.cursor = this.previousCursor_ !== null ?
        this.previousCursor_ : '';
    this.previousCursor_ = null;
  }
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
    if (!ome.ol3.utils.Misc.isArray(coord) || coord.length !== 2) return;

    var extent = [coord[0]-1, coord[1]-1, coord[0]+1, coord[1]+1];
    var hits = [];
    this.features_.forEach(function(feature) {
        if (feature.getGeometry() &&
            (typeof feature['visible'] !== 'boolean' || feature['visible']) &&
                (typeof feature['state'] !== 'number' ||
                    feature['state'] !== ome.ol3.REGIONS_STATE.REMOVED) &&
                    feature.getGeometry().intersectsExtent(extent))
            hits.push(feature);
    });
    var found = ome.ol3.utils.Misc.featuresAtCoords(hits);

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
