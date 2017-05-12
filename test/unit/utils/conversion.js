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

/*
 * Tests utility routines in ome.ol3.utils.Conversion
 */
describe("Conversion", function() {

    it('convertRgbaColorFormatToObject', function() {
        var colorObject =
            ome.ol3.utils.Conversion.convertRgbaColorFormatToObject(
                "rgba(255,128,0,0.75)");
        assert.equal(colorObject.red,255);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue, 0);
        assert.equal(colorObject.alpha,0.75);

        colorObject =
            ome.ol3.utils.Conversion.convertRgbaColorFormatToObject(
                "rgb(0,128,255)", 0.11);
        assert.equal(colorObject.red,0);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,255);
        assert.equal(colorObject.alpha,0.11);
    });

    it('convertHexColorFormatToObject', function() {
        var colorObject =
            ome.ol3.utils.Conversion.convertHexColorFormatToObject(
                "#FF8000", 0.5);
        assert.equal(colorObject.red,255);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,0);
        assert.equal(colorObject.alpha,0.5);

        colorObject =
            ome.ol3.utils.Conversion.convertHexColorFormatToObject(
                "#0080FF", 0.11);
        assert.equal(colorObject.red,0);
        assert.equal(colorObject.green,128);
        assert.equal(colorObject.blue,255);
        assert.equal(colorObject.alpha,0.11);
    });

    it('convertColorObjectToHex', function() {
        var hexColor =
            ome.ol3.utils.Conversion.convertColorObjectToHex(
                {red : 255, green : 128, blue: 0, alpha: 0.9});
        assert.equal(hexColor, "#ff8000");
    });

    it('convertColorObjectToRgba', function() {
        var rgbColor =
            ome.ol3.utils.Conversion.convertColorObjectToRgba(
                {red : 255, green : 128, blue: 0});
        assert.equal(rgbColor,"rgba(255,128,0,1)");
        rgbColor =
            ome.ol3.utils.Conversion.convertColorObjectToRgba(
                {red : 0, green : 128, blue: 255, alpha: 0.321 });
        assert.equal(rgbColor,"rgba(0,128,255,0.321)");
    });

    it('convertColorToSignedInteger', function() {
        var signedInteger =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(
                {red : 0, green : 255, blue: 0, alpha: 0.5});
        assert.equal(signedInteger,16711807);
        signedInteger =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(
                "#0000FF", 0.0196);
        assert.equal(signedInteger,65285);
        signedInteger =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(
                "rgba(255,112,122,0.7)");
        assert.equal(signedInteger,-9405774);
    });

    it('convertSignedIntegerToColorObject', function() {
        var color = {red : 123, green : 200, blue: 22, alpha: 0.321};
        var signedInteger =
            ome.ol3.utils.Conversion.convertColorToSignedInteger(color);
        var color2 =
            ome.ol3.utils.Conversion.convertSignedIntegerToColorObject(
                signedInteger);
        // truncate for floating point deviations
        color2.alpha = Math.floor(color2.alpha * 1000) / 1000;
        expect(color2).to.eql(color);
    });

    it('convertPointStringIntoCoords', function() {
        var points = "7,5 8,3 9,1 7,5";
        var expCoords = [[7,-5], [8,-3], [9,-1], [7,-5]];
        var coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(points);
        for (var c in coords)
            expect(coords[c]).to.eql(coords[c], expCoords[c]);
    });

    var pointFeature = new ol.Feature({
        geometry: new ol.geom.Circle([10,-10], 2)
    });

    it('pointToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.pointToJsonObject(
                pointFeature.getGeometry(),255);
        assert.equal(jsonObject['@id'],255);
        assert.equal(jsonObject['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point");
        assert.equal(jsonObject['X'],10);
        assert.equal(jsonObject['Y'],10);
    });

    var ellipseFeature = new ol.Feature({
        geometry: new ome.ol3.geom.Ellipse(100,-100, 20, 40)
    });

    it('ellipseToJsonObject', function() {
        var jsonObject =
        ome.ol3.utils.Conversion.ellipseToJsonObject(
            ellipseFeature.getGeometry(),333);
        assert.equal(jsonObject['@id'] , 333);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Ellipse");
        assert.equal(jsonObject['X'] , 100);
        assert.equal(jsonObject['Y'] , 100);
        assert.equal(jsonObject['RadiusX'] , 20);
        assert.equal(jsonObject['RadiusY'] , 40);
    });

    var rectangleFeature = new ol.Feature({
        geometry: new ome.ol3.geom.Rectangle(33,-77, 20, 40)
    });

    it('rectangleToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.rectangleToJsonObject(
        rectangleFeature.getGeometry(),123);
        assert.equal(jsonObject['@id'] , 123);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['X'] , 33);
        assert.equal(jsonObject['Y'] , 77);
        assert.equal(jsonObject['Width'] , 20);
        assert.equal(jsonObject['Height'] , 40);
    });

    var lineFeature = new ol.Feature({
        geometry: new ome.ol3.geom.Line([[0,0],[10,-10]])
    });

    it('lineToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.lineToJsonObject(
        lineFeature.getGeometry(),673);
        assert.equal(jsonObject['@id'] , 673);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Line");
        assert.equal(jsonObject['X1'] , 0);
        assert.equal(jsonObject['Y1'] , 0);
        assert.equal(jsonObject['X2'] , 10);
        assert.equal(jsonObject['Y2'] , 10);
    });

    var polylineFeature = new ol.Feature({
        geometry: new ome.ol3.geom.Line([[0,0],[10,-10], [0,-100]])
    });

    it('polylineToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.polylineToJsonObject(
                polylineFeature.getGeometry(),342);
        assert.equal(jsonObject['@id'] , 342);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline");
            assert.equal(jsonObject['Points'] , '0,0 10,10 0,100');
    });

    var labelFeature = new ol.Feature({
        geometry: new ome.ol3.geom.Label(500,-66, {'width' : 7, 'height' : 3})
    });

    it('labelToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.labelToJsonObject(
                labelFeature.getGeometry(),99);
        assert.equal(jsonObject['@id'] , 99);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['X'] , 500);
        assert.equal(jsonObject['Y'] , 66);
    });

    var polygonFeature = new ol.Feature({
        geometry: new ol.geom.Polygon(
            [[[0,0],[10,-10], [0,-100], [0,0]]])
    });

    it('polygonToJsonObject', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.polygonToJsonObject(
                polygonFeature.getGeometry(),4332);
        assert.equal(jsonObject['@id'] , 4332);
        assert.equal(jsonObject['@type'] ,
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polygon");
        assert.equal(jsonObject['Points'] , '0,0 10,10 0,100 0,0');
    });

    labelFeature.setStyle(new ol.style.Style({
        "text" : new ol.style.Text({
        "text" : "unit test",
        "font" : "bold 666px arial",
        "fill" : new ol.style.Fill({color : "rgba(255,128,0, 1)"}),
        "stroke" : new ol.style.Stroke({
        color : "rgba(255,255,0, 0.7)",
        width : 2})})
    }));
    rectangleFeature.setStyle(new ol.style.Style({
        "fill" : new ol.style.Fill({color : "rgba(255,128,0, 1)"}),
        "stroke" : new ol.style.Stroke({
        color : "rgba(255,255,0, 0.7)",
        width : 5})}));
    rectangleFeature['TheC'] = 1;
    rectangleFeature['TheT'] = 7;
    rectangleFeature['TheZ'] = 3;

    it('integrateStyleAndMiscIntoJsonObject1', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.labelToJsonObject(
                labelFeature.getGeometry(),6);
        ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
            labelFeature, jsonObject);
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
        assert.equal(jsonObject['FontSize']['Unit'] , 'PIXEL');
        assert.equal(jsonObject['FontSize']['Value'] , 666);
    });

    it('integrateStyleAndMiscIntoJsonObject2', function() {
        var jsonObject =
            ome.ol3.utils.Conversion.rectangleToJsonObject(
                rectangleFeature.getGeometry(),3);
        ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
            rectangleFeature, jsonObject);
        ome.ol3.utils.Conversion.integrateMiscInfoIntoJsonObject(
            rectangleFeature, jsonObject);

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
        ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
            rectangleFeature, jsonObject);
        assert.equal(jsonObject['StrokeColor'],-65358);
        assert.equal(jsonObject['StrokeWidth']['@type'],'TBD#LengthI');
        assert.equal(jsonObject['StrokeWidth']['Unit'],'PIXEL');
        assert.equal(jsonObject['StrokeWidth']['Value'],5);
    });

    it('toJsonObject', function() {
        var features = new ol.Collection();
        labelFeature['state'] = ome.ol3.REGIONS_STATE.MODIFIED;
        labelFeature['type'] = 'label';
        labelFeature.setId("1:1");
        features.push(labelFeature);
        rectangleFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;
        rectangleFeature['type'] = 'rectangle';
        rectangleFeature.setId("-1:1");
        features.push(rectangleFeature);
        pointFeature['state'] = ome.ol3.REGIONS_STATE.ADDED;
        pointFeature['type'] = 'point';
        pointFeature.setId("-1:2");
        features.push(pointFeature);

        var jsonObject = ome.ol3.utils.Conversion.toJsonObject(features);

        assert.equal(jsonObject['count'],3);
        assert.equal(jsonObject['rois']['1']['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI");
        assert.equal(jsonObject['rois']['1']['shapes'][0]['@id'],1);
        assert.equal(jsonObject['rois']['1']['shapes'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['rois']['-1']['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI");
        assert.equal(jsonObject['rois']['-1']['shapes'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['rois']['-1']['shapes'][1]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point");

        // test variation: each shape gets its own roi
        var jsonObject = ome.ol3.utils.Conversion.toJsonObject(features, true);

        assert.equal(jsonObject['count'], 3);
        assert.equal(jsonObject['rois']['1']['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI");
        assert.equal(jsonObject['rois']['1']['shapes'][0]['@id'],1);
        assert.equal(jsonObject['rois']['1']['shapes'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Label");
        assert.equal(jsonObject['rois']['-1']['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI");
        assert.equal(jsonObject['rois']['-1']['shapes'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Rectangle");
        assert.equal(jsonObject['rois']['-2']['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI");
        assert.equal(jsonObject['rois']['-2']['shapes'][0]['@type'],
            "http://www.openmicroscopy.org/Schemas/OME/2016-06#Point");
    });
});
