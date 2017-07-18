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
goog.provide('ome.ol3.interaction.Modify');

goog.require('ol.interaction.Modify');

/**
 * @classdesc
 * An overriden version of the open layers modify interaction.
 * It ensure that labels are not modified, rectangles remain rectangles, as
 * well as ellipses not losing their form.
 *
 * @constructor
 * @extends {ol.interaction.Modify}
 * @param {ome.ol3.source.Regions} regions_reference an Regions instance.
 */
ome.ol3.interaction.Modify = function(regions_reference) {
    // we do need the regions reference to do modifications
    if (!(regions_reference instanceof ome.ol3.source.Regions))
        console.error("Modify needs a Regions instance!");
    if (!(regions_reference.select_ instanceof ome.ol3.interaction.Select))
        console.error("Select needs a Select instance!");

    /**
     * @type {ome.ol3.source.Regions}
     * @private
     */
    this.regions_ = regions_reference;

    /**
     * @type {number}
     * @private
     */
    this.hist_id_ = -1;

    // call super
    goog.base(
        this, {
            pixelTolerance : 5,
            features : this.regions_.select_.getFeatures()
        });

    this.handleDragEvent_ = ome.ol3.interaction.Modify.handleDragEvent_;
    this.handleEvent = ome.ol3.interaction.Modify.handleEvent;
    this.handleUpEvent_ = ome.ol3.interaction.Modify.handleUpEvent_;

    this.deleteCondition_ = function(mapBrowserEvent) {
        return ol.events.condition.noModifierKeys(mapBrowserEvent) &&
               ol.events.condition.click(mapBrowserEvent);
    }

    // a listener to react on modify start
    ol.events.listen(this, ol.interaction.ModifyEventType.MODIFYSTART,
        function(event) {
            this.hist_id_ =
                this.regions_.addHistory(event.features.array_, true);
        }, this);

    // a listener to react on modify end
    ol.events.listen(this, ol.interaction.ModifyEventType.MODIFYEND,
        function(event) {
            // complete history entry
            if (this.hist_id_ >= 0) {
                var featId = event.features.array_[0].getId();
                this.regions_.addHistory(
                    event.features.array_, false, this.hist_id_);
                ome.ol3.utils.Misc.sendEventNotification(
                    this.regions_.viewer_,
                    "REGIONS_HISTORY_ENTRY",
                    {"hist_id": this.hist_id_, "shape_ids": [featId]});
                this.regions_.setProperty(
                    [featId], "state", ome.ol3.REGIONS_STATE.MODIFIED);
            }
        },this);
};
goog.inherits(ome.ol3.interaction.Modify, ol.interaction.Modify);


/**
 * Override for dimension/permission/visibility filtering
 * @param {ol.Collection.Event} evt Event.
 * @private
 */
ome.ol3.interaction.Modify.prototype.handleFeatureAdd_ = function(evt) {
    var feature = evt.element;

    var renderFeature = this.regions_.renderFeature(feature);
    if (!renderFeature ||
         (typeof feature['permissions'] === 'object' &&
            feature['permissions'] !== null &&
            typeof feature['permissions']['canEdit'] === 'boolean' &&
            !feature['permissions']['canEdit'])) return;

    this.addFeature_(feature);
};

/**
 * Overridden method
 *
 * @param {ol.Pixel} pixel Pixel
 * @param {ol.Map} map Map.
 * @private
 */
ome.ol3.interaction.Modify.prototype.handlePointerAtPixel_ = function(pixel, map) {
    if (!(this.features_ instanceof ol.Collection) ||
          this.features_.getLength() === 0) return;

    var pixelCoordinate = map.getCoordinateFromPixel(pixel);
    var sortByDistance = function(a, b) {
        return ol.coordinate.squaredDistanceToSegment(
                    pixelCoordinate, a.segment) -
                    ol.coordinate.squaredDistanceToSegment(
                        pixelCoordinate, b.segment);
    };

    var lowerLeft =
        map.getCoordinateFromPixel(
            [pixel[0] - this.pixelTolerance_, pixel[1] + this.pixelTolerance_]);
    var upperRight =
        map.getCoordinateFromPixel(
            [pixel[0] + this.pixelTolerance_, pixel[1] - this.pixelTolerance_]);
    var box = ol.extent.boundingExtent([lowerLeft, upperRight]);

    var rBush = this.rBush_;
    var nodes = rBush.getInExtent(box);

    // we are within a feature's bounding box
    if (nodes.length > 0) {
        nodes.sort(sortByDistance);
        // get closest node
        var node = nodes[0];

        // we only continue if we don't have an unmodifyable labels
        if (!(node.geometry instanceof ome.ol3.geom.Label) &&
            !(node.geometry instanceof ol.geom.Circle)) {
            var closestSegment = node.segment;
            var vertex =
                (ol.coordinate.closestOnSegment(
                    pixelCoordinate,closestSegment));
            var vertexPixel = map.getPixelFromCoordinate(vertex);

            if (Math.sqrt(ol.coordinate.squaredDistance(pixel, vertexPixel)) <=
                this.pixelTolerance_) {
                    var pixel1 = map.getPixelFromCoordinate(closestSegment[0]);
                    var pixel2 = map.getPixelFromCoordinate(closestSegment[1]);
                    var squaredDist1 =
                        ol.coordinate.squaredDistance(vertexPixel, pixel1);
                    var squaredDist2 =
                        ol.coordinate.squaredDistance(vertexPixel, pixel2);
                    var dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
                    this.snappedToVertex_ = dist <= this.pixelTolerance_;

                    // for rectangles we force snap to vertex
                    // to only be able to drag them at one of the vertices
                    if ((node.geometry instanceof ome.ol3.geom.Rectangle ||
                         node.geometry instanceof ome.ol3.geom.Ellipse ||
                         node.geometry instanceof ome.ol3.geom.Line) &&
                         !this.snappedToVertex_) return;

                    if (this.snappedToVertex_) {
                        vertex = squaredDist1 > squaredDist2 ?
                        closestSegment[1] : closestSegment[0];
                    }

                    this.createOrUpdateVertexFeature_(vertex);
                    var vertexSegments = {};
                    vertexSegments[ol.getUid(closestSegment)] = true;
                    var segment;
                    for (var i = 1, ii = nodes.length; i < ii; ++i) {
                        segment = nodes[i].segment;
                        if ((ol.coordinate.equals(
                            closestSegment[0], segment[0]) &&
                            ol.coordinate.equals(
                                closestSegment[1], segment[1]) ||
                            (ol.coordinate.equals(
                                closestSegment[0], segment[1]) &&
                            ol.coordinate.equals(
                                closestSegment[1], segment[0])))) {
                                    vertexSegments[ol.getUid(segment)] = true;
                        } else break;
                    }
                    this.vertexSegments_ = vertexSegments;
                    this.regions_['is_modified'] = true;
                    return;
            }
        }
    }

    // remove if we are not within a feature's bounding box
    if (this.vertexFeature_) {
        this.regions_['is_modified'] = false;
        this.overlay_.getSource().removeFeature(this.vertexFeature_);
        this.vertexFeature_ = null;
    }
};

/**
 * Overridden method
 *
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @this {ol.interaction.Modify}
 * @private
 */
ome.ol3.interaction.Modify.handleDragEvent_ = function(mapBrowserEvent) {
    this.ignoreNextSingleClick_ = false;
    this.willModifyFeatures_(mapBrowserEvent);

    var vertex = mapBrowserEvent.coordinate;
    for (var i = 0, ii = this.dragSegments_.length; i < ii; ++i) {
        var dragSegment = this.dragSegments_[i];
        var segmentData = dragSegment[0];
        var depth = segmentData.depth;
        var geometry = segmentData.geometry;
        var coordinates = geometry.getCoordinates();
        var segment = segmentData.segment;
        var index = dragSegment[1];

        while (vertex.length < geometry.getStride()) vertex.push(0);

        if (geometry instanceof ol.geom.Point) {
            coordinates = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof ol.geom.MultiPoint) {
            coordinates[segmentData.index] = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof ol.geom.LineString) {
            coordinates[segmentData.index + index] = vertex;
            segment[index] = vertex;
        } else if (geometry instanceof ol.geom.MultiLineString) {
            coordinates[depth[0]][segmentData.index + index] = vertex;
            segment[index] = vertex;
        } else if (geometry instanceof ome.ol3.geom.Ellipse) {
            var potentialTransform = geometry.getTransform();
            var v = vertex;
            if (potentialTransform)
                v = geometry.applyInverseTransform([v[0], v[1]]);
            geometry.rx_ = Math.abs(geometry.cx_-v[0]);
            geometry.ry_ = Math.abs(geometry.cy_-v[1]);
            var tmp =
                new ome.ol3.geom.Ellipse(
                    geometry.cx_, geometry.cy_,
                    geometry.rx_, geometry.ry_,
                    potentialTransform);
            coordinates = tmp.getCoordinates();
        } else if (geometry instanceof ome.ol3.geom.Rectangle) {
            var vertexBeingDragged =
                this.vertexFeature_.getGeometry().getCoordinates();
            if (this.oppVertBeingDragged == null)
                for (var j=0;j<coordinates[depth[0]].length;j++)
                    if (coordinates[depth[0]][j][0] !=  vertexBeingDragged[0] &&
                        coordinates[depth[0]][j][1] !=  vertexBeingDragged[1]) {
                            this.oppVertBeingDragged = coordinates[depth[0]][j];
                            break;
                    }

                var minX =
                    vertex[0] < this.oppVertBeingDragged[0] ?
                        vertex[0] : this.oppVertBeingDragged[0];
                var maxX =
                    vertex[0] > this.oppVertBeingDragged[0] ?
                        vertex[0] : this.oppVertBeingDragged[0];
                var minY =
                    -vertex[1] < -this.oppVertBeingDragged[1] ?
                        vertex[1] : this.oppVertBeingDragged[1];
                var maxY =
                    -vertex[1] > -this.oppVertBeingDragged[1] ?
                        vertex[1] : this.oppVertBeingDragged[1];

                // set new top left corner
                coordinates[depth[0]][0] = [minX, minY];
                coordinates[depth[0]][1] = [maxX, minY];
                coordinates[depth[0]][2] = [maxX, maxY];
                coordinates[depth[0]][3] = [minX, maxY];
                coordinates[depth[0]][4] = [minX, minY];

                segment[index] =
                    geometry.getExtent().slice(index*2, (index+1)*2);
            } else if (geometry instanceof ol.geom.Polygon) {
                coordinates[depth[0]][segmentData.index + index] = vertex;
                segment[index] = vertex;
            } else if (geometry instanceof ol.geom.MultiPolygon) {
                coordinates[depth[1]][depth[0]][segmentData.index + index] =
                    vertex;
                segment[index] = vertex;
            }
            this.setGeometryCoordinates_(geometry, coordinates);
        }
        this.createOrUpdateVertexFeature_(vertex);
};

/**
 * Overridden to modify rbush
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Stop drag sequence?
 * @this {ol.interaction.Modify}
 * @private
 */
ome.ol3.interaction.Modify.handleUpEvent_ = function(mapBrowserEvent) {
    this.oppVertBeingDragged = null;
    var segmentData;

    var id = null;
    for (var i = this.dragSegments_.length - 1; i >= 0; --i) {
        segmentData = this.dragSegments_[i][0];

        if (segmentData.geometry instanceof ome.ol3.geom.Rectangle ||
            segmentData.geometry instanceof ome.ol3.geom.Ellipse) {
                this.removeFeatureSegmentData_(segmentData.feature);
                this.writePolygonGeometry_(
                    segmentData.feature, segmentData.geometry);
        } else {
            this.rBush_.update(
                ol.extent.boundingExtent(segmentData.segment), segmentData);
            if (this.vertexFeature_) this.features_.remove(this.vertexFeature_);
        }
        id = segmentData.feature.getId();
    }

    if (this.modified_) {
        this.dispatchEvent(
            new ol.interaction.Modify.Event(
                ol.interaction.ModifyEventType.MODIFYEND,
                this.features_, mapBrowserEvent));
        this.modified_ = false;
    }

    return false;
};

/**
 * Handles the {@link ol.MapBrowserEvent map browser event} and may modify the
 * geometry.
 * @param {ol.MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} `false` to stop event propagation.
 * @this {ol.interaction.Modify}
 * @api
 */
ome.ol3.interaction.Modify.handleEvent = function(mapBrowserEvent) {
    var handled;
    if (!mapBrowserEvent.map.getView().getHints()[ol.ViewHint.INTERACTING] &&
        mapBrowserEvent.type == ol.MapBrowserEventType.POINTERMOVE &&
        !this.handlingDownUpSequence) {
            this.handlePointerMove_(mapBrowserEvent);
    }

    if (this.vertexFeature_ && this.deleteCondition_(mapBrowserEvent)) {
        if (mapBrowserEvent.type != ol.MapBrowserEventType.SINGLECLICK ||
            !this.ignoreNextSingleClick_) {
            // we do not allow to delete any vertex of a rectangle/ellipse
            if (this.features_ instanceof ol.Collection &&
                this.features_.getLength() > 0 &&
                (this.features_.item(0).getGeometry()
                    instanceof ome.ol3.geom.Rectangle ||
                 this.features_.item(0).getGeometry()
                    instanceof ome.ol3.geom.Ellipse)) handled = true;
            else {
                var geometry = this.vertexFeature_.getGeometry();
                if (!(geometry instanceof ol.geom.Point))
                    console.error("geometry should be an ol.geom.Point!");
                this.willModifyFeatures_(mapBrowserEvent);
                handled = this.removeVertex_();
                this.dispatchEvent(
                    new ol.interaction.Modify.Event(
                        ol.interaction.ModifyEventType.MODIFYEND,
                        this.features_, mapBrowserEvent));
                this.modified_ = false;
            }
        } else handled = true;
    }

    if (mapBrowserEvent.type == ol.MapBrowserEventType.SINGLECLICK) {
        this.ignoreNextSingleClick_ = false;
    }

    return ol.interaction.Pointer.handleEvent.call(this, mapBrowserEvent) &&
            !handled;
};
