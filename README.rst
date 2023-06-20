.. image:: https://github.com/ome/omero-iviewer/workflows/OMERO/badge.svg
    :target: https://github.com/ome/omero-iviewer/actions

.. image:: https://badge.fury.io/py/omero-iviewer.svg
    :target: https://badge.fury.io/py/omero-iviewer

OMERO.iviewer
=============

An OMERO.web app for visualizing images in OMERO.

Also see `SUPPORT.md <https://github.com/ome/omero-iviewer/blob/master/SUPPORT.md>`_

Requirements
============

* OMERO 5.6.0 or newer.

Install
=======

Instructions on how to add the OMERO.iviewer app to your installed OMERO.web apps
can be found in the `OMERO.iviewer README <plugin/omero_iviewer/README.rst>`_.

Usage
=====

A guide to using OMERO.iviewer can be found on
https://omero-guides.readthedocs.io/en/latest/iviewer/docs/index.html

Settings
========

OMERO limits the size of Z-projections to reduce load on the server.
The limit is defined as the number of bytes of raw pixel data in a Z-stack and
the OMERO.server default is equivalent to 1024 * 1024 * 256 bytes.
For example, a single-channel 8-bit image (1 byte per pixel) of XYZ size
1024 * 1024 * 256 is equal to the default threshold.

To double the limit, use::

    $ omero config set omero.pixeldata.max_projection_bytes 536870912

If you wish to set a threshold for iviewer that is *lower* than for the server:

    $ omero config set omero.web.iviewer.max_projection_bytes 268435456

NB: Z-projection is not supported for tiled images in OMERO
(Images larger than 2048 * 2048 pixels per plane are tiled in iviewer).

OMERO uses Spectrum Color Picker for selecting ROI colors. 
The roi_color_palette option allows you to specify a grid of colors for users to choose for ROIs.
Define rows with brackets, and use commas to separate values. By default, only the first color of each row is shown. 
A full grid is shown when the default color picker is hidden (see below)
To define a color palette use::
    
    $ omero config set omero.web.iviewer.roi_color_palette "[rgb(0,255,0)],[darkred,red,pink],[#0000FF]"
  
To hide the default color picker (and show a grid for the color palette), set show_palette_only to true
You must define a palette and each row can display 4 colors::
    
    $ omero config set omero.web.iviewer.show_palette_only true

When working with other images (coregistering MRIs for example), it is necessary to be able to mirror an image.
There is now experimental support for runtime image mirroring. To enable mirroring set enable_mirror to true.

    $ omero config set omero.web.iviewer.enable_mirror true

Known issues
============

For images with many channels (greater than approximately 30 channels), saving
of rendering settings fails due to the length of the request string. See
`#321 <https://github.com/ome/omero-iviewer/issues/321>`_. A work-around is to
configure gunicorn to allow longer request strings. For example, to double the
allowed limit::

    omero config set omero.web.wsgi_args ' --limit-request-line 8192'

When a palette is defined it will try to use the first value as the default ROI color.
Currently only rgb() vals are correctly parsed. If you try to use hex or a css name it will default to black
You can look up a conversion to rgb and set that as your first value for a workaround

Supported URLs
==============

If you have configured OMERO.iviewer as your default viewer (see install) then
double-clicking an Image in OMERO.web will open OMERO.iviewer as the OMERO.web viewer, passing the current Dataset if the Image is in a Dataset::

    /webclient/img_detail/1/?dataset=2

You use the OMERO.webclient's 'Open with...' menu to open multiple selected Images
or a Dataset or a Well in OMERO.iviewer directly::

    /iviewer/?images=1,2,3
    /iviewer/?dataset=4
    /iviewer/?well=5

Other query parameters can be used to set the rendering settings for the
first image, including channels in the form of ``index|start:end$color``::

    ?c=1|100:600$00FF00,-2|0:1500$FF0000      # Channel -2 is off

You can also specify the rendering Model (greyscale or color) and
Z-Projection (maximum intensity or normal)::

    ?m=g            # g for greyscale, c for color
    ?p=intmax       # intmax for Maximum intensity projection, normal for no projection

The Z and/or T plane, X/Y center position and zoom can be defined by::

    ?z=10&t=20          # can use z or t on their own
    ?x=500&y=400        # need to specify center with x AND y
    ?zm=100             # percent


Development
===========

In order to run and build you need:

* ``nodejs`` version at least 10.13.0 - https://nodejs.org/en/download
* ``apache ant`` for css compiling and tests

To install node dependencies and build the JavaScript bundle:

::

    $ cd omero-iviewer
    $ npm install

    # uncompressed build
    $ npm run debug

    # OR compressed for production
    $ npm run prod


You will usually want to have OMERO.iviewer installed on a local omero-web server,
to test the JavaScript built above. NB: first uninstall OMERO.iviewer if already installed,
then:

::

    $ cd plugin
    $ pip install -e .

    # config
    $ omero config append omero.web.apps '"omero_iviewer"'
    $ omero config set omero.web.viewer.view omero_iviewer.views.index

Now you can open Images from the webclient as normal.


For iterative development, it is recommended to use the webpack dev-server to build and serve OMERO.iviewer
as this will re-compile automatically when files are saved.

The dev build of OMERO.iviewer will attempt to connect to a local OMERO server at http://127.0.0.1:4080.
The web server at this location will need to have CORS enabled and you should
login to the webclient there.

The OMERO.iviewer will try to open an Image or other data from your local server, using IDs specified
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
                        'IMAGES': "12345",
                        // 'DATASET': "1",
                        //'WELL': "1"
                };
            </script>
    ...

Edit the `IMAGES` ID in that file and save, then start the dev server:

::

    $ npm run dev


To connect to an omero-web server at a different URL or port, you will need to modify all
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

Testing
=======

To run all tests, run:

::

    $ ant unit-tests

For more details on testing, see https://github.com/ome/omero-iviewer/tree/master/tests

Documentation
=============

A high-level description of the OMERO.iviewer application can be found at
https://github.com/ome/omero-iviewer/tree/master/docs.

To build the JavaScript code documentation in build/docs, run:

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
