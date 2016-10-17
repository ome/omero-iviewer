/*
 * Tests utility routines in ome.ol3.utils.Misc
 */
describe("Misc", function() {
	it('prepareResolutions', function() {
		var resolutions =
			ome.ol3.utils.Misc.prepareResolutions([]);
		expect(resolutions).to.eql(ome.ol3.DEFAULT_RESOLUTIONS);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([2.2,0.6, 0.1]);
		expect(resolutions.slice(3, 7)).to.eql([2.2,1, 0.6, 0.1]);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([1,0.6, 0.1]);
		expect(resolutions.slice(3, 6)).to.eql([1, 0.6, 0.1]);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([5, 4.2,2.3,1.9,1,0.6]);
		expect(resolutions.slice(1, 7)).to.eql([5,4.2,2.3,1.9,1,0.6]);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([1]);
		expect(resolutions).to.eql(ome.ol3.DEFAULT_RESOLUTIONS);
		resolutions =
			ome.ol3.utils.Misc.prepareResolutions([6, 5,4.2,2.3,1.9,1,0.9,0.6, 0.5, 0.3]);
		expect(resolutions).to.eql([6, 5,4.2,2.3,1.9,1,0.9,0.6, 0.5, 0.3]);
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
