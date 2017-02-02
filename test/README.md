# ol3-viewer unit tests

The unit tests make use of the following libraries:
mocha, chai, phantom and mocha-phantom

Mocha (https://mochajs.org/) is a js test framework.
Chai (http://chaijs.com/) is an assertion library that helps to test conditions.

Phantom (http://phantomjs.org/) is used for headless website testing.
IViewer, as a web application, relies on the browser environment,
e.g. the existence of implementations for: window, location, canvas, history, etc.
Phantom deals with that requirement so that the tests can be run in a shell even.
For a programmatic way of interacting with a web page by means of phantomjs
have a look at *unit/debug_phantom.js* or examples from their official site.

Last but not least, Mocha-Phantom (https://github.com/nathanboktae/mocha-phantomjs)
provides a wrapper to, conveniently, define a test suite as a html page
so that the unit tests can be run in the console (through phantom) as well
as the browser (without the need for additional code such as *unit/debug_phantom.js*).


To execute the unit tests in the console, run ```ant unit-tests```.

To run them in the browser open the file *unit/suite.html*.
