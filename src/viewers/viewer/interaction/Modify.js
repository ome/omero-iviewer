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

import OlModify from 'ol/interaction/Modify';
import Pointer from 'ol/interaction/Pointer';
import Collection from 'ol/Collection';
import ViewHint from 'ol/ViewHint';
import Circle from 'ol/geom/Circle';
import Point from 'ol/geom/Point';
import MultiPoint from 'ol/geom/MultiPoint';
import MultiPolygon from 'ol/geom/MultiPolygon';
import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import GeometryType from 'ol/geom/GeometryType';
import MapBrowserEventType from 'ol/MapBrowserEventType';
import {ModifyEvent} from 'ol/interaction/Modify';
import {listen} from 'ol/events';
import {getUid} from 'ol/util';
import {boundingExtent} from 'ol/extent';
import {squaredDistanceToSegment,
    squaredDistance,
    closestOnSegment,
    equals} from 'ol/coordinate';
import {click,
    noModifierKeys} from 'ol/events/condition';
import Label from '../geom/Label';
import Rectangle from '../geom/Rectangle';
import Ellipse from '../geom/Ellipse';
import Line from '../geom/Line';
import Polygon from '../geom/Polygon';
import Regions from '../source/Regions';
import Select from '../interaction/Select';
import Mask from '../geom/Mask';
import {applyInverseTransform} from '../utils/Transform';
import {sendEventNotification} from '../utils/Misc';
import {REGIONS_STATE} from '../globals';

// ol.interaction.ModifyEventType.MODIFYSTART from ol4 no longer public
const MODIFYSTART = 'modifystart';
const MODIFYEND = 'modifyend';

/**
 * @classdesc
 * An overriden version of the open layers modify interaction.
 * It ensure that labels are not modified, rectangles remain rectangles, as
 * well as ellipses not losing their form.
 *
 * @extends {ol.interaction.Modify}
 */
class Modify extends OlModify {

    /**
     * @constructor
     * 
     * @param {source.Regions} regions_reference an Regions instance.
     */
    constructor(regions_reference) {
        // we do need the regions reference to do modifications
        if (!(regions_reference instanceof Regions))
            console.error("Modify needs a Regions instance!");
        if (!(regions_reference.select_ instanceof Select))
            console.error("Select needs a Select instance!");

        super({
            pixelTolerance : 5,
            features : regions_reference.select_.getFeatures(),
            // Override these in parent ol.interaction.Modify
            handleDragEvent: handleDragEvent_,
            handleUpEvent: handleUpEvent_,
        });

        /**
         * @type {source.Regions}
         * @private
         */
        this.regions_ = regions_reference;

        /**
         * @type {number}
         * @private
         */
        this.hist_id_ = -1;

        this.handleEvent = handleEvent;

        this.deleteCondition_ = function(mapBrowserEvent) {
            return noModifierKeys(mapBrowserEvent) &&
                click(mapBrowserEvent);
        }

        // a listener to react on modify start
        listen(this, MODIFYSTART,
            function(event) {
                this.hist_id_ =
                    this.regions_.addHistory(event.features.array_, true);
            }, this);

        // a listener to react on modify end
        listen(this, MODIFYEND,
            function(event) {
                // complete history entry
                if (this.hist_id_ >= 0) {
                    var featId = event.features.array_[0].getId();
                    this.regions_.addHistory(
                        event.features.array_, false, this.hist_id_);
                    sendEventNotification(
                        this.regions_.viewer_,
                        "REGIONS_HISTORY_ENTRY",
                        {"hist_id": this.hist_id_, "shape_ids": [featId]});
                    this.regions_.setProperty(
                        [featId], "state", REGIONS_STATE.MODIFIED);
                }
            }, this);
    };

    /**
     * Override for dimension/permission/visibility filtering
     * @param {Collection.Event} evt Event.
     * @private
     */
    handleFeatureAdd_(evt) {
        var feature = evt.element;

        var renderFeature = this.regions_.renderFeature(feature);
        if (!renderFeature ||
            feature.getGeometry() instanceof Mask ||
            (typeof feature['permissions'] === 'object' &&
                feature['permissions'] !== null &&
                typeof feature['permissions']['canEdit'] === 'boolean' &&
                !feature['permissions']['canEdit'])) return;

        this.addFeature_(feature);
    };

    /**
     * Overridden method.
     * E.g. shows the drag handle when the pointer is near the corner of a
     * Rectangle or end of Line or Ellipse.
     *
     * @param {ol.Pixel} pixel Pixel
     * @param {ol.Map} map Map.
     * @private
     */
    handlePointerAtPixel_(pixel, map) {
        if (!(this.features_ instanceof Collection) ||
            this.features_.getLength() === 0) return;

        var pixelCoordinate = map.getCoordinateFromPixel(pixel);
        var sortByDistance = function(a, b) {
            return squaredDistanceToSegment(
                        pixelCoordinate, a.segment) -
                        squaredDistanceToSegment(
                            pixelCoordinate, b.segment);
        };

        var lowerLeft =
            map.getCoordinateFromPixel(
                [pixel[0] - this.pixelTolerance_, pixel[1] + this.pixelTolerance_]);
        var upperRight =
            map.getCoordinateFromPixel(
                [pixel[0] + this.pixelTolerance_, pixel[1] - this.pixelTolerance_]);
        var box = boundingExtent([lowerLeft, upperRight]);

        var rBush = this.rBush_;
        var nodes = rBush.getInExtent(box);

        // we are within a feature's bounding box
        if (nodes.length > 0) {
            nodes.sort(sortByDistance);
            // get closest node
            var node = nodes[0];

            var disallowModification =
                node.geometry instanceof Label ||
                node.geometry instanceof Mask ||
                node.geometry instanceof Circle ||
                !this.regions_.renderFeature(node.feature);
            if (!disallowModification) {
                var closestSegment = node.segment;
                var vertex =
                    (closestOnSegment(
                        pixelCoordinate,closestSegment));
                var vertexPixel = map.getPixelFromCoordinate(vertex);

                if (Math.sqrt(squaredDistance(pixel, vertexPixel)) <=
                    this.pixelTolerance_) {
                        var pixel1 = map.getPixelFromCoordinate(closestSegment[0]);
                        var pixel2 = map.getPixelFromCoordinate(closestSegment[1]);
                        var squaredDist1 =
                            squaredDistance(vertexPixel, pixel1);
                        var squaredDist2 =
                            squaredDistance(vertexPixel, pixel2);
                        var dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
                        this.snappedToVertex_ = dist <= this.pixelTolerance_;

                        // for rectangles we force snap to vertex
                        // to only be able to drag them at one of the vertices
                        // this.snappedToVertex_ is True if we are near to handle
                        if ((node.geometry instanceof Rectangle ||
                            node.geometry instanceof Ellipse ||
                            node.geometry instanceof Line) &&
                            !this.snappedToVertex_) return;

                        if (this.snappedToVertex_) {
                            vertex = squaredDist1 > squaredDist2 ?
                            closestSegment[1] : closestSegment[0];
                        }

                        this.createOrUpdateVertexFeature_(vertex);
                        var vertexSegments = {};
                        vertexSegments[getUid(closestSegment)] = true;
                        var segment;
                        for (var i = 1, ii = nodes.length; i < ii; ++i) {
                            segment = nodes[i].segment;
                            if ((equals(closestSegment[0], segment[0]) &&
                                equals(closestSegment[1], segment[1]) ||
                                (equals(closestSegment[0], segment[1]) &&
                                equals(closestSegment[1], segment[0])))) {
                                        vertexSegments[getUid(segment)] = true;
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

    handlePointerEvent(mapBrowserEvent) {
        if (!(/** @type {import("../MapBrowserPointerEvent.js").default} */ (mapBrowserEvent).pointerEvent)) {
            return true;
        }

        var stopEvent = false;
        this.updateTrackedPointers_(mapBrowserEvent);
        if (this.handlingDownUpSequence) {
            if (mapBrowserEvent.type == MapBrowserEventType.POINTERDRAG) {
                this.handleDragEvent(mapBrowserEvent);
            } else if (mapBrowserEvent.type == MapBrowserEventType.POINTERUP) {
                var handledUp = this.handleUpEvent(mapBrowserEvent);
                this.handlingDownUpSequence = handledUp && this.targetPointers.length > 0;
            }
        } else {
            if (mapBrowserEvent.type == MapBrowserEventType.POINTERDOWN) {
                var handled = this.handleDownEvent(mapBrowserEvent);
                if (handled) {
                    mapBrowserEvent.preventDefault();
                }
                this.handlingDownUpSequence = handled;
                stopEvent = this.stopDown(handled);
            } else if (mapBrowserEvent.type == MapBrowserEventType.POINTERMOVE) {
            this.handleMoveEvent(mapBrowserEvent);
            }
        }
        return !stopEvent;
    };

    /**
     * Removes a vertex from all matching features
     *
     * @return {boolean} True when a vertex was removed.
     * @private
     */
    removeVertex_() {
        var dragSegments = this.dragSegments_;
        var segmentsByFeature = {};
        var deleted = false;
        var component, coordinates, dragSegment, geometry, i, index, left;
        var newIndex, right, segmentData, uid;
    
        for (i = dragSegments.length - 1; i >= 0; --i) {
            dragSegment = dragSegments[i];
            segmentData = dragSegment[0];
            uid = getUid(segmentData.feature);
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
                case GeometryType.MULTI_LINE_STRING:
                    if (coordinates[segmentData.depth[0]].length > 2) {
                        coordinates[segmentData.depth[0]].splice(index, 1);
                        deleted = true;
                    }
                    break;
                case GeometryType.LINE_STRING:
                    if (coordinates.length > 2) {
                        coordinates.splice(index, 1);
                        deleted = true;
                        if (potentialTransform) {
                            this.setGeometryCoordinates_(geometry, coordinates);
                            var tmp =
                                new Line(
                                    geometry.getInvertedCoordinates(),
                                    geometry.has_start_arrow_,
                                    geometry.has_end_arrow_,
                                    potentialTransform);
                            geometry.initial_coords_ = tmp.getLineCoordinates();
                        }
                    }
                    break;
                case GeometryType.MULTI_POLYGON:
                    component = component[segmentData.depth[1]];
                    /* falls through */
                case GeometryType.POLYGON:
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
                            new Polygon(
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
                        boundingExtent(newSegmentData.segment),
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
    }
}

/**
 * Overridden method
 *
 * @param {ol.MapBrowserPointerEvent} mapBrowserEvent Event.
 * @this {ol.interaction.Modify}
 * @private
 */
const handleDragEvent_ = function(mapBrowserEvent) {
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

        if (geometry instanceof Point) {
            coordinates = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof MultiPoint) {
            coordinates[segmentData.index] = vertex;
            segment[0] = segment[1] = vertex;
        } else if (geometry instanceof LineString) {
            coordinates[segmentData.index + index] = vertex;

            if (potentialTransform) {
                var tmp =
                    new Line(
                        geometry.getInvertedCoordinates(),
                        geometry.has_start_arrow_,
                        geometry.has_end_arrow_,
                        potentialTransform);
                geometry.initial_coords_ = tmp.getLineCoordinates();
            }

            segment[index] = vertex;
        } else if (geometry instanceof MultiLineString) {
            coordinates[depth[0]][segmentData.index + index] = vertex;
            segment[index] = vertex;
        } else if (geometry instanceof Ellipse) {
            var v = vertex.slice();
            if (potentialTransform)
                v = applyInverseTransform(
                    geometry.transform_, v);
            geometry.rx_ = Math.abs(geometry.cx_-v[0]);
            geometry.ry_ = Math.abs(geometry.cy_-v[1]);
            var tmp =
                new Ellipse(
                    geometry.cx_, geometry.cy_,
                    geometry.rx_, geometry.ry_,
                    potentialTransform);
            coordinates = tmp.getCoordinates();
        } else if (geometry instanceof Rectangle) {
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
                    coordinates[0][oppVertexIndex][0],
                    coordinates[0][oppVertexIndex][1]
                ];
            }

            var v =
                applyInverseTransform(
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
                new Rectangle(
                    minX, minY,
                    Math.abs(maxX - minX), Math.abs(maxY - minY),
                    potentialTransform);
            coordinates = tmp.getCoordinates();
            geometry.initial_coords_ = tmp.initial_coords_;
        } else if (geometry instanceof Polygon) {
            coordinates[depth[0]][segmentData.index + index] = vertex;

            if (potentialTransform) {
                var tmp =
                    new Polygon(
                        geometry.getInvertedCoordinates(),
                        potentialTransform);
                geometry.initial_coords_ = tmp.getPolygonCoordinates();
            }

            segment[index] = vertex;
        } else if (geometry instanceof MultiPolygon) {
            coordinates[depth[1]][depth[0]][segmentData.index + index] =
                vertex;
            segment[index] = vertex;
        }

        this.setGeometryCoordinates_(geometry, coordinates);

        // Update the ShapeEditPopup
        this.regions_.viewer_.viewer_.getOverlays().forEach(o => {
            if (o.updatePopupCoordinates) {
                o.updatePopupCoordinates(geometry);
            }
        });
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
const handleUpEvent_ = function(mapBrowserEvent) {
    this.oppVertBeingDragged = null;
    var segmentData;

    var id = null;
    for (var i = this.dragSegments_.length - 1; i >= 0; --i) {
        segmentData = this.dragSegments_[i][0];

        if (segmentData.geometry instanceof Rectangle ||
            segmentData.geometry instanceof Ellipse) {
                this.removeFeatureSegmentData_(segmentData.feature);
                this.writePolygonGeometry_(
                    segmentData.feature, segmentData.geometry);
        } else {
            this.rBush_.update(
                boundingExtent(segmentData.segment), segmentData);
            if (this.vertexFeature_) this.features_.remove(this.vertexFeature_);
        }
        id = segmentData.feature.getId();
    }

    if (this.modified_) {
        this.dispatchEvent(
            new ModifyEvent(
                MODIFYEND,
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
const handleEvent = function(mapBrowserEvent) {
    var handled;
    if (!mapBrowserEvent.map.getView().getHints()[ViewHint.INTERACTING] &&
        mapBrowserEvent.type == MapBrowserEventType.POINTERMOVE &&
        !this.handlingDownUpSequence) {
            this.handlePointerMove_(mapBrowserEvent);
    }

    if (this.vertexFeature_ && this.deleteCondition_(mapBrowserEvent)) {
        if (mapBrowserEvent.type != MapBrowserEventType.SINGLECLICK ||
            !this.ignoreNextSingleClick_) {
            // we do not allow to delete any vertex of a rectangle/ellipse
            if (this.features_ instanceof Collection &&
                this.features_.getLength() > 0 &&
                (this.features_.item(0).getGeometry()
                    instanceof Rectangle ||
                 this.features_.item(0).getGeometry()
                    instanceof Ellipse)) handled = true;
            else {
                var geometry = this.vertexFeature_.getGeometry();
                if (!(geometry instanceof Point))
                    console.error("geometry should be an Point!");
                this.willModifyFeatures_(mapBrowserEvent);
                handled = this.removeVertex_();
                this.dispatchEvent(
                    new ModifyEvent(
                        MODIFYEND,
                        this.features_, mapBrowserEvent));
                this.modified_ = false;
            }
        } else handled = true;
    }

    if (mapBrowserEvent.type == MapBrowserEventType.SINGLECLICK) {
        this.ignoreNextSingleClick_ = false;
    }

    // This will call handleDragEvent etc as needed
    return Pointer.prototype.handleEvent.call(this, mapBrowserEvent) && !handled;
};

export default Modify;
