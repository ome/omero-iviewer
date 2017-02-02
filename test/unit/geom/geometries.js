/*
 * Tests utility routines in ome.ol3.utils.Conversion
 */
describe("Geometries", function() {

	it('createEllipse', function() {
		var ellipse =
			new ome.ol3.geom.Ellipse(100,100, 20, 40);

		assert.instanceOf(ellipse, ome.ol3.geom.Ellipse);
		expect(ellipse.getCenter()).to.eql([100, 100]);
		expect(ellipse.getRadius()).to.eql([20, 40]);

		// test translation
		ellipse.translate(-100,-100);
		expect(ellipse.getCenter()).to.eql([0, 0]);
	});

	it('createRectangle', function() {
		var rectangle =
			new ome.ol3.geom.Rectangle(500,400, 100, 200);

		assert.instanceOf(rectangle, ome.ol3.geom.Rectangle);
		expect(rectangle.getUpperLeftCorner()).to.eql([500, 400]);

		// test translation
		rectangle.translate(-500,-400);
		expect(rectangle.getUpperLeftCorner()).to.eql([0, 0]);

		// change reactangle
		rectangle.changeRectangle(1000,900, 800, 700);
		expect(rectangle.getUpperLeftCorner()).to.eql([1000, 900]);
		expect(rectangle.getWidth()).to.eql(800);
		expect(rectangle.getHeight()).to.eql(700);
	});

	it('createLabel', function() {
		var label =
			new ome.ol3.geom.Label(500,400, {width: 100, height: 200});

		assert.instanceOf(label, ome.ol3.geom.Label);
		expect(label.getUpperLeftCorner()).to.eql([500, 400]);
		expect(label.getWidth()).to.eql(100);
		expect(label.getHeight()).to.eql(200);

		// test translation
		label.translate(-500,-400);
		expect(label.getUpperLeftCorner()).to.eql([0, 0]);

		// change reactangle
		label.resize({width: 500, height: 600});
		expect(label.getWidth()).to.eql(500);
		expect(label.getHeight()).to.eql(600);

		// clone
		var cloneOfLabel = label.clone();
		expect(cloneOfLabel.getUpperLeftCorner()).to.eql(label.getUpperLeftCorner());
		expect(cloneOfLabel.getWidth()).to.eql(label.getWidth());
		expect(cloneOfLabel.getHeight()).to.eql(label.getHeight());
	});

	it('createPolyline', function() {
		var polyline =
			new ome.ol3.geom.Line([[0,0], [500,400], [600,300]]);

		assert.instanceOf(polyline, ome.ol3.geom.Line);
		expect(polyline.getFlatCoordinates()).to.eql([0,0,500,400,600,300]);

		// test translation
		polyline.translate(500,400);
		expect(polyline.getFlatCoordinates()).to.eql([500,400,1000,800,1100,700]);
	});

});
