/*
 * Tests custom geometry classes
 */
describe("Style", function() {

	it('createFeatureStyle', function() {
		var shape_info = {
			"type": "PolyLine",
			"fillColor": "#00ff00",
			"fillAlpha": 0.8359375,
			"strokeAlpha": 0.765625,
			"strokeColor": "#0000ff",
			"strokeWidth": 5.0
		};

		var style =
			ome.ol3.utils.Style.createFeatureStyle(shape_info);

		assert.instanceOf(style, ol.style.Style);
		var fill = style.getFill();
		assert.instanceOf(fill, ol.style.Fill);
		expect(fill.getColor()).to.eql("rgba(0,255,0,0.8359375)");
		var stroke = style.getStroke();
		expect(stroke.getColor()).to.eql("rgba(0,0,255,0.765625)");

		shape_info = {
			"type": "Label",
			"fontStyle": "Normal",
			"fontSize": 24.0,
			"fontFamily": "sans-serif",
			"textValue": "some text",
			"strokeWidth": 1.0,
			"fillColor": "#00ff00",
			"fillAlpha": 0.640625
		}
		style =
			ome.ol3.utils.Style.createFeatureStyle(shape_info, true);

		assert.instanceOf(style, ol.style.Style);
		var textStyle = style.getText();
		assert.instanceOf(textStyle, ol.style.Text);
		expect(textStyle.getText()).to.eql("some text");
		var fill = textStyle.getFill();
		expect(fill.getColor()).to.eql("rgba(0,255,0,0.640625)");
	});
});
