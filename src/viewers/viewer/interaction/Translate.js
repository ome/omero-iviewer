//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import OlTranslate from 'ol/interaction/Translate';
import {TranslateEvent} from 'ol/interaction/Translate';
import Collection from 'ol/Collection';
import {listen} from 'ol/events';
import {inherits} from 'ol/util';
import Regions from '../source/Regions';
import Mask from '../geom/Mask';
import Label from '../geom/Label';
import {sendEventNotification} from '../utils/Misc';
import {REGIONS_STATE} from '../globals';

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.Translate}
 * @param {source.Regions} regions_reference an Regions instance.
 */
const Translate = function(regions_reference) {
    // we do need the regions reference to do translations
    if (!(regions_reference instanceof Regions))
        console.error("Translate needs Regions instance!");

    /**
     * @type {source.Regions}
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
    // goog.base(this, {});
    OlTranslate.call(this, {});

    // we use our event handlers altogether
    this.handleDownEvent_ = Translate.handleDownEvent_;
    this.handleMoveEvent_ = Translate.handleMoveEvent_;
    this.handleDragEvent_ = Translate.handleDragEvent_;
    this.handleUpEvent_ = Translate.handleUpEvent_;

    /**
     * @type {Collection.<ol.Feature>}
     * @private
     */
    this.features_ = this.regions_.select_.getFeatures();

    // a listener to react on translate start
    listen(
        this,
        'translatestart',  // ol.interaction.TranslateEventType.TRANSLATESTART,
        function(event) {
            this.translatedFeatures_ = [];
            var features = event.features.array_;
            for (var x=0;x<features.length;x++) {
                var f = features[x];
                if (f.getGeometry() instanceof Mask ||
                    (typeof f['permissions'] === 'object' &&
                    f['permissions'] !== null &&
                    typeof f['permissions']['canEdit'] === 'boolean' &&
                    !f['permissions']['canEdit'])) continue;
                var clonedF = f.clone();
                clonedF.setId(f.getId());
                this.translatedFeatures_.push(clonedF);
            }
        }, this);

    // a listener to note whether there was an actual translate ...
    listen(
        this,
        'translating',  // ol.interaction.TranslateEventType.TRANSLATING,
        function(event) {
            // start the history for the translate
            // if we haven't done so already
            if (this.hist_id_ >= 0 ||
                this.translatedFeatures_.length === 0) return;
            this.hist_id_ =
                this.regions_.addHistory(this.translatedFeatures_, true);
        }, this);

    // a listener to react on translate end
    listen(
        this,
        'translateend',  // ol.interaction.TranslateEventType.TRANSLATEEND,
        Translate.prototype.handleTranslateEnd,
        this);
};
inherits(Translate, OlTranslate);

/**
 * We want to react to the end of translation for some features
 * @param {ol.interaction.Translate.Event} event a translate event.
 */
Translate.prototype.handleTranslateEnd = function(event) {
    // reset original feature array
    this.translatedFeatures_ = [];

    // snapshot present features
    var featuresTranslated = event.features.array_;
    var filtered = [];
    var ids = [];
    for (var x=0;x<featuresTranslated.length;x++) {
        var f = featuresTranslated[x];
        if (f.getGeometry() instanceof Mask ||
            (typeof f['permissions'] === 'object' &&
            f['permissions'] !== null &&
            typeof f['permissions']['canEdit'] === 'boolean' &&
            !f['permissions']['canEdit'])) continue;
        if (f.getGeometry() instanceof Label)
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
    sendEventNotification(
        this.regions_.viewer_,
        "REGIONS_HISTORY_ENTRY", {"hist_id": this.hist_id_, "shape_ids": ids});
    this.hist_id_ = -1; // reset

    // set modified flag
    if (ids.length > 0) this.regions_.setProperty(
        ids, "state", REGIONS_STATE.MODIFIED);
}

/**
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Start drag sequence?
 * @this {ol.interaction.Translate}
 * @private
 */
Translate.handleDownEvent_ = function(mapBrowserEvent) {
    this.lastFeature_ = this.featuresAtCoords_(mapBrowserEvent.pixel);
    if (!this.lastCoordinate_ && this.lastFeature_) {
        this.lastCoordinate_ = mapBrowserEvent.coordinate;
        Translate.handleMoveEvent_.call(
            this, mapBrowserEvent);
        this.dispatchEvent(
            new TranslateEvent(
                'translatestart',
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
Translate.handleMoveEvent_ = function(mapBrowserEvent) {
    // overridden on purpose to do nothing
};

/**
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Stop drag sequence?
 * @this {ol.interaction.Translate}
 * @private
 */
Translate.handleUpEvent_ = function(mapBrowserEvent) {
    if (this.lastCoordinate_) {
        this.lastCoordinate_ = null;
        Translate.handleMoveEvent_.call(
            this, mapBrowserEvent);
        this.dispatchEvent(
            new TranslateEvent(
                'translateend',
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
Translate.handleDragEvent_ = function(event) {
  if (this.lastCoordinate_) {
    var newCoordinate = event.coordinate;
    var deltaX = newCoordinate[0] - this.lastCoordinate_[0];
    var deltaY = newCoordinate[1] - this.lastCoordinate_[1];

    var features = this.features_ || new Collection([this.lastFeature_]);
    var filteredFeatures = new Collection();

    var featuresArray = features.getArray();
    for (var x=0;x<featuresArray.length;x++) {
        var feature = featuresArray[x];
        if (feature.getGeometry() instanceof Mask ||
            (typeof feature['permissions'] === 'object' &&
            feature['permissions'] !== null &&
            typeof feature['permissions']['canEdit'] === 'boolean' &&
            !feature['permissions']['canEdit'])) continue;
        var geom = feature.getGeometry();
        geom.translate(deltaX, deltaY);
        feature.setGeometry(geom);
        filteredFeatures.push(feature);
    }

    this.lastCoordinate_ = newCoordinate;
    this.dispatchEvent(
        new TranslateEvent(
            'translating', filteredFeatures,
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
Translate.prototype.featuresAtCoords_ = function(coord) {
    var hit = this.regions_.select_.featuresAtCoords_(coord, 5, true);
    if (hit === null || !(this.features_ instanceof Collection) ||
        hit.getGeometry() instanceof Mask ||
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
Translate.prototype.disposeInternal = function() {
    this.features_  = null;
    this.regions_ = null;
}

export default Translate;
