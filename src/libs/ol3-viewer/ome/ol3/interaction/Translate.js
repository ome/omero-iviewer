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


import BaseTranslate from 'ol/interaction/translate';
import Collection from "ol/collection";
import Events from "ol/events";

import {REGIONS_STATE} from "../Globals";
import Regions from "../source/Regions";
import Mask from "../geom/Mask";
import Label from "../geom/Label";
import * as MiscUtils from "../utils/Misc";

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.Translate}
 * @param {ome.ol3.source.Regions} regions_reference an Regions instance.
 */
export default class Translate extends BaseTranslate {
    constructor(regions_reference) {
        // we do need the regions reference to do translations
        if (!(regions_reference instanceof Regions))
            console.error("Translate needs Regions instance!");

        // call super
        super({});

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

        // we use our event handlers altogether
        // this.handleDownEvent_ = ome.ol3.interaction.Translate.handleDownEvent_;
        // this.handleMoveEvent_ = ome.ol3.interaction.Translate.handleMoveEvent_;
        // this.handleDragEvent_ = ome.ol3.interaction.Translate.handleDragEvent_;
        // this.handleUpEvent_ = ome.ol3.interaction.Translate.handleUpEvent_;

        /**
         * @type {ol.Collection.<ol.Feature>}
         * @private
         */
        this.features_ = this.regions_.select_.getFeatures();

        // a listener to react on translate start
        Events.listen(
            this,
            BaseTranslate.TRANSLATESTART,
            function(event) {
                this.translatedFeatures_ = [];
                let features = event.features.array_;
                for (let x=0;x<features.length;x++) {
                    let f = features[x];
                    if (f.getGeometry() instanceof Mask ||
                        (typeof f['permissions'] === 'object' &&
                            f['permissions'] !== null &&
                            typeof f['permissions']['canEdit'] === 'boolean' &&
                            !f['permissions']['canEdit'])) continue;
                    let clonedF = f.clone();
                    clonedF.setId(f.getId());
                    this.translatedFeatures_.push(clonedF);
                }
            }, this);

        // a listener to note whether there was an actual translate ...
        Events.listen(
            this,
            BaseTranslate.TRANSLATING,
            function(event) {
                // start the history for the translate
                // if we haven't done so already
                if (this.hist_id_ >= 0 ||
                    this.translatedFeatures_.length === 0) return;
                this.hist_id_ =
                    this.regions_.addHistory(this.translatedFeatures_, true);
            }, this);

        // a listener to react on translate end
        Events.listen(
            this,
            BaseTranslate.TRANSLATEEND,
            handleTranslateEnd,
            this);
    };

    /**
     * We want to react to the end of translation for some features
     * @param {ol.interaction.Translate.Event} event a translate event.
     */
    handleTranslateEnd(event) {
        // reset original feature array
        this.translatedFeatures_ = [];

        // snapshot present features
        let featuresTranslated = event.features.array_;
        let filtered = [];
        let ids = [];
        for (let x=0;x<featuresTranslated.length;x++) {
            let f = featuresTranslated[x];
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
        MiscUtils.sendEventNotification(
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
    handleDownEvent_ = (mapBrowserEvent) => {
        this.lastFeature_ = this.featuresAtCoords_(mapBrowserEvent.pixel);
        if (!this.lastCoordinate_ && this.lastFeature_) {
            this.lastCoordinate_ = mapBrowserEvent.coordinate;
            this.handleMoveEvent_.call(
                this, mapBrowserEvent);
            this.dispatchEvent(
                new BaseTranslate.Event(
                    BaseTranslate.TRANSLATESTART,
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
    handleMoveEvent_ = (mapBrowserEvent) => {
        // overridden on purpose to do nothing
    };

    /**
     * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
     * @return {boolean} Stop drag sequence?
     * @this {ol.interaction.Translate}
     * @private
     */
    handleUpEvent_ = (mapBrowserEvent) => {
        if (this.lastCoordinate_) {
            this.lastCoordinate_ = null;
            this.handleMoveEvent_.call(
                this, mapBrowserEvent);
            this.dispatchEvent(
                new BaseTranslate.Event(
                    BaseTranslate.TRANSLATEEND,
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
    handleDragEvent_ = (event) => {
        if (this.lastCoordinate_) {
            let newCoordinate = event.coordinate;
            let deltaX = newCoordinate[0] - this.lastCoordinate_[0];
            let deltaY = newCoordinate[1] - this.lastCoordinate_[1];

            let features = this.features_ || new Collection([this.lastFeature_]);
            let filteredFeatures = new Collection();

            let featuresArray = features.getArray();
            for (let x=0;x<featuresArray.length;x++) {
                let feature = featuresArray[x];
                if (feature.getGeometry() instanceof Mask ||
                    (typeof feature['permissions'] === 'object' &&
                        feature['permissions'] !== null &&
                        typeof feature['permissions']['canEdit'] === 'boolean' &&
                        !feature['permissions']['canEdit'])) continue;
                let geom = feature.getGeometry();
                geom.translate(deltaX, deltaY);
                feature.setGeometry(geom);
                filteredFeatures.push(feature);
            }

            this.lastCoordinate_ = newCoordinate;
            this.dispatchEvent(
                new BaseTranslate.Event(
                    BaseTranslate.TRANSLATING, filteredFeatures,
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
    featuresAtCoords_(coord) {
        let hit = this.regions_.select_.featuresAtCoords_(coord, 5, true);
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
    disposeInternal() {
        this.features_  = null;
        this.regions_ = null;
    }
}
