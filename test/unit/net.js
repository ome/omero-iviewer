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

import {checkAndSanitizeServerAddress,
    checkAndSanitizeUri} from '../../src/viewers/viewer/utils/Net';
/*
 * Tests utility routines in ome.ol3.utils.Net
 */
describe("Net", function() {

    it('checkAndSanitizeServerAddress', function() {
        var sanitizedAddress = checkAndSanitizeServerAddress("www.blablab.at");

        expect(sanitizedAddress['protocol']).to.eql("http");
        expect(sanitizedAddress['server']).to.eql("www.blablab.at");
        expect(sanitizedAddress['full']).to.eql("http://www.blablab.at");

        sanitizedAddress = checkAndSanitizeServerAddress(
            "https://demo.openmicroscopy.org/web");

        expect(sanitizedAddress['protocol']).to.eql("https");
        expect(sanitizedAddress['server']).to.eql("demo.openmicroscopy.org/web");
        expect(sanitizedAddress['full']).to.eql("https://demo.openmicroscopy.org/web");

        sanitizedAddress = checkAndSanitizeServerAddress("127.0.0.1/myproxy");

        expect(sanitizedAddress['protocol']).to.eql("http");
        expect(sanitizedAddress['server']).to.eql("127.0.0.1/myproxy");
        expect(sanitizedAddress['full']).to.eql("http://127.0.0.1/myproxy");
    });

    it('checkAndSanitizeUri', function() {
        var sanitizedUri = checkAndSanitizeUri(
            "////some_path/even_longer/?query=SHDHDF&bla=what");

        expect(sanitizedUri['path']).to.eql("some_path/even_longer");
        expect(sanitizedUri['query']).to.eql("query=SHDHDF&bla=what");
        expect(sanitizedUri['full']).to.eql("some_path/even_longer/?query=SHDHDF&bla=what");
        expect(sanitizedUri['relative']).to.eql(false);

        sanitizedUri = checkAndSanitizeUri("some_relative/dataset/1/");

        expect(sanitizedUri['path']).to.eql("some_relative/dataset/1");
        expect(sanitizedUri['query']).to.eql("");
        expect(sanitizedUri['full']).to.eql("some_relative/dataset/1");
        expect(sanitizedUri['relative']).to.eql(true);
    });

});
