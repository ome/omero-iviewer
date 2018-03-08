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
goog.provide('ome.ol3.interaction.Select');

goog.require('ol.interaction.Interaction')
goog.require('ol.Overlay')
goog.require('ol.Collection')

/**
 * @classdesc
 * Implements a leaner version of the standard open layers select without an extra
 * layer
 *
 * @constructor
 * @extends {ol.interaction.Interaction}
 * @param {ome.ol3.source.Regions} regions_reference a reference to Regions
 */
ome.ol3.interaction.Select = function(regions_reference) {
    // we do need the regions reference to get the (selected) rois
    if (!(regions_reference instanceof ome.ol3.source.Regions))
        console.error("Select needs Regions instance!");

    /**
     * a reference to the Regions instance
     * @private
     * @type {ome.ol3.source.Regions}
     */
    this.regions_ = regions_reference;

    // call super
    goog.base(this, {});
    this.handleEvent = ome.ol3.interaction.Select.handleEvent;

    /**
     * use click event
     * @private
     * @type {ol.events.ConditionType}
     */
    this.condition_ =  function(mapBrowserEvent) {
        return ol.events.condition.click.call(
            regions_reference.select_, mapBrowserEvent);
    };

    /**
     * this is where the selected features go
     * @private
     * @type {ol.Collection}
     */
    this.features_ = new ol.Collection();

    // we only want it to apply to our layer
    var regionsLayer = this.regions_.viewer_.getRegionsLayer();
    /**
     * @private
     * @type {ol.interaction.SelectFilterFunction}
     */
    this.layerFilter_ = function(layer) {
        return ol.array.includes([regionsLayer], layer);
    }

    /**
     * @private
     * @type {ol.interaction.SelectFilterFunction}
     */
    this.filter_ = ol.functions.TRUE;
};
goog.inherits(ome.ol3.interaction.Select, ol.interaction.Interaction);

/**
 * Clears/unselects all selected features
 *
 */
ome.ol3.interaction.Select.prototype.clearSelection = function() {
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
ome.ol3.interaction.Select.handleEvent = function(mapBrowserEvent) {
    if (!this.condition_(mapBrowserEvent) || mapBrowserEvent.dragging) {
        return true;
    }

    var selected = this.featuresAtCoords_(mapBrowserEvent.pixel);

    var oldSelectedFlag =
        selected && typeof selected['selected'] === 'boolean' ?
            selected['selected'] : false;
    if (selected === null || !ol.events.condition.shiftKeyOnly(mapBrowserEvent)) {
        this.clearSelection();
        if (selected === null) return;
    }
    this.regions_.setProperty([selected.getId()], "selected", !oldSelectedFlag);

    return ol.events.condition.pointerMove(mapBrowserEvent);
};

/**
 * Tests to see if the given coordinates intersects any of our features.
 * @param {Array.<number>} pixel pixel coordinate to test for intersection.
 * @param {number} tolerance a pixel tolerance/buffer
 * @param {boolean} use_already_selected will only consider already selected
 * @return {ol.Feature} Returns the feature found at the specified pixel
 *                      coordinates.
 */
ome.ol3.interaction.Select.prototype.featuresAtCoords_ =
    function(pixel, tolerance, use_already_selected) {
    if (!ome.ol3.utils.Misc.isArray(pixel) || pixel.length !== 2) return;

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
                        ol.array.includes(alreadySelected, feat))) hits.push(feat);
            }
        });

    return ome.ol3.utils.Misc.featuresAtCoords(hits);
};

/**
 * Getter for the selected features
 *
 * @return {ol.Collection} the selected features
 */
ome.ol3.interaction.Select.prototype.getFeatures = function() {
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
 ome.ol3.interaction.Select.prototype.toggleFeatureSelection =
    function(feature, select, remove_first) {
     if (!(feature instanceof ol.Feature)) return;

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
ome.ol3.interaction.Select.prototype.disposeInternal = function() {
    this.regions_ = null;
}
