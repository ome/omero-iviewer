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
import DragBox from "ol/interaction/dragbox";
import Events from "ol/events";
import Condition from 'ol/events/condition';
import Regions from '../source/Regions';

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
export default class BoxSelect extends DragBox {

    constructor(regions_reference) {
        if (!(regions_reference instanceof Regions))
            console.error("Select needs Regions instance!");
        // super
        super();

        /**
         * @private
         * @type {ol.events.ConditionType}
         */
        this.condition_ = Condition.platformModifierKeyOnly;

        // we do need the regions reference to get the (selected) rois
        if (!(regions_reference instanceof Regions)) return;

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
        this.boxStartFunction_ = () => {
            if (this.regions_.select_) {
                this.regions_.select_.clearSelection();
            }
        };
        this.boxStartListener_ = null;

        /**
         * the box end listener
         * @private
         * @type {function}
         */
        this.boxEndFunction_ = function () {
            if (this.regions_.select_ === null) return;

            let ids = [];
            let extent = this.getGeometry().getExtent();
            this.regions_.forEachFeatureInExtent(extent, (feature) => {
                if (feature.getGeometry().intersectsExtent(extent))
                    ids.push(feature.getId());
            });
            if (ids.length > 0) this.regions_.setProperty(ids, "selected", true);
        };
        this.boxEndListener_ = null;

        this.registerListeners = () => {
            this.boxStartListener_ =
                Events.listen(this, 'boxstart', this.boxStartFunction_, this);
            this.boxEndListener_ =
                Events.listen(this, 'boxend', this.boxEndFunction_, this);
        };

        this.registerListeners();
    };

    /**
     * Register the start/end listeners
     */
    resetListeners() {
        this.unregisterListeners();
        this.registerListeners();
    }

    /**
     * Unregister the start/end listeners
     */
    unregisterListeners() {
        if (this.boxStartListener_) Events.unlistenByKey(this.boxStartListener_);
        if (this.boxEndListener_) Events.unlistenByKey(this.boxEndListener_);
    }

    /**
     * a sort of desctructor
     */
    disposeInternal() {
        this.unregisterListeners();
        this.regions_ = null;
    }
}
