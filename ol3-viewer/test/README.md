# ol3-viewer test
Tests available are unit tests as well as integration tests.

Pre-requisites for running the former and latter is the node package manager (npm).

Unit tests are done via mocha, chai and phantom.js.

Integration tests use selenium and require running instances of omero server and web
on your localhost.

To download the required libraries you need to execute:

*ant prepare-unit-tests* or *ant prepare-integration-tests*

Then you can start the tests:

*ant unit-tests* or *ant integration-test*
