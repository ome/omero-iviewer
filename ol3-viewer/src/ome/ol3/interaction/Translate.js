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
    this.handleDragEvent_ = ome.ol3.interaction.Translate.handleDragEvent_;
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
            this.translatedFeatures_ = [];
            var features = event.features.array_;
            for (var x=0;x<features.length;x++) {
                var f = features[x];
                if (typeof f['permissions'] === 'object' &&
                    f['permissions'] !== null &&
                    typeof f['permissions']['canEdit'] === 'boolean' &&
                    !f['permissions']['canEdit']) continue;
                this.translatedFeatures_.push(f);
            }
        }, this);

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
    var filtered = [];
    var ids = [];
    for (var x=0;x<featuresTranslated.length;x++) {
        var f = featuresTranslated[x];
        if (typeof f['permissions'] === 'object' &&
            f['permissions'] !== null &&
            typeof f['permissions']['canEdit'] === 'boolean' &&
            !f['permissions']['canEdit']) continue;
        if (f.getGeometry() instanceof ome.ol3.geom.Label)
            f.getGeometry().modifyOriginalCoordinates(
                event.target.getMap().getView().getRotation(),
                event.target.getMap().getView().getResolution()
            );
        filtered.push(f);
        ids.push(f.getId());
    }

    if (this.hist_id_ < 0) return;

    // complete history entry
    this.regions_.addHistory(filtered, false, this.hist_id_);
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
 * @param {ol.MapBrowserPointerEvent} event Event.
 * @this {ol.interaction.Translate}
 * @private
 */
ome.ol3.interaction.Translate.handleDragEvent_ = function(event) {
  if (this.lastCoordinate_) {
    var newCoordinate = event.coordinate;
    var deltaX = newCoordinate[0] - this.lastCoordinate_[0];
    var deltaY = newCoordinate[1] - this.lastCoordinate_[1];

    var features = this.features_ || new ol.Collection([this.lastFeature_]);
    var filteredFeatures = new ol.Collection();

    var featuresArray = features.getArray();
    for (var x=0;x<featuresArray.length;x++) {
        var feature = featuresArray[x];
        if (typeof feature['permissions'] === 'object' &&
            feature['permissions'] !== null &&
            typeof feature['permissions']['canEdit'] === 'boolean' &&
            !feature['permissions']['canEdit']) continue;
        var geom = feature.getGeometry();
        geom.translate(deltaX, deltaY);
        feature.setGeometry(geom);
        filteredFeatures.push(feature);
    }

    this.lastCoordinate_ = newCoordinate;
    this.dispatchEvent(
        new ol.interaction.Translate.Event(
            ol.interaction.TranslateEventType.TRANSLATING, filteredFeatures,
            newCoordinate));
  }
};

/**
 * Tests to see if the given coordinates intersects any of our features
 * as well as a permissions check
 * @param {ol.Coordinate} coord coordinate to test for intersection.
 * @return {ol.Feature} Returns the feature found at the specified pixel
 * coordinates.
 * @private
 */
ome.ol3.interaction.Translate.prototype.featuresAtCoords_ = function(coord) {
    var hit = this.regions_.select_.featuresAtCoords_(coord, 5);
    if (hit === null || !(this.features_ instanceof ol.Collection) ||
        !ol.array.includes(this.features_.getArray(), hit) ||
            (typeof hit['permissions'] === 'object' &&
            hit['permissions'] !== null &&
            typeof hit['permissions']['canEdit'] === 'boolean' &&
            !hit['permissions']['canEdit']) ||
            (typeof this.regions_['is_modified'] === 'boolean' &&
            this.regions_['is_modified']))
                return null;
    return hit;
};

/**
 * a sort of desctructor
 */
ome.ol3.interaction.Translate.prototype.disposeInternal = function() {
    this.features_  = null;
    this.regions_ = null;
}
