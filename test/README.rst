Unit tests
==========


The unit tests make use of the following libraries: karma, mocha, chai.

`Karma <https://karma-runner.github.io/>`_ is a test runner,
`Mocha <https://mochajs.org/>`_ is a js test framework and
`Chai <http://chaijs.com/>`_ is an assertion library that helps to test conditions.

Karma uses a `webpack plugin <https://github.com/webpack-contrib/karma-webpack>`_
to compile the tests with the source code. The resulting files are served to
a browser client for testing.
Karma can launch a client such as headless Chrome for testing via the command line,
or you can point other browsers at the webserver to test on them.

To execute the unit tests run the following command in the console: ::

$ ant unit-tests

This will first install all the dependencies required and is run by the 
test command in ``plugins/setup.py``. You can also run the tests directly
once you have the dependencies installed, for example: ::

$ karma start --single-run --browsers ChromeHeadless
