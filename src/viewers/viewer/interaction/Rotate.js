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
goog.provide('ome.ol3.interaction.Rotate');

goog.require('ol.events.condition');
goog.require('ol.interaction.DragRotate');

/**
 * @classdesc
 * Extension that is necessary to override key condition to be SHIFT key only
 *
 * @constructor
 * @extends {ol.interaction.DragRotate}
 */
ome.ol3.interaction.Rotate = function() {
  goog.base(this);

  /**
   * @private
   * @type {ol.events.ConditionType}
   */
   this.condition_ = ol.events.condition.shiftKeyOnly;
};
goog.inherits(ome.ol3.interaction.Rotate, ol.interaction.DragRotate);
