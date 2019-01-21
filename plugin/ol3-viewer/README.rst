ol3-viewer plugin
=================

This plugin allows the running of the OpenLayers-based viewer as a
stand-alone image viewer, without any Aurelia model / UI components.
This is primarily for testing purporses (see below).

Prerequisite is, of course, an installed and working instance of OMERO.web.

Add this folder to the PYTHONPATH, then register the plugin as a web.app:

::

    $ bin/omero config append omero.web.apps '"ol3-viewer"'

You need to build the OpenLayers Viewer JavaScript files:

::

    $ npm run viewer

To keep the files up-to-date during development, don't forget to call:

::

    $ bin/omero websync

After restarting your web server, you should be able to open images with a
URL like:

    /ol3-viewer/[IMAGE_ID]

You can use the browse console to interact with the viewer, for example:

::
    // Load and display any ROIs from OMERO, allow shape selection etc.
    viewer.addRegions()
    // Allow user to draw a new Rectangle on the image
    viewer.drawShape({type: 'rectangle'})

If you wish to set this viewer as your default image viewer:
    
    $ bin/omero config set omero.web.viewer.view ol3-viewer.views.plugin


More detailed resources on how to create a web app and development setup can be found here:

1. `CreateApp <https://docs.openmicroscopy.org/latest/omero/developers/Web/CreateApp.html>`_
2. `Deployment <https://docs.openmicroscopy.org/latest/omero/developers/Web/Deployment.html>`_
