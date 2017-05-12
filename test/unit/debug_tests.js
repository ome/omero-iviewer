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
 * if you wish to debug, you have to make the following modifications to suite.html:
 *
 *  1. replace the line "mocha.run()" in the script tag with the following snippet:
 *
 *        setTimeout(function() {
 *             var not_loaded = tests.length;
 *             tests.map(function(file) {
 *                 addScript(file, function() {
 *                     not_loaded--;
 *                     if (not_loaded === 0) mocha.run();
 *                 })
 *             });
 *         }, 2000);
 *
 *  2. uncomment the line in the head tag:
 * <!--script type="text/javascript" src="debug_tests.js"></script-->
 */
function addScript(src, callback) {
  var s = document.createElement('script');
  s.setAttribute('src', src);
  s.onload=callback;
  s.onerror=function(what) {
      console.error(what);
  };
  document.head.appendChild(s);
}

var tests = [
    'utils/conversion.js',
    'utils/misc.js',
    'utils/net.js',
    'utils/regions.js',
    'utils/style.js',
    'geom/geometries.js'
];
