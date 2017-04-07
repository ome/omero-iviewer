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
     * @type {Array.<ol.Feature>}
     * @private
     */
    this.translatedFeatures_ = [];

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
        ol.interaction.TranslateEventType.TRANSLATESTART,
        function(event) {
            this.translatedFeatures_ = event.features.array_;
        },
        this);

    // a listener to note whether there was an actual translate ...
    ol.events.listen(
        this,
        ol.interaction.TranslateEventType.TRANSLATING,
        function(event) {
            // start the history for the translate
            // if we haven't done so already
            if (this.hist_id_ >= 0 ||
                this.translatedFeatures_.length === 0) return;
            this.hist_id_ =
                this.regions_.addHistory(this.translatedFeatures_, true);
        }, this);

    // a listener to react on translate end
    ol.events.listen(
        this,
        ol.interaction.TranslateEventType.TRANSLATEEND,
        ome.ol3.interaction.Translate.prototype.handleTranslateEnd,
        this);
};
goog.inherits(ome.ol3.interaction.Translate, ol.interaction.Translate);

/**
 * We want to react to the end of translation for some features
 * @param {ol.interaction.Translate.Event} event a translate event.
 */
ome.ol3.interaction.Translate.prototype.handleTranslateEnd = function(event) {
    // reset original feature array
    this.translatedFeatures_ = [];

    // snapshot present features
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

    if (this.hist_id_ < 0) return;

    // complete history entry
    this.regions_.addHistory(featuresTranslated, false, this.hist_id_);
    this.regions_.sendHistoryNotification(this.hist_id_);
    this.hist_id_ = -1; // reset

    // set modified flag
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
        mapBrowserEvent.originalEvent.which === 3)) return false;

    this.lastFeature_ = this.featuresAtCoords_(mapBrowserEvent.pixel);
    if (!this.lastCoordinate_ && this.lastFeature_) {
        this.lastCoordinate_ = mapBrowserEvent.coordinate;
        ome.ol3.interaction.Translate.handleMoveEvent_.call(
            this, mapBrowserEvent);
        this.dispatchEvent(
            new ol.interaction.Translate.Event(
                ol.interaction.TranslateEventType.TRANSLATESTART,
                this.features_, mapBrowserEvent.coordinate));
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
        mapBrowserEvent.originalEvent.which === 3)) return;
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
        mapBrowserEvent.originalEvent.which === 3)) return true;

    if (this.lastCoordinate_) {
        this.lastCoordinate_ = null;
        ome.ol3.interaction.Translate.handleMoveEvent_.call(
            this, mapBrowserEvent);
        this.dispatchEvent(
            new ol.interaction.Translate.Event(
                ol.interaction.TranslateEventType.TRANSLATEEND,
                this.features_, mapBrowserEvent.coordinate));
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
    var hit = this.regions_.select_.featuresAtCoords_(coord, 5);
    if (hit === null || !(this.features_ instanceof ol.Collection) ||
        !ol.array.includes(this.features_.getArray(), hit) ||
        (typeof this.regions_['is_modified'] === 'boolean' &&
            this.regions_['is_modified'])) return null;
    return hit;
};

/**
 * a sort of desctructor
 */
ome.ol3.interaction.Translate.prototype.disposeInternal = function() {
    this.features_  = null;
    this.regions_ = null;
}
