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
