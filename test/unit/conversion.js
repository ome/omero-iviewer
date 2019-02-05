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

import Collection from 'ol/Collection';
import Feature from 'ol/Feature';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Ellipse from '../../src/viewers/viewer/geom/Ellipse';
import Label from '../../src/viewers/viewer/geom/Label';
import Line from '../../src/viewers/viewer/geom/Line';
import Point from '../../src/viewers/viewer/geom/Point';
import Polygon from '../../src/viewers/viewer/geom/Polygon';
import Rectangle from '../../src/viewers/viewer/geom/Rectangle';
import {REGIONS_STATE} from '../../src/viewers/viewer/globals';
import {convertRgbaColorFormatToObject,
    convertHexColorFormatToObject,
    convertColorObjectToHex,
    convertColorObjectToRgba,
    convertColorToSignedInteger,
    convertPointStringIntoCoords,
    convertSignedIntegerToColorObject,
    pointToJsonObject,
    ellipseToJsonObject,
    rectangleToJsonObject,
    lineToJsonObject,
    labelToJsonObject,
    polylineToJsonObject,
    polygonToJsonObject,
    integrateStyleIntoJsonObject,
    integrateMiscInfoIntoJsonObject,
    toJsonObject} from '../../src/viewers/viewer/utils/Conversion';
/*
 * Tests utility routines in ome.ol3.utils.Conversion
 */
describe("Conversion", function() {

    it('convertRgbaColorFormatToObject', function() {
        var colorObject = convertRgbaColorFormatToObject(
                "rgba(255,128,0,0.75)");
        assert.equal(colorObject.red,255);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue, 0);
        assert.equal(colorObject.alpha,0.75);

        colorObject = convertRgbaColorFormatToObject(
                "rgb(0,128,255)", 0.11);
        assert.equal(colorObject.red,0);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,255);
        assert.equal(colorObject.alpha,0.11);
    });

    it('convertHexColorFormatToObject', function() {
        var colorObject = convertHexColorFormatToObject("#FF8000", 0.5);
        assert.equal(colorObject.red,255);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,0);
        assert.equal(colorObject.alpha,0.5);

        colorObject = convertHexColorFormatToObject("#0080FF", 0.11);
        assert.equal(colorObject.red,0);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,255);
        assert.equal(colorObject.alpha,0.11);
    });

    it('convertColorObjectToHex', function() {
        var hexColor = convertColorObjectToHex(
            {red : 255, green : 128, blue: 0, alpha: 0.9});
        assert.equal(hexColor, "#ff8000");
    });

    it('convertColorObjectToRgba', function() {
        var rgbColor = convertColorObjectToRgba(
            {red : 255, green : 128, blue: 0});
        assert.equal(rgbColor,"rgba(255,128,0,1)");
        rgbColor = convertColorObjectToRgba(
            {red : 0, green : 128, blue: 255, alpha: 0.321 });
        assert.equal(rgbColor,"rgba(0,128,255,0.321)");
    });

    it('convertColorToSignedInteger', function() {
        var signedInteger = convertColorToSignedInteger(
                {red : 0, green : 255, blue: 0, alpha: 0.5});
        assert.equal(signedInteger,16711807);
        signedInteger = convertColorToSignedInteger("#0000FF", 0.0196);
        assert.equal(signedInteger,65285);
        signedInteger = convertColorToSignedInteger("rgba(255,112,122,0.7)");
        assert.equal(signedInteger,-9405774);
    });

    it('convertSignedIntegerToColorObject', function() {
        var color = {red : 123, green : 200, blue: 22, alpha: 0.321};
        var signedInteger = convertColorToSignedInteger(color);
        var color2 = convertSignedIntegerToColorObject(signedInteger);
        // truncate for floating point deviations
        color2.alpha = Math.floor(color2.alpha * 1000) / 1000;
        expect(color2).to.eql(color);
    });

    it('convertPointStringIntoCoords', function() {
        var points = "7,5 8,3 9,1 7,5";
        var expCoords = [[7,-5], [8,-3], [9,-1], [7,-5]];
        var coords = convertPointStringIntoCoords(points);
        for (var c in coords)
            expect(coords[c]).to.eql(coords[c], expCoords[c]);
    });

    var pointFeature = new Feature({
        geometry: new Point([10,-10])
    });

    it('pointToJsonObject', function() {
        var jsonObject = pointToJsonObject(pointFeature.getGeometry(),255);
        assert.equal(jsonObject['@id'],255);
        assert.equal(jsonObject['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point");
        assert.equal(jsonObject['X'],10);
        assert.equal(jsonObject['Y'],10);
    });

    var ellipseFeature = new Feature({
        geometry: new Ellipse(100,-100, 20, 40)
    });

    it('ellipseToJsonObject', function() {
        var jsonObject = ellipseToJsonObject(
            ellipseFeature.getGeometry(),333);
        assert.equal(jsonObject['@id'] , 333);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Ellipse");
        assert.equal(jsonObject['X'] , 100);
        assert.equal(jsonObject['Y'] , 100);
        assert.equal(jsonObject['RadiusX'] , 20);
        assert.equal(jsonObject['RadiusY'] , 40);
    });

    var rectangleFeature = new Feature({
        geometry: new Rectangle(33,-77, 20, 40)
    });

    it('rectangleToJsonObject', function() {
        var jsonObject = rectangleToJsonObject(
            rectangleFeature.getGeometry(),123);
        assert.equal(jsonObject['@id'] , 123);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['X'] , 33);
        assert.equal(jsonObject['Y'] , 77);
        assert.equal(jsonObject['Width'] , 20);
        assert.equal(jsonObject['Height'] , 40);
    });

    var lineFeature = new Feature({
        geometry: new Line([[0,0],[10,-10]])
    });

    it('lineToJsonObject', function() {
        var jsonObject = lineToJsonObject(lineFeature.getGeometry(),673);
        assert.equal(jsonObject['@id'] , 673);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Line");
        assert.equal(jsonObject['X1'] , 0);
        assert.equal(jsonObject['Y1'] , 0);
        assert.equal(jsonObject['X2'] , 10);
        assert.equal(jsonObject['Y2'] , 10);
    });

    var polylineFeature = new Feature({
        geometry: new Line([[0,0],[10,-10], [0,-100]])
    });

    it('polylineToJsonObject', function() {
        var jsonObject = polylineToJsonObject(
            polylineFeature.getGeometry(),342);
        assert.equal(jsonObject['@id'] , 342);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline");
            assert.equal(jsonObject['Points'] , '0,0 10,10 0,100');
    });

    var labelFeature = new Feature({
        geometry: new Label(500,-66, {'width' : 7, 'height' : 3})
    });

    it('labelToJsonObject', function() {
        var jsonObject = labelToJsonObject(labelFeature.getGeometry(),99);
        assert.equal(jsonObject['@id'] , 99);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['X'] , 500);
        assert.equal(jsonObject['Y'] , 66);
    });

    var polygonFeature = new Feature({
        geometry: new Polygon(
            [[[0,0],[10,-10], [0,-100], [0,0]]])
    });

    it('polygonToJsonObject', function() {
        var jsonObject = polygonToJsonObject(polygonFeature.getGeometry(),4332);
        assert.equal(jsonObject['@id'] , 4332);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon");
        assert.equal(jsonObject['Points'] , '0,0 10,10 0,100 0,0');
    });

    labelFeature.setStyle(new Style({
        "text" : new Text({
        "text" : "unit test",
        "font" : "bold 666px arial",
        "fill" : new Fill({color : "rgba(255,128,0, 1)"}),
        "stroke" : new Stroke({
        color : "rgba(255,255,0, 0.7)",
        width : 2})})
    }));
    rectangleFeature.setStyle(new Style({
        "fill" : new Fill({color : "rgba(255,128,0, 1)"}),
        "stroke" : new Stroke({
        color : "rgba(255,255,0, 0.7)",
        width : 5})}));
    rectangleFeature['TheC'] = 1;
    rectangleFeature['TheT'] = 7;
    rectangleFeature['TheZ'] = 3;

    it('integrateStyleAndMiscIntoJsonObject1', function() {
        var jsonObject = labelToJsonObject(labelFeature.getGeometry(),6);
        integrateStyleIntoJsonObject(labelFeature, jsonObject);
        assert.equal(jsonObject['@id'] , 6);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['X'] , 500);
        assert.equal(jsonObject['Y'] , 66);
        assert.equal(jsonObject['Text'] , "unit test");
        assert.equal(jsonObject['StrokeColor'], -8388353);
        assert.equal(jsonObject['StrokeWidth']['@type'] , 'TBD#LengthI');
        assert.equal(jsonObject['StrokeWidth']['Unit'] , 'PIXEL');
        assert.equal(jsonObject['StrokeWidth']['Value'] , 2);
        assert.equal(jsonObject['FontFamily'] , 'arial');
        assert.equal(jsonObject['FontStyle'] , 'bold');
        assert.equal(jsonObject['FontSize']['@type'] , 'TBD#LengthI');
        assert.equal(jsonObject['FontSize']['Unit'] , 'POINT');
        assert.equal(jsonObject['FontSize']['Value'] , 666);
    });

    it('integrateStyleAndMiscIntoJsonObject2', function() {
        var jsonObject = rectangleToJsonObject(
            rectangleFeature.getGeometry(),3);
        integrateStyleIntoJsonObject(rectangleFeature, jsonObject);
        integrateMiscInfoIntoJsonObject(rectangleFeature, jsonObject);

        assert.equal(jsonObject['@id'], 3);
        assert.equal(jsonObject['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['X'],33);
        assert.equal(jsonObject['Y'],77);
        assert.equal(jsonObject['Width'],20);
        assert.equal(jsonObject['Height'],40);
        assert.equal(jsonObject['FillColor'],-8388353);
        assert.equal(jsonObject['StrokeWidth']['@type'],'TBD#LengthI');
        assert.equal(jsonObject['StrokeWidth']['Unit'],'PIXEL');
        assert.equal(jsonObject['StrokeWidth']['Value'],1);
        assert.equal(jsonObject['TheC'],1);
        assert.equal(jsonObject['TheT'],7);
        assert.equal(jsonObject['TheZ'],3);

        // now set the old style and evaluate again
        rectangleFeature['oldStrokeStyle'] = {};
        rectangleFeature['oldStrokeStyle']['color'] =
        rectangleFeature.getStyle().getStroke().getColor();
        rectangleFeature['oldStrokeStyle']['width'] =
        rectangleFeature.getStyle().getStroke().getWidth();
        integrateStyleIntoJsonObject(rectangleFeature, jsonObject);
        assert.equal(jsonObject['StrokeColor'],-65358);
        assert.equal(jsonObject['StrokeWidth']['@type'],'TBD#LengthI');
        assert.equal(jsonObject['StrokeWidth']['Unit'],'PIXEL');
        assert.equal(jsonObject['StrokeWidth']['Value'],5);
    });

    it('toJsonObject', function() {
        var features = new Collection();
        labelFeature['state'] = REGIONS_STATE.MODIFIED;
        labelFeature['type'] = 'label';
        labelFeature.setId("1:1");
        features.push(labelFeature);
        rectangleFeature['state'] = REGIONS_STATE.ADDED;
        rectangleFeature['type'] = 'rectangle';
        rectangleFeature.setId("-1:1");
        features.push(rectangleFeature);
        pointFeature['state'] = REGIONS_STATE.ADDED;
        pointFeature['type'] = 'point';
        pointFeature.setId("-1:2");
        features.push(pointFeature);
        ellipseFeature['state'] = REGIONS_STATE.REMOVED;
        ellipseFeature.setId("2:2");
        features.push(ellipseFeature);
        lineFeature['state'] = REGIONS_STATE.REMOVED;
        lineFeature.setId("-2:-2");
        features.push(lineFeature);
        polylineFeature['state'] = REGIONS_STATE.REMOVED;
        polylineFeature.setId("10:10");
        features.push(polylineFeature);

        var empty_rois = {'10': null};
        var jsonObject = toJsonObject(features, true, empty_rois);

        assert.equal(jsonObject['count'], 5);
        assert.equal(jsonObject['modified'][0]['@id'], 1);
        assert.equal(jsonObject['modified'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['new'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['new'][1]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point");
        assert.equal(jsonObject['deleted']['2'][0], '2:2');
        assert.equal(jsonObject['new_and_deleted'][0], ['-2:-2']);
        assert.equal(jsonObject['empty_rois']['10'][0], '10:10');
    });
});
