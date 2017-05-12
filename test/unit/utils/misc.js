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
