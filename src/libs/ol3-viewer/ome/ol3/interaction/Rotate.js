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
import DragRotate from "ol/interaction/dragrotate";
import EventCondition from 'ol/events/condition';

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.DragRotate}
 */
export default class Rotate extends DragRotate {
    constructor() {
        super();

        /**
         * @private
         * @type {ol.events.ConditionType}
         */
        this.condition_ = EventCondition.shiftKeyOnly;
    }
}
