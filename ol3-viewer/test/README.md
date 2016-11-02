# ol3-viewer test
The existing unit tests use mocha, chai and phantom.js.

Run ```ant prepare-unit-tests``` to download the libraries and prepare the tests.

Due to a problem with phantom.js the console execution of the unit tests
(*ant unit-tests*) is not working. They can, however, be run in the browser by
opening the file suite.html.
