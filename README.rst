OMERO.iviewer
=============

An OMERO.web app for visualizing images in OMERO.

Requirements
============

* OMERO 5.3.0 or newer.

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

Run:

::
 
    $ npm run dev

To be able to run the ``webpack-dev`` server locally at: ``localhost:3000``

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

