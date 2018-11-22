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

import ol from 'ol';
import OLModify from 'ol/interaction/modify';
import MapBrowserEventType from "ol/mapbrowsereventtype";
import ViewHint from "ol/viewhint";
import Collection from "ol/collection";
import Circle from "ol/geom/circle";
import Point from "ol/geom/point";
import OLPolygon from "ol/geom/polygon";
import MultiPolygon from "ol/geom/multipolygon";
import MultiPoint from "ol/geom/multipoint";
import LineString from "ol/geom/linestring";
import MultiLineString from "ol/geom/multilinestring";
import PointerInteraction from "ol/interaction/pointer";
import GeometryType from "ol/geom/geometrytype";
import Events from "ol/events";
import EventConditions from "ol/events/condition";
import Extent from 'ol/extent';
import Coordinate from 'ol/coordinate';

import Ellipse from "../geom/Ellipse";
import Rectangle from "../geom/Rectangle";
import Select from "./Select";
import Regions from "../source/Regions";
import Line from "../geom/Line";
import Polygon from "../geom/Polygon";
import Label from "../geom/Label";
import Mask from "../geom/Mask";

import {REGIONS_STATE} from "../Globals";
import * as TransformUtils from '../utils/Transform';
import * as MiscUtils from '../utils/Misc';

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
export default class Modify extends OLModify {

    constructor(regions_reference) {
        // we do need the regions reference to do modifications
        if (!(regions_reference instanceof Regions))
            console.error("Modify needs a Regions instance!");
        if (!(regions_reference.select_ instanceof Select))
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
        super({
            pixelTolerance: 5,
            features: this.regions_.select_.getFeatures()
        });

        // this.handleDragEvent_ = ome.ol3.interaction.Modify.handleDragEvent_;
        // this.handleEvent = ome.ol3.interaction.Modify.handleEvent;
        // this.handleUpEvent_ = ome.ol3.interaction.Modify.handleUpEvent_;

        this.deleteCondition_ = (mapBrowserEvent) => {
            return EventConditions.noModifierKeys(mapBrowserEvent) &&
                EventConditions.click(mapBrowserEvent);
        };

        // a listener to react on modify start
        Events.listen(this, OLModify.MODIFYSTART, (event) => {
            this.hist_id_ =
                this.regions_.addHistory(event.features.array_, true);
        }, this);

        // a listener to react on modify end
        Events.listen(this, OLModify.MODIFYEND, (event) => {
            // complete history entry
            if (this.hist_id_ >= 0) {
                let featId = event.features.array_[0].getId();
                this.regions_.addHistory(
                    event.features.array_, false, this.hist_id_);
                MiscUtils.sendEventNotification(
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
     * @param {ol.Collection.Event} evt Event.
     * @private
     */
    handleFeatureAdd_ (evt) {
        let feature = evt.element;

        let renderFeature = this.regions_.renderFeature(feature);
        if (!renderFeature ||
            feature.getGeometry() instanceof Mask ||
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
    handlePointerAtPixel_ (pixel, map) {
        if (!(this.features_ instanceof Collection) ||
            this.features_.getLength() === 0) return;

        let pixelCoordinate = map.getCoordinateFromPixel(pixel);
        let sortByDistance = function (a, b) {
            return Coordinate.squaredDistanceToSegment(
                pixelCoordinate, a.segment) -
                Coordinate.squaredDistanceToSegment(
                    pixelCoordinate, b.segment);
        };

        let lowerLeft =
            map.getCoordinateFromPixel(
                [pixel[0] - this.pixelTolerance_, pixel[1] + this.pixelTolerance_]);
        let upperRight =
            map.getCoordinateFromPixel(
                [pixel[0] + this.pixelTolerance_, pixel[1] - this.pixelTolerance_]);
        let box = Extent.boundingExtent([lowerLeft, upperRight]);

        let rBush = this.rBush_;
        let nodes = rBush.getInExtent(box);

        // we are within a feature's bounding box
        if (nodes.length > 0) {
            nodes.sort(sortByDistance);
            // get closest node
            let node = nodes[0];

            let disallowModification =
                node.geometry instanceof Label ||
                node.geometry instanceof Mask ||
                node.geometry instanceof Circle ||
                !this.regions_.renderFeature(node.feature);
            if (!disallowModification) {
                let closestSegment = node.segment;
                let vertex =
                    (Coordinate.closestOnSegment(
                        pixelCoordinate, closestSegment));
                let vertexPixel = map.getPixelFromCoordinate(vertex);

                if (Math.sqrt(Coordinate.squaredDistance(pixel, vertexPixel)) <=
                    this.pixelTolerance_) {
                    let pixel1 = map.getPixelFromCoordinate(closestSegment[0]);
                    let pixel2 = map.getPixelFromCoordinate(closestSegment[1]);
                    let squaredDist1 =
                        Coordinate.squaredDistance(vertexPixel, pixel1);
                    let squaredDist2 =
                        Coordinate.squaredDistance(vertexPixel, pixel2);
                    let dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
                    this.snappedToVertex_ = dist <= this.pixelTolerance_;

                    // for rectangles we force snap to vertex
                    // to only be able to drag them at one of the vertices
                    if ((node.geometry instanceof Rectangle ||
                        node.geometry instanceof Ellipse ||
                        node.geometry instanceof Line) &&
                        !this.snappedToVertex_) return;

                    if (this.snappedToVertex_) {
                        vertex = squaredDist1 > squaredDist2 ?
                            closestSegment[1] : closestSegment[0];
                    }

                    this.createOrUpdateVertexFeature_(vertex);
                    let vertexSegments = {};
                    vertexSegments[ol.getUid(closestSegment)] = true;
                    let segment;
                    for (let i = 1, ii = nodes.length; i < ii; ++i) {
                        segment = nodes[i].segment;
                        if ((Coordinate.equals(
                            closestSegment[0], segment[0]) &&
                            Coordinate.equals(
                                closestSegment[1], segment[1]) ||
                            (Coordinate.equals(
                                closestSegment[0], segment[1]) &&
                                Coordinate.equals(
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
    handleDragEvent_ = (mapBrowserEvent) => {
        this.ignoreNextSingleClick_ = false;
        this.willModifyFeatures_(mapBrowserEvent);

        let vertex = mapBrowserEvent.coordinate;
        for (let i = 0, ii = this.dragSegments_.length; i < ii; ++i) {
            let dragSegment = this.dragSegments_[i];
            let segmentData = dragSegment[0];
            let depth = segmentData.depth;
            let geometry = segmentData.geometry;
            let coordinates = geometry.getCoordinates();
            let segment = segmentData.segment;
            let index = dragSegment[1];
            let potentialTransform = geometry.getTransform();

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
                    let tmp =
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
                let v = vertex.slice();
                if (potentialTransform)
                    v = TransformUtils.applyInverseTransform(
                        geometry.transform_, v);
                geometry.rx_ = Math.abs(geometry.cx_ - v[0]);
                geometry.ry_ = Math.abs(geometry.cy_ - v[1]);
                let tmp =
                    new Ellipse(
                        geometry.cx_, geometry.cy_,
                        geometry.rx_, geometry.ry_,
                        potentialTransform);
                coordinates = tmp.getCoordinates();
            } else if (geometry instanceof Rectangle) {
                if (this.oppVertBeingDragged == null) {
                    let vertexBeingDragged =
                        this.vertexFeature_.getGeometry().getCoordinates();
                    let dragVertexIndex = 0;
                    for (let j = 0; j < coordinates[depth[0]].length; j++)
                        if (coordinates[depth[0]][j][0] === vertexBeingDragged[0] &&
                            coordinates[depth[0]][j][1] === vertexBeingDragged[1]) {
                            dragVertexIndex = j;
                            break;
                        }

                    if (dragVertexIndex > 2) dragVertexIndex++;
                    let oppVertexIndex = (dragVertexIndex + 2) % 5;
                    this.oppVertBeingDragged = [
                        geometry.initial_coords_[oppVertexIndex * 2],
                        geometry.initial_coords_[oppVertexIndex * 2 + 1]
                    ];
                }

                let v =
                    TransformUtils.applyInverseTransform(
                        geometry.transform_, vertex.slice());
                let minX =
                    v[0] < this.oppVertBeingDragged[0] ?
                        v[0] : this.oppVertBeingDragged[0];
                let maxX =
                    v[0] > this.oppVertBeingDragged[0] ?
                        v[0] : this.oppVertBeingDragged[0];
                let minY =
                    -v[1] < -this.oppVertBeingDragged[1] ?
                        v[1] : this.oppVertBeingDragged[1];
                let maxY =
                    -v[1] > -this.oppVertBeingDragged[1] ?
                        v[1] : this.oppVertBeingDragged[1];

                let tmp = new Rectangle(
                    minX, minY,
                    Math.abs(maxX - minX), Math.abs(maxY - minY),
                    potentialTransform);
                coordinates = tmp.getCoordinates();
                geometry.initial_coords_ = tmp.initial_coords_;
            } else if (geometry instanceof OLPolygon) {
                coordinates[depth[0]][segmentData.index + index] = vertex;

                if (potentialTransform) {
                    let tmp =
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
    handleUpEvent_ = (mapBrowserEvent) => {
        this.oppVertBeingDragged = null;
        let segmentData;

        let id = null;
        for (let i = this.dragSegments_.length - 1; i >= 0; --i) {
            segmentData = this.dragSegments_[i][0];

            if (segmentData.geometry instanceof Rectangle ||
                segmentData.geometry instanceof Ellipse) {
                this.removeFeatureSegmentData_(segmentData.feature);
                this.writePolygonGeometry_(
                    segmentData.feature, segmentData.geometry);
            } else {
                this.rBush_.update(Extent.boundingExtent(segmentData.segment), segmentData);
                if (this.vertexFeature_) this.features_.remove(this.vertexFeature_);
            }
            id = segmentData.feature.getId();
        }

        if (this.modified_) {
            this.dispatchEvent(
                new OLModify.Event(
                    OLModify.MODIFYEND,
                    this.features_, mapBrowserEvent));
            this.modified_ = false;
        }

        return false;
    };

    /**
     * Handles the {@link ol.MapBrowserEvent map browser event} and may modify the
     * geometry.
     * @param {MapBrowserEvent} mapBrowserEvent Map browser event.
     * @return {boolean} `false` to stop event propagation.
     * @this {ol.interaction.Modify}
     * @api
     */
    handleEvent = (mapBrowserEvent) => {
        let handled;
        if (!mapBrowserEvent.map.getView().getHints()[ViewHint.INTERACTING] &&
            mapBrowserEvent.type === MapBrowserEventType.POINTERMOVE &&
            !this.handlingDownUpSequence) {
            this.handlePointerMove_(mapBrowserEvent);
        }

        if (this.vertexFeature_ && this.deleteCondition_(mapBrowserEvent)) {
            if (mapBrowserEvent.type !== MapBrowserEventType.SINGLECLICK ||
                !this.ignoreNextSingleClick_) {
                // we do not allow to delete any vertex of a rectangle/ellipse
                if (this.features_ instanceof Collection &&
                    this.features_.getLength() > 0 &&
                    (this.features_.item(0).getGeometry()
                        instanceof Rectangle ||
                        this.features_.item(0).getGeometry()
                        instanceof Ellipse)) handled = true;
                else {
                    let geometry = this.vertexFeature_.getGeometry();
                    if (!(geometry instanceof Point))
                        console.error("geometry should be an ol.geom.Point!");
                    this.willModifyFeatures_(mapBrowserEvent);
                    handled = this.removeVertex_();
                    this.dispatchEvent(
                        new OLModify.Event(
                            OLModify.MODIFYEND,
                            this.features_, mapBrowserEvent));
                    this.modified_ = false;
                }
            } else handled = true;
        }

        if (mapBrowserEvent.type === MapBrowserEventType.SINGLECLICK) {
            this.ignoreNextSingleClick_ = false;
        }

        return PointerInteraction.handleEvent(this, mapBrowserEvent) &&
            !handled;
    };

    /**
     * Removes a vertex from all matching features
     *
     * @return {boolean} True when a vertex was removed.
     * @private
     */
    removeVertex_() {
        let dragSegments = this.dragSegments_;
        let segmentsByFeature = {};
        let deleted = false;
        let component, coordinates, dragSegment, geometry, i, index, left;
        let newIndex, right, segmentData, uid;

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
            } else if (dragSegment[1] === 1) {
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
            let potentialTransform = geometry.getTransform();
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
                            let tmp =
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
                        if (index === component.length - 1) {
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
                            let tmp = new Polygon(geometry.getInvertedCoordinates(), potentialTransform);
                            geometry.initial_coords_ = tmp.getPolygonCoordinates();
                        }
                    }
                    break;
                default:
                // pass
            }

            if (deleted) {
                this.setGeometryCoordinates_(geometry, coordinates);
                let segments = [];
                if (left !== undefined) {
                    this.rBush_.remove(left);
                    segments.push(left.segment[0]);
                }
                if (right !== undefined) {
                    this.rBush_.remove(right);
                    segments.push(right.segment[1]);
                }
                if (left !== undefined && right !== undefined) {
                    let newSegmentData = /** @type {ol.ModifySegmentDataType} */ ({
                        depth: segmentData.depth,
                        feature: segmentData.feature,
                        geometry: segmentData.geometry,
                        index: newIndex,
                        segment: segments
                    });
                    this.rBush_.insert(
                        Extent.boundingExtent(newSegmentData.segment),
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

}


