/*
 * Tests utility routines in ome.ol3.utils.Misc
 */
describe("Misc", function() {
    it('prepareResolutions', function() {
        var resolutions = ome.ol3.utils.Misc.prepareResolutions([]);
        expect(resolutions.length).to.eql(80);
        expect(resolutions[40]).to.eql(1);
        resolutions = ome.ol3.utils.Misc.prepareResolutions([1]);
        expect(resolutions.length).to.eql(80);
        expect(resolutions[40]).to.eql(1);
        resolutions = ome.ol3.utils.Misc.prepareResolutions([2.2,0.6, 0.1]);
        expect(resolutions.length).to.eql(21);
        expect(resolutions[5]).to.eql(2.2);
        expect(resolutions[13]).to.eql(1);
        expect(resolutions.slice(14,16)).to.eql([0.6,0.1]);
    });
});
