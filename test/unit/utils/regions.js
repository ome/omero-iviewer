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
        var feature = ome.ol3.utils.Regions.featureFactory(polyline_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(), ome.ol3.geom.Line);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql(
            [4897,-2756,4885,-2786,4826,-2904]);

        feature = ome.ol3.utils.Regions.featureFactory(polygon_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ol.geom.Polygon);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql(
            [5521,-2928,5304,-2795,5173,-3033,5521,-2928]);

        feature = ome.ol3.utils.Regions.featureFactory(line_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ome.ol3.geom.Line);
        expect(feature.getGeometry().getFlatCoordinates()).to.eql([10,-100,25,-20]);

        feature = ome.ol3.utils.Regions.featureFactory(point_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ol.geom.Circle);
        expect(feature.getGeometry().getCenter()).to.eql([10,-25]);
        expect(feature.getGeometry().getRadius()).to.eql(5);

        feature = ome.ol3.utils.Regions.featureFactory(label_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ome.ol3.geom.Label);
        expect(feature.getGeometry().getUpperLeftCorner()).to.eql([0,-0]);
        var dims = ome.ol3.utils.Style.measureTextDimensions(
            label_info['Text'],
            label_info['FontStyle'] + " " + label_info['FontSize']['Value'] +
            "px " + label_info['FontFamily'], null);
        expect(feature.getGeometry().getWidth()).to.eql(dims.width);
        expect(feature.getGeometry().getHeight()).to.eql(dims.height);

        feature = ome.ol3.utils.Regions.featureFactory(rectangle_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ome.ol3.geom.Rectangle);
        expect(feature.getGeometry().getUpperLeftCorner()).to.eql([1000,-2000]);
        expect(feature.getGeometry().getWidth()).to.eql(12);
        expect(feature.getGeometry().getHeight()).to.eql(15);

        feature = ome.ol3.utils.Regions.featureFactory(ellipse_info);
        assert.instanceOf(feature, ol.Feature);
        assert.instanceOf(feature.getGeometry(),  ome.ol3.geom.Ellipse);
        expect(feature.getGeometry().getCenter()).to.eql([300,-250]);
        expect(feature.getGeometry().getRadius()).to.eql([25, 55]);
    });

    it('generateRegions', function() {
        var features =
            ome.ol3.utils.Regions.generateRegions(
                polygon_info, 10, [0,0,1000,1000], true);

        assert.instanceOf(features, Array);
        for (var f in features) {
            assert.instanceOf(features[f], ol.Feature);
            var geom = features[f].getGeometry();
            assert.instanceOf(geom, ol.geom.Polygon);
            assert(ol.extent.containsExtent([0,-1000,1000,0], geom.getExtent()));
        }
    });

});
