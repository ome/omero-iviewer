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
import DragBox from 'ol/interaction/DragBox';
import {listen,
    unlistenByKey} from 'ol/events';
import {platformModifierKeyOnly} from 'ol/events/condition';
import {inherits} from 'ol/util';
import Regions from '../source/Regions';

/**
 * @classdesc
 * Extends the built in dragbox interaction to make it more custom in terms of keys
 * and add the appropriate boxstart and boxend handlers straight away
 *
 * @constructor
 * @extends {ol.interaction.DragBox}
 * @fires ol.interaction.DragBox.Event
 * @param {source.Regions} regions_reference a reference to get to all (selected) rois
 */
const BoxSelect = function(regions_reference) {
    if (!(regions_reference instanceof Regions))
        console.error("Select needs Regions instance!");
    // super
    // goog.base(this);
    DragBox.call(this);

    /**
     * @private
     * @type {ol.events.ConditionType}
     */
    this.condition_ = platformModifierKeyOnly;

    // we do need the regions reference to get the (selected) rois
    if (!(regions_reference instanceof Regions)) return;

    /**
     * a reference to the Regions instance
     * @private
     * @type {source.Regions}
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
        if (ids.length > 0) this.regions_.setProperty(ids, "selected", true);
    };
    this.boxEndListener_ = null;

    this.registerListeners = function() {
        this.boxStartListener_ =
            listen(this, 'boxstart', this.boxStartFunction_, this);
        this.boxEndListener_ =
            listen(this, 'boxend', this.boxEndFunction_, this);
    };

    this.registerListeners();
};
inherits(BoxSelect, DragBox);

/**
 * Register the start/end listeners
 */
BoxSelect.prototype.resetListeners = function() {
    this.unregisterListeners();
    this.registerListeners();
}

/**
 * Unregister the start/end listeners
 */
BoxSelect.prototype.unregisterListeners = function() {
    if (this.boxStartListener_) unlistenByKey(this.boxStartListener_);
    if (this.boxEndListener_) unlistenByKey(this.boxEndListener_);
}

/**
 * a sort of desctructor
 */
BoxSelect.prototype.disposeInternal = function() {
    this.unregisterListeners();
    this.regions_ = null;
}

export default BoxSelect;
