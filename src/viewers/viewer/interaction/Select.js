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

import Feature from 'ol/Feature';
import Interaction from 'ol/interaction/Interaction';
import Collection from 'ol/Collection';
import {includes} from 'ol/array';
import {inherits} from 'ol/util';
import {TRUE} from 'ol/functions';
import {shiftKeyOnly,
    pointerMove,
    click} from 'ol/events/condition';
import Regions from '../source/Regions';
import {isArray,
    featuresAtCoords} from '../utils/Misc';

/**
 * @classdesc
 * Implements a leaner version of the standard open layers select without an extra
 * layer
 *
 * @constructor
 * @extends {ol.interaction.Interaction}
 * @param {source.Regions} regions_reference a reference to Regions
 */
const Select = function(regions_reference) {
    // we do need the regions reference to get the (selected) rois
    if (!(regions_reference instanceof Regions))
        console.error("Select needs Regions instance!");

    /**
     * a reference to the Regions instance
     * @private
     * @type {source.Regions}
     */
    this.regions_ = regions_reference;

    // call super
    // goog.base(this, {});
    Interaction.call(this, {});
    this.handleEvent = Select.handleEvent;

    /**
     * use click event
     * @private
     * @type {ol.events.ConditionType}
     */
    this.condition_ =  function(mapBrowserEvent) {
        return click.call(regions_reference.select_, mapBrowserEvent);
    };

    /**
     * this is where the selected features go
     * @private
     * @type {ol.Collection}
     */
    this.features_ = new Collection();

    // we only want it to apply to our layer
    var regionsLayer = this.regions_.viewer_.getRegionsLayer();
    /**
     * @private
     * @type {ol.interaction.SelectFilterFunction}
     */
    this.layerFilter_ = function(layer) {
        return includes([regionsLayer], layer);
    }

    /**
     * @private
     * @type {ol.interaction.SelectFilterFunction}
     */
    this.filter_ = TRUE;
};
inherits(Select, Interaction);

/**
 * Clears/unselects all selected features
 *
 */
Select.prototype.clearSelection = function() {
    // delegate
    var ids = []
    this.getFeatures().forEach(
        function(feature) {
            ids.push(feature.getId());
    }, this);
    if (ids.length > 0) this.regions_.setProperty(ids, "selected", false);
}

/**
 * Handles the {@link ol.MapBrowserEvent map browser event} and may change the
 * selected state of features.
 * @param {ol.MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} `false` to stop event propagation.
 * @this {ol.interaction.Select}
 * @api
 */
Select.handleEvent = function(mapBrowserEvent) {
    if (!this.condition_(mapBrowserEvent) || mapBrowserEvent.dragging) {
        return true;
    }

    var selected = this.featuresAtCoords_(mapBrowserEvent.pixel);

    var oldSelectedFlag =
        selected && typeof selected['selected'] === 'boolean' ?
            selected['selected'] : false;
    if (selected === null || !shiftKeyOnly(mapBrowserEvent)) {
        this.clearSelection();
        if (selected === null) return;
    }
    this.regions_.setProperty([selected.getId()], "selected", !oldSelectedFlag);

    return pointerMove(mapBrowserEvent);
};

/**
 * Tests to see if the given coordinates intersects any of our features.
 * @param {Array.<number>} pixel pixel coordinate to test for intersection.
 * @param {number} tolerance a pixel tolerance/buffer
 * @param {boolean} use_already_selected will only consider already selected
 * @return {ol.Feature} Returns the feature found at the specified pixel
 *                      coordinates.
 */
Select.prototype.featuresAtCoords_ =
    function(pixel, tolerance, use_already_selected) {
    if (!isArray(pixel) || pixel.length !== 2) return;

    if (typeof tolerance !== 'number') tolerance = 5; // 5 pixel buffer
    if (typeof use_already_selected !== 'boolean') use_already_selected = false;
    var v = this.regions_.viewer_.viewer_;
    var min = v.getCoordinateFromPixel(
                [pixel[0]-tolerance, pixel[1]+tolerance]);
    var max = v.getCoordinateFromPixel(
            [pixel[0]+tolerance, pixel[1]-tolerance]);
    var extent = [min[0], min[1], max[0], max[1]];
    var hits = [];

    var alreadySelected = this.features_.getArray();
    this.regions_.forEachFeatureInExtent(
        extent, function(feat) {
            if (feat.getGeometry().intersectsExtent(extent)) {
                if (!use_already_selected ||
                    (use_already_selected &&
                        includes(alreadySelected, feat))) hits.push(feat);
            }
        });

    return featuresAtCoords(hits);
};

/**
 * Getter for the selected features
 *
 * @return {ol.Collection} the selected features
 */
Select.prototype.getFeatures = function() {
    return this.features_;
}

/**
 * De/Selects a feature
 *
 * @param {ol.Feature} feature the feature to be (de)selected
 * @param {boolean} select if true we want to select, otherwise deselect,
 *                   the former being default
 * @param {boolean=} remove_first on select we remove first to make sure that we
 *                   don't add twice
 */
 Select.prototype.toggleFeatureSelection =
    function(feature, select, remove_first) {
     if (!(feature instanceof Feature)) return;

     if (typeof select !== 'boolean' || select) {
         if (typeof remove_first === 'boolean' && remove_first)
            this.getFeatures().remove(feature);
         feature['selected'] = true;
         this.getFeatures().push(feature);
     } else {
         feature['selected'] = false;
         this.getFeatures().remove(feature);
     }
}

/**
 * a sort of desctructor
 */
Select.prototype.disposeInternal = function() {
    this.regions_ = null;
}

export default Select;
