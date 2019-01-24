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

import Feature from 'ol/Feature';
import OlPolygon from 'ol/geom/Polygon';
import {containsExtent,
    getTopLeft} from 'ol/extent';
import {featureFactory,
    generateRegions,
    calculateLengthAndArea} from '../../src/viewers/viewer/utils/Regions';
import {measureTextDimensions} from '../../src/viewers/viewer/utils/Style';
import Ellipse from '../../src/viewers/viewer/geom/Ellipse';
import Label from '../../src/viewers/viewer/geom/Label';
import Line from '../../src/viewers/viewer/geom/Line';
import Point from '../../src/viewers/viewer/geom/Point';
import Polygon from '../../src/viewers/viewer/geom/Polygon';
import Rectangle from '../../src/viewers/viewer/geom/Rectangle';

/*
 * Tests utility routines in ome.ol3.utils.Regions
 */
describe("Regions", function() {
    var polyline_info = {
        "type": "PolyLine",
        "Points": "4897,2756 4885,2786 4826,2904"
    };

    var polygon_info = {
        "type": "Polygon",
        "Points": "5521,2928 5304,2795 5173,3033 5521,2928"
    };

    var line_info = {
        "type": "Line",
        "X1" : 10,
        "X2" : 25,
        "Y1" : 100,
        "Y2" : 20
    };

    var point_info = {
        "type": "Point",
        "X" : 10,
        "Y" : 25
    };

    var label_info = {
        "type": "label",
        "X" : 0,
        "Y" : 0,
        "Text" : "hello world",
        "FontStyle" : "Normal",
        "FontSize": { "Value": 24.0, "Unit": "PIXEL"},
        "FontFamily" : "sans-serif"
    };

    var rectangle_info = {
        "type": "Rectangle",
        "X" : 1000,
        "Y" : 2000,
        "Width" : 12,
        "Height" : 15
    };

    var ellipse_info = {
        "type": "Ellipse",
        "X" : 300,
        "Y" : 250,
        "RadiusX" : 25,
        "RadiusY" : 55
    };

    it('featureFactory', function() {
        var feature = featureFactory(polyline_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Line);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql(
            [4897,-2756,4885,-2786,4826,-2904]);

        feature = featureFactory(polygon_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Polygon);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql(
            [5521,-2928,5304,-2795,5173,-3033,5521,-2928]);

        feature = featureFactory(line_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Line);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql([10,-100,25,-20]);

        feature = featureFactory(point_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Point);
        expect(feature.getGeometry().getCenter()).to.eql([10,-25]);
        expect(feature.getGeometry().getRadius()).to.eql(5);

        feature = featureFactory(label_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Label);
        expect(feature.getGeometry().getUpperLeftCorner()).to.eql([0,-0]);
        var dims = measureTextDimensions(
            label_info['Text'],
            label_info['FontStyle'] + " " + label_info['FontSize']['Value'] +
            "px " + label_info['FontFamily'], null);
        expect(feature.getGeometry().getWidth()).to.eql(dims.width);
        expect(feature.getGeometry().getHeight()).to.eql(dims.height);

        feature = featureFactory(rectangle_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Rectangle);
        expect(feature.getGeometry().getUpperLeftCorner()).to.eql([1000,-2000]);
        expect(feature.getGeometry().getWidth()).to.eql(12);
        expect(feature.getGeometry().getHeight()).to.eql(15);

        feature = featureFactory(ellipse_info);
        assert.instanceOf(feature, Feature);
        assert.instanceOf(feature.getGeometry(), Ellipse);
        expect(feature.getGeometry().getCenter()).to.eql([300,-250]);
        expect(feature.getGeometry().getRadius()).to.eql([25, 55]);
    });

    it('generateRegionsRandom', function() {
        var features = generateRegions(polygon_info, 10, [0,-1000,1000,0]);

        assert.instanceOf(features, Array);
        for (var f in features) {
            assert.instanceOf(features[f], Feature);
            var geom = features[f].getGeometry();
            assert.instanceOf(geom, Polygon);
            assert(containsExtent([0,-1000,1000,0], geom.getExtent()));
        }
    });

    it('generateRegionsPosition', function() {
        var features = generateRegions(
                polygon_info, 1, [0,-1000,1000,0], [0,0]);

        assert.instanceOf(features, Array);
        for (var f in features) {
            assert.instanceOf(features[f], Feature);
            var geom = features[f].getGeometry();
            assert.instanceOf(geom, Polygon);
            expect(getTopLeft(geom.getExtent())).to.deep.equal([0,0]);
        }
    });

    it('generateRegionsSamePlace', function() {
        var features = generateRegions(
                polygon_info, 1, [0,-1000,1000,0], null, true);
        var expGeom =
            featureFactory(polygon_info).getGeometry();

        assert.instanceOf(features, Array);
        for (var f in features) {
            assert.instanceOf(features[f], Feature);
            var geom = features[f].getGeometry();
            assert.instanceOf(geom, Polygon);
            expect(geom.getPolygonCoordinates()).to.deep.equal(
                expGeom.getPolygonCoordinates());
        }
    });

    it('measureRegions', function() {
        var feature = featureFactory(rectangle_info);
        var measurement = calculateLengthAndArea(feature);

        assert.instanceOf(measurement, Object);
        expect(measurement.Area).to.eql(180);
        expect(measurement.Length).to.eql(-1);

        feature = featureFactory(line_info);
        measurement = calculateLengthAndArea(feature);

        assert.instanceOf(measurement, Object);
        expect(measurement.Area).to.eql(-1);
        expect(measurement.Length).to.eql(81.394);

        feature = featureFactory(polyline_info);
        measurement = calculateLengthAndArea(feature);
        assert.instanceOf(measurement, Object);
        expect(measurement.Area).to.eql(-1);
        expect(measurement.Length).to.eql(164.239);

        feature = featureFactory(point_info);
        measurement = calculateLengthAndArea(feature);

        assert.instanceOf(measurement, Object);
        expect(measurement.Area).to.eql(-1);
        expect(measurement.Length).to.eql(-1);

    });

});
