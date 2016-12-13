/*
 * Tests utility routines in ome.ol3.utils.Misc
 */
describe("Misc", function() {
	it('prepareResolutions', function() {
		var resolutions =
			ome.ol3.utils.Misc.prepareResolutions([]);
		expect(resolutions.length).to.eql(80);
        expect(resolutions[40]).to.eql(1);
        resolutions =
			ome.ol3.utils.Misc.prepareResolutions([1]);
        expect(resolutions.length).to.eql(80);
        expect(resolutions[40]).to.eql(1);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([2.2,0.6, 0.1]);
		expect(resolutions.length).to.eql(21);
        expect(resolutions[5]).to.eql(2.2);
        expect(resolutions[13]).to.eql(1);
        expect(resolutions.slice(14,16)).to.eql([0.6,0.1]);
	});

	it('parseSvgStringForPolyShapes', function() {
		var coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
				"M20,20 100,20 100,100 30,110");
		expect(coordinates).to.eql([[20,-20],[100,-20],[100,-100],[30,-110]]);
		coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
			"M20,20 100,20 100,100 30,110Z");
		expect(coordinates).to.eql([[20,-20],[100,-20],[100,-100],[30,-110],[20,-20]]);
		coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
				"M 4897 2756 L 4885 2786 L 4826 2904");
		expect(coordinates).to.eql([[4897,-2756],[4885,-2786],[4826,-2904]]);
		coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
				"M 4897 2756 L 4885 2786 L 4826 2904 Z");
		expect(coordinates).to.eql([[4897,-2756],[4885,-2786],[4826,-2904],[4897,-2756]]);
		coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
				"M4897,2756 4885,2786");
		expect(coordinates).to.eql([[4897,-2756],[4885,-2786]]);
		coordinates =
			ome.ol3.utils.Misc.parseSvgStringForPolyShapes(
				"M4897 2756 L 4885 2786");
		expect(coordinates).to.eql([[4897,-2756],[4885,-2786]]);
	});
});
