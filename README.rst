OMERO.iviewer
=============

An OMERO.web app for visualizing images in OMERO.

Requirements
============

* OMERO 5.4.0 or newer.

Build
=====

In order to build you need:

* nodejs version 6.x
* npm version equal or greater to 3.0!

To build an uncompressed version, run:

::

    $ npm run debug


To build an uglified version, run:

::

    $ npm run prod

All builds will build into the build directory and deploy to the plugin directory
which can then be used like any Django plugin.

Intructions on how to add the OMERO.iviewer app to your installed OMERO.web apps
can be found in the `OMERO.iviewer README <plugin/omero_iviewer/README.rst>`_.

**Note**: 

Should you like or need to rebuild OMERO.iviewer's internal ol3 viewer,
please read the section *ol3-viewer* below!

Development
===========

Building the uncompressed version of iviewer as described above the application
can be deployed locally or to a test server, to then be debugged.
It is also possible to run/debug it with webpack dev-server:

::

    $ npm run dev

will build the bundle and start the webpack dev-server (localhost:8080)

Either development setup expects the following:
- an OMERO server installation
- an iviewer 'deploy' to that OMERO server:

::
    $ export PYTHONPATH=$PYTHONPATH:/path/to/iviewer-project-root/plugin
    $ bin/omero config append omero.web.apps '"omero_iviewer"'

**Note**:

The webpack dev-server config expects a local OMERO server (http://localhost)!

Documentation
=============

To build the html in build/docs, run:

::

    $ npm run docs


ol3-viewer
==========

The OMERO.iviewer's internal image viewer is based on `OpenLayers 3 <https://openlayers.org/>`_,

The following software has to be installed in order to compile the java script code:

1. ``npm`` (node package manager)
2. ``apache ant`` (and therefore a java runtime)
3. ``python`` (for closure's calcdeps.py)

To build the OpenLayers viewer for OMERO.iviewer (deploys into libs directory), run:

::

    $ ant

For further options type ``ant -p``.

More detailed resources on how to create a web app and development setup can be found at:

1. `CreateApp <https://www.openmicroscopy.org/site/support/omero5/developers/Web/CreateApp.html>`_
2. `Deployment <https://www.openmicroscopy.org/site/support/omero5/developers/Web/Deployment.html>`_
