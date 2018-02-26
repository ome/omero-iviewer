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
 * Tests rois in terms of malformed, unusual or missing info
 */
describe("Rois", function() {

    it('pointStringWithAdditionalWhitespacing', function() {
        var points = " 7,5 8,3 9,1 7,5 ";
        var expCoords = [[7,-5], [8,-3], [9,-1], [7,-5]];
        var coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(points);
        for (var c in coords)
            expect(coords[c]).to.deep.equal(expCoords[c]);
    });

    it('pointStringWithNaN', function() {
        var points = "7,5 8,3 9,aaaaa 7,5";
        var coords =
            ome.ol3.utils.Conversion.convertPointStringIntoCoords(points);
        expect(coords === null);
    });

    it('checkMinimalStroke', function() {
        var jsonObject = {
            '@id': 255,
            '@type': "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline",
            'Points': "0,0 10,10 0,100"
        };
        // set internal type for feature factory
        // to be able to test on featureFactory level
        jsonObject['type'] = 'polyline';
        var parsedPolylineFeature =
            ome.ol3.utils.Regions.featureFactory(jsonObject);
        var appliedStrokeStyle = parsedPolylineFeature.getStyle().getStroke();
        expect(appliedStrokeStyle.getColor()).to.equal("rgba(255,255,255,1)");
        expect(appliedStrokeStyle.getWidth()).to.equal(1);
    });
});
