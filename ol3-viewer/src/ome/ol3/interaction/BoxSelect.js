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
goog.provide('ome.ol3.interaction.BoxSelect');

goog.require('ol.interaction.DragBox');
goog.require('ol.Collection');
goog.require('ol.Feature');

/**
 * @classdesc
 * Extends the built in dragbox interaction to make it more custom in terms of keys
 * and add the appropriate boxstart and boxend handlers straight away
 *
 * @constructor
 * @extends {ol.interaction.DragBox}
 * @fires ol.interaction.DragBox.Event
 * @param {ome.ol3.source.Regions} regions_reference a reference to get to all (selected) rois
 */
ome.ol3.interaction.BoxSelect = function(regions_reference) {
    if (!(regions_reference instanceof ome.ol3.source.Regions))
        console.error("Select needs Regions instance!");
    // super
    goog.base(this);

    /**
     * @private
     * @type {ol.events.ConditionType}
     */
    this.condition_ = ol.events.condition.platformModifierKeyOnly;

    // we do need the regions reference to get the (selected) rois
    if (!(regions_reference instanceof ome.ol3.source.Regions)) return;

    /**
     * a reference to the Regions instance
     * @private
     * @type {ome.ol3.source.Regions}
     */
    this.regions_ = regions_reference;

    /**
     * the box start listener
     * @private
     * @type {function}
     */
    this.boxStartFunction_ =
        function() {
            if (this.regions_.select_) this.regions_.select_.clearSelection();
        };
    this.boxStartListener_ = null;

    /**
     * the box end listener
     * @private
     * @type {function}
     */
   this.boxEndFunction_ = function() {
        if (this.regions_.select_ === null) return;

        var ids = [];
        var extent = this.getGeometry().getExtent();
        this.regions_.forEachFeatureInExtent(
            extent, function(feature) {
                if (feature.getGeometry().intersectsExtent(extent))
                    ids.push(feature.getId());
            });
        this.regions_.setProperty(ids, "selected", true);
    };
    this.boxEndListener_ = null;

    this.registerListeners = function() {
        this.boxStartListener_ =
            ol.events.listen(this, 'boxstart', this.boxStartFunction_, this);
        this.boxEndListener_ =
            ol.events.listen(this, 'boxend', this.boxEndFunction_, this);
    };

    this.registerListeners();
};
goog.inherits(ome.ol3.interaction.BoxSelect, ol.interaction.DragBox);

/**
 * Register the start/end listeners
 */
ome.ol3.interaction.BoxSelect.prototype.resetListeners = function() {
    this.unregisterListeners();
    this.registerListeners();
}

/**
 * Unregister the start/end listeners
 */
ome.ol3.interaction.BoxSelect.prototype.unregisterListeners = function() {
    if (this.boxStartListener_) ol.events.unlistenByKey(this.boxStartListener_);
    if (this.boxEndListener_) ol.events.unlistenByKey(this.boxEndListener_);
}

/**
 * a sort of desctructor
 */
ome.ol3.interaction.BoxSelect.prototype.disposeInternal = function() {
    this.unregisterListeners();
    this.regions_ = null;
}
