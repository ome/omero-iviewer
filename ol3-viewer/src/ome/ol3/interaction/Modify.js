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
 * @param {ol.PluggableMap} map Map.
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

        var disallowModification =
            node.geometry instanceof ome.ol3.geom.Label ||
            node.geometry instanceof ol.geom.Circle;
            // ||
            //(ome.ol3.utils.Misc.isArray(node.geometry.transform_) &&
            //        !(node.geometry instanceof ome.ol3.geom.Ellipse));
        if (!disallowModification) {
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
        var potentialTransform = geometry.getTransform();

        while (vertex.length < geometry.getStride()) vertex.push(0);

        if (geometry instanceof ol.geom.Point) {
            coordinates = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof ol.geom.MultiPoint) {
            coordinates[segmentData.index] = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof ol.geom.LineString) {
            coordinates[segmentData.index + index] = vertex;

            if (potentialTransform) {
                var tmp =
                    new ome.ol3.geom.Line(
                        geometry.getInvertedCoordinates(),
                        geometry.has_start_arrow_,
                        geometry.has_end_arrow_,
                        potentialTransform);
                geometry.initial_coords_ = tmp.getLineCoordinates();
            }

            segment[index] = vertex;
        } else if (geometry instanceof ol.geom.MultiLineString) {
            coordinates[depth[0]][segmentData.index + index] = vertex;
            segment[index] = vertex;
        } else if (geometry instanceof ome.ol3.geom.Ellipse) {
            var v = vertex.slice();
            if (potentialTransform)
                v = ome.ol3.utils.Transform.applyInverseTransform(
                    geometry.transform_, v);
            geometry.rx_ = Math.abs(geometry.cx_-v[0]);
            geometry.ry_ = Math.abs(geometry.cy_-v[1]);
            var tmp =
                new ome.ol3.geom.Ellipse(
                    geometry.cx_, geometry.cy_,
                    geometry.rx_, geometry.ry_,
                    potentialTransform);
            coordinates = tmp.getCoordinates();
        } else if (geometry instanceof ome.ol3.geom.Rectangle) {
            if (this.oppVertBeingDragged == null) {
                var vertexBeingDragged =
                    this.vertexFeature_.getGeometry().getCoordinates();
                var dragVertexIndex = 0;
                for (var j=0;j<coordinates[depth[0]].length;j++)
                    if (coordinates[depth[0]][j][0] ===  vertexBeingDragged[0] &&
                        coordinates[depth[0]][j][1] ===  vertexBeingDragged[1]) {
                            dragVertexIndex = j;
                            break;
                    }

                if (dragVertexIndex > 2) dragVertexIndex++;
                var oppVertexIndex = (dragVertexIndex + 2)  % 5;
                this.oppVertBeingDragged = [
                    geometry.initial_coords_[oppVertexIndex*2],
                    geometry.initial_coords_[oppVertexIndex*2+1]
                ];
            }

            var v =
                ome.ol3.utils.Transform.applyInverseTransform(
                    geometry.transform_, vertex.slice());
            var minX =
                v[0] < this.oppVertBeingDragged[0] ?
                    v[0] : this.oppVertBeingDragged[0];
            var maxX =
                v[0] > this.oppVertBeingDragged[0] ?
                    v[0] : this.oppVertBeingDragged[0];
            var minY =
                -v[1] < -this.oppVertBeingDragged[1] ?
                    v[1] : this.oppVertBeingDragged[1];
            var maxY =
                -v[1] > -this.oppVertBeingDragged[1] ?
                    v[1] : this.oppVertBeingDragged[1];

            var tmp =
                new ome.ol3.geom.Rectangle(
                    minX, minY,
                    Math.abs(maxX - minX), Math.abs(maxY - minY),
                    potentialTransform);
            coordinates = tmp.getCoordinates();
            geometry.initial_coords_ = tmp.initial_coords_;
        } else if (geometry instanceof ol.geom.Polygon) {
            coordinates[depth[0]][segmentData.index + index] = vertex;

            if (potentialTransform) {
                var tmp =
                    new ome.ol3.geom.Polygon(
                        geometry.getInvertedCoordinates(),
                        potentialTransform);
                geometry.initial_coords_ = tmp.getPolygonCoordinates();
            }

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

/**
 * Removes a vertex from all matching features
 *
 * @return {boolean} True when a vertex was removed.
 * @private
 */
ome.ol3.interaction.Modify.prototype.removeVertex_ = function() {
    var dragSegments = this.dragSegments_;
    var segmentsByFeature = {};
    var deleted = false;
    var component, coordinates, dragSegment, geometry, i, index, left;
    var newIndex, right, segmentData, uid;

    for (i = dragSegments.length - 1; i >= 0; --i) {
        dragSegment = dragSegments[i];
        segmentData = dragSegment[0];
        uid = ol.getUid(segmentData.feature);
        if (segmentData.depth) {
            // separate feature components
            uid += '-' + segmentData.depth.join('-');
        }
        if (!(uid in segmentsByFeature)) {
            segmentsByFeature[uid] = {};
        }
        if (dragSegment[1] === 0) {
            segmentsByFeature[uid].right = segmentData;
            segmentsByFeature[uid].index = segmentData.index;
        } else if (dragSegment[1] == 1) {
            segmentsByFeature[uid].left = segmentData;
            segmentsByFeature[uid].index = segmentData.index + 1;
        }
    }

    for (uid in segmentsByFeature) {
        right = segmentsByFeature[uid].right;
        left = segmentsByFeature[uid].left;
        index = segmentsByFeature[uid].index;
        newIndex = index - 1;
        if (left !== undefined) {
            segmentData = left;
        } else {
            segmentData = right;
        }
        if (newIndex < 0) {
            newIndex = 0;
        }
        geometry = segmentData.geometry;
        coordinates = geometry.getCoordinates();
        component = coordinates;
        deleted = false;
        var potentialTransform = geometry.getTransform();
        switch (geometry.getType()) {
            case ol.geom.GeometryType.MULTI_LINE_STRING:
                if (coordinates[segmentData.depth[0]].length > 2) {
                    coordinates[segmentData.depth[0]].splice(index, 1);
                    deleted = true;
                }
                break;
            case ol.geom.GeometryType.LINE_STRING:
                if (coordinates.length > 2) {
                    coordinates.splice(index, 1);
                    deleted = true;
                    if (potentialTransform) {
                        this.setGeometryCoordinates_(geometry, coordinates);
                        var tmp =
                            new ome.ol3.geom.Line(
                                geometry.getInvertedCoordinates(),
                                geometry.has_start_arrow_,
                                geometry.has_end_arrow_,
                                potentialTransform);
                        geometry.initial_coords_ = tmp.getLineCoordinates();
                    }
                }
                break;
            case ol.geom.GeometryType.MULTI_POLYGON:
                component = component[segmentData.depth[1]];
                /* falls through */
            case ol.geom.GeometryType.POLYGON:
                component = component[segmentData.depth[0]];
                if (component.length > 4) {
                    if (index == component.length - 1) {
                        index = 0;
                    }
                component.splice(index, 1);
                deleted = true;
                if (index === 0) {
                    // close the ring again
                    component.pop();
                    component.push(component[0]);
                    newIndex = component.length - 1;
                }
                if (potentialTransform) {
                    this.setGeometryCoordinates_(geometry, coordinates);
                    var tmp =
                        new ome.ol3.geom.Polygon(
                            geometry.getInvertedCoordinates(),
                            potentialTransform);
                    geometry.initial_coords_ = tmp.getPolygonCoordinates();
                }
            }
            break;
            default:
            // pass
        }

        if (deleted) {
            this.setGeometryCoordinates_(geometry, coordinates);
            var segments = [];
            if (left !== undefined) {
                this.rBush_.remove(left);
                segments.push(left.segment[0]);
            }
            if (right !== undefined) {
                this.rBush_.remove(right);
                segments.push(right.segment[1]);
            }
            if (left !== undefined && right !== undefined) {
                var newSegmentData = /** @type {ol.ModifySegmentDataType} */ ({
                    depth: segmentData.depth,
                    feature: segmentData.feature,
                    geometry: segmentData.geometry,
                    index: newIndex,
                    segment: segments
                });
                this.rBush_.insert(
                    ol.extent.boundingExtent(newSegmentData.segment),
                    newSegmentData);
            }
            this.updateSegmentIndices_(geometry, index, segmentData.depth, -1);
            if (this.vertexFeature_) {
                this.overlay_.getSource().removeFeature(this.vertexFeature_);
                this.vertexFeature_ = null;
            }
            dragSegments.length = 0;
        }
  }

  return deleted;
};
