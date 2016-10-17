/*
 * Tests utility routines in ome.ol3.utils.Conversion
 */
describe("Conversion", function() {

		it('convertRgbaColorFormatToObject', function() {
			var colorObject =
				ome.ol3.utils.Conversion.convertRgbaColorFormatToObject("rgba(255,128,0,0.75)");
			assert(colorObject.red === 255);
			assert(colorObject.green === 128);
			assert(colorObject.blue === 0);
			assert(colorObject.alpha === 0.75);

			colorObject =
				ome.ol3.utils.Conversion.convertRgbaColorFormatToObject("rgb(0,128,255)", 0.11);
			assert(colorObject.red === 0);
			assert(colorObject.green === 128);
			assert(colorObject.blue === 255);
			assert(colorObject.alpha === 0.11);
		});

		it('convertHexColorFormatToObject', function() {
			var colorObject =
				ome.ol3.utils.Conversion.convertHexColorFormatToObject("#FF8000", 0.5);
			assert(colorObject.red === 255);
			assert(colorObject.green === 128);
			assert(colorObject.blue === 0);
			assert(colorObject.alpha === 0.5);

			colorObject =
				ome.ol3.utils.Conversion.convertHexColorFormatToObject("#0080FF", 0.11);
			assert(colorObject.red === 0);
			assert(colorObject.green === 128);
			assert(colorObject.blue === 255);
			assert(colorObject.alpha === 0.11);
		});

		it('convertColorObjectToHex', function() {
			var hexColor =
				ome.ol3.utils.Conversion.convertColorObjectToHex(
					{red : 255, green : 128, blue: 0, alpha: 0.9});
			assert(hexColor === "#ff8000");
		});

		it('convertColorObjectToRgba', function() {
			var rgbColor =
				ome.ol3.utils.Conversion.convertColorObjectToRgba(
					{red : 255, green : 128, blue: 0});
			assert(rgbColor === "rgba(255,128,0,1)");
			rgbColor =
				ome.ol3.utils.Conversion.convertColorObjectToRgba(
					{red : 0, green : 128, blue: 255, alpha: 0.321 });
			assert(rgbColor === "rgba(0,128,255,0.321)");
		});

		it('convertColorToSignedInteger', function() {
			var signedInteger =
				ome.ol3.utils.Conversion.convertColorToSignedInteger(
					{red : 255, green : 128, blue: 0, alpha: 1});
			assert(signedInteger === -32768);
			signedInteger =
				ome.ol3.utils.Conversion.convertColorToSignedInteger(
					"#0080FF", 0.0196);
			assert(signedInteger === 83919103);
			signedInteger =
				ome.ol3.utils.Conversion.convertColorToSignedInteger("rgba(255,255,0, 0.7)");
			assert(signedInteger === -1291845888);
		});

		var pointFeature = new ol.Feature({
					geometry: new ol.geom.Circle([10,-10], 2)
		});

		it('pointToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.pointToJsonObject(
					pointFeature.getGeometry(),255);
			assert(jsonObject['@id'] === 255);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Point");
			assert(jsonObject['X'] === 10);
			assert(jsonObject['Y'] === 10);
		});

		var ellipseFeature = new ol.Feature({
					geometry: new ome.ol3.geom.Ellipse(100,-100, 20, 40)
		});

		it('ellipseToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.ellipseToJsonObject(
					ellipseFeature.getGeometry(),333);
			assert(jsonObject['@id'] === 333);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Ellipse");
			assert(jsonObject['X'] === 100);
			assert(jsonObject['Y'] === 100);
			assert(jsonObject['RadiusX'] === 20);
			assert(jsonObject['RadiusY'] === 40);
		});

		var rectangleFeature = new ol.Feature({
					geometry: new ome.ol3.geom.Rectangle(33,-77, 20, 40)
		});

		it('rectangleToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.rectangleToJsonObject(
					rectangleFeature.getGeometry(),123);
			assert(jsonObject['@id'] === 123);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Rectangle");
			assert(jsonObject['X'] === 33);
			assert(jsonObject['Y'] === 77);
			assert(jsonObject['Width'] === 20);
			assert(jsonObject['Height'] === 40);
		});

		var lineFeature = new ol.Feature({
					geometry: new ol.geom.LineString([[0,0],[10,-10]])
		});

		it('lineToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.lineToJsonObject(
					lineFeature.getGeometry(),673);
			assert(jsonObject['@id'] === 673);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Line");
			assert(jsonObject['X1'] === 0);
			assert(jsonObject['Y1'] === 0);
			assert(jsonObject['X2'] === 10);
			assert(jsonObject['Y2'] === 10);
		});

		var polylineFeature = new ol.Feature({
					geometry: new ol.geom.LineString([[0,0],[10,-10], [0,-100]])
		});

		it('polylineToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.polylineToJsonObject(
					polylineFeature.getGeometry(),342);
			assert(jsonObject['@id'] === 342);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Polyline");
			assert(jsonObject['Points'] === '0,0 10,10 0,100');
		});

		var labelFeature = new ol.Feature({
					geometry: new ome.ol3.geom.Label(500,-66, {'width' : 7, 'height' : 3})
		});

		it('labelToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.labelToJsonObject(
					labelFeature.getGeometry(),99);
			assert(jsonObject['@id'] === 99);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Label");
			assert(jsonObject['X'] === 500);
			assert(jsonObject['Y'] === 66);
		});

		var polygonFeature = new ol.Feature({
					geometry: new ol.geom.Polygon(
						[[[0,0],[10,-10], [0,-100], [0,0]]])
		});

		it('polygonToJsonObject', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.polygonToJsonObject(
					polygonFeature.getGeometry(),4332);
			assert(jsonObject['@id'] === 4332);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Polygon");
			assert(jsonObject['Points'] === '0,0 10,10 0,100 0,0');
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
		rectangleFeature['theC'] = 1;
		rectangleFeature['theT'] = 7;
		rectangleFeature['theZ'] = 3;

		it('integrateStyleAndMiscIntoJsonObject1', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.labelToJsonObject(
					labelFeature.getGeometry(),6);
			ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
				labelFeature, jsonObject);
			assert(jsonObject['@id'] === 6);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Label");
			assert(jsonObject['X'] === 500);
			assert(jsonObject['Y'] === 66);
			assert(jsonObject['Text'] === "unit test");
			assert(jsonObject['StrokeColor'] === -1291845888);
			assert(jsonObject['StrokeWidth']['@type'] === 'TBD#LengthI');
			assert(jsonObject['StrokeWidth']['Unit'] === 'PIXEL');
			assert(jsonObject['StrokeWidth']['Value'] === 2);
			assert(jsonObject['FontFamily'] === 'arial');
			assert(jsonObject['FontStyle'] === 'bold');
			assert(jsonObject['FontSize']['@type'] === 'TBD#LengthI');
			assert(jsonObject['FontSize']['Unit'] === 'PIXEL');
			assert(jsonObject['FontSize']['Value'] === 666);
		});

		it('integrateStyleAndMiscIntoJsonObject2', function() {
			var jsonObject =
				ome.ol3.utils.Conversion.rectangleToJsonObject(
					rectangleFeature.getGeometry(),3);
			ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
				rectangleFeature, jsonObject);
			ome.ol3.utils.Conversion.integrateMiscInfoIntoJsonObject(
				rectangleFeature, jsonObject);

			assert(jsonObject['@id'] === 3);
			assert(jsonObject['@type'] ===
			 	"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Rectangle");
			assert(jsonObject['X'] === 33);
			assert(jsonObject['Y'] === 77);
			assert(jsonObject['Width'] === 20);
			assert(jsonObject['Height'] === 40);
			assert(jsonObject['FillColor'] === -32768);
			assert(jsonObject['StrokeWidth']['@type'] === 'TBD#LengthI');
			assert(jsonObject['StrokeWidth']['Unit'] === 'PIXEL');
			assert(jsonObject['StrokeWidth']['Value'] === 1);
			assert(jsonObject['TheC'] === 1);
			assert(jsonObject['TheT'] === 7);
			assert(jsonObject['TheZ'] === 3);

			// now set the old style and evaluate again
			rectangleFeature['oldStrokeStyle'] = {};
			rectangleFeature['oldStrokeStyle']['color'] =
				rectangleFeature.getStyle().getStroke().getColor();
			rectangleFeature['oldStrokeStyle']['width'] =
				rectangleFeature.getStyle().getStroke().getWidth();
			ome.ol3.utils.Conversion.integrateStyleIntoJsonObject(
			rectangleFeature, jsonObject);
			assert(jsonObject['StrokeColor'] === -1291845888);
			assert(jsonObject['StrokeWidth']['@type'] === 'TBD#LengthI');
			assert(jsonObject['StrokeWidth']['Unit'] === 'PIXEL');
			assert(jsonObject['StrokeWidth']['Value'] === 5);
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

			var jsonObject =
				ome.ol3.utils.Conversion.toJsonObject(features);

			assert(jsonObject['count'] === 3);
			assert(jsonObject['rois']['1']['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI");
			assert(jsonObject['rois']['1']['shapes'][0]['@id'] === 1);
			assert(jsonObject['rois']['1']['shapes'][0]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Label");
			assert(jsonObject['rois']['-1']['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI");
			assert(jsonObject['rois']['-1']['shapes'][0]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Rectangle");
			assert(jsonObject['rois']['-1']['shapes'][1]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Point");

			// test variation: each shape gets its own roi
			var jsonObject =
				ome.ol3.utils.Conversion.toJsonObject(features, true);

			assert(jsonObject['count'] === 3);
			assert(jsonObject['rois']['1']['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI");
			assert(jsonObject['rois']['1']['shapes'][0]['@id'] === 1);
			assert(jsonObject['rois']['1']['shapes'][0]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Label");
			assert(jsonObject['rois']['-1']['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI");
			assert(jsonObject['rois']['-1']['shapes'][0]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Rectangle");
			assert(jsonObject['rois']['-2']['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#ROI");
			assert(jsonObject['rois']['-2']['shapes'][0]['@type'] ===
				"http://www.openmicroscopy.org/Schemas/ROI/2015-01#Point");
		});
});
