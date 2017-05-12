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

/**
 * THIS IS NOT USED FOR THE UNIT TESTS OTHER THAN FOR DEBUGGING ON DEMAND!!!
 * THE TESTS LISTED IN THIS FILE DO NOT NEED TO BE KEPT UP TO DATE !!!!
 *
 * In particular, you can debug mocha this way:
 * mocha debug_mocha.js
 *
 * IMPORTANT:
 * mocha is not agnostic of browser environments, hence its use with
 * phantomjs as a headless test environment.
 * For code that does use browser objects you do have to define mock versions
 * (as is done below)
 */

// create fake/mock instances of needed browser objects/functions
window = {};
navigator = {
    'geolocation' : '',
    'userAgent' : ''
};
document = {
    'implementation' : {'createDocument' : function() {}},
    'createElement' : function() {
        return {
            getContext : function() {
                return {
                    measureText : function() {
                        return {width: 0, height: 0}
                    }}
                }
            }
    }
};

// the built library
require('../build/ol3-viewer-test.js')

global.chai = require('../../node_modules/chai/chai.js')
global.assert = chai.assert;
global.expect = chai.expect;

// tests
require('./utils/conversion.js')
require('./utils/misc.js')
require('./utils/net.js')
require('./utils/regions.js')
require('./utils/style.js')
require('./geom/geometries.js')
