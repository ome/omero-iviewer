OMERO.iviewer
=============

An OMERO.web app for visualizing images in OMERO.

Also see `SUPPORT.md <https://github.com/ome/omero-iviewer/blob/master/SUPPORT.md>`_

Requirements
============

* OMERO 5.4.0 or newer.

Build
=====

In order to build you need:

* ``nodejs`` version 6.x
* ``npm`` version equal or greater to 3.0!
* ``apache ant``

To build an uncompressed version, run:

::

    $ npm run debug


To build an uglified version, run:

::

    $ npm run prod

All builds will build into the build directory and deploy to the plugin directory
which can then be used like any Django plugin.

Install
=======

Instructions on how to add the OMERO.iviewer app to your installed OMERO.web apps
can be found in the `OMERO.iviewer README <plugin/omero_iviewer/README.rst>`_.

Development
===========

It is recommended to use the webpack dev-server to build and serve OMERO.iviewer
as this will re-compile automatically when files are saved.

To build the bundle and start the webpack dev-server (localhost:8080):

::

    $ npm run dev

You will also need an OMERO.web install with ``omero_iviewer`` installed.
To add your project to your local OMERO.web install, add the project
to your ``PYTHONPATH`` and add to ``omero.web.apps``

::

    $ export PYTHONPATH=$PYTHONPATH:/path/to/omero-iviewer/plugin
    $ bin/omero config append omero.web.apps '"omero_iviewer"'

**Notes**:

The webpack dev-server config expects a local OMERO server at http://localhost (default port 80).
Should the server instance use a different port you will need to modify all
proxy target entries in `webpack.dev.config.js <webpack.dev.config.js>`_:

.. code-block::

    devServer: {
        proxy: {
            '/iviewer/**': {
                target: 'http://localhost:your_port'
            },
            '/api/**': {
                target: 'http://localhost:your_port'
            }, ...
        }
    }

If you want to bind the webpack dev server to a port other than 8080
you will need to change its port property in `webpack.dev.config.js <webpack.dev.config.js>`_:

.. code-block::

    devServer: {
        port: your_port
    }


The initial data type (e.g. image, dataset, well) and its respective ID can be set/changed
in `index-dev.html <src/index-dev.html>`_:

.. code-block:: html

    <html>
        <head>
            <link rel="stylesheet" type="text/css" href="build/css/all.min.css" />

            <script type="text/javascript">
                // modify according to your needs
                // in particular: choose an existing id !
                window.INITIAL_REQUEST_PARAMS = {
                        'VERSION': "DEV_SERVER",
                        'WEB_API_BASE': 'api/v0/',
                        //'IMAGES': "1",
                        'DATASET': "1",
                        //'WELL': "1"
                };
            </script>
    ...

Testing
=======

To run all tests, run:

::

    $ ant unit-tests

For more details on testing, see https://github.com/ome/omero-iviewer/tree/master/tests

Documentation
=============

To build the html in build/docs, run:

::

    $ npm run docs

ol3-viewer
==========

The OMERO.iviewer's internal image viewer is based on `OpenLayers <https://openlayers.org/>`_,

For details on how to run and test this viewer independently of the OMERO.iviewer,
see https://github.com/ome/omero-iviewer/tree/master/plugin/ol3-viewer

More details
============

More detailed resources on how to create a web app and development setup can be found at:

1. `CreateApp <https://docs.openmicroscopy.org/latest/omero/developers/Web/CreateApp.html>`_
2. `Deployment <https://docs.openmicroscopy.org/latest/omero/developers/Web/Deployment.html>`_
