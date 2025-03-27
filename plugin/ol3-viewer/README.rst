ol3-viewer plugin
=================

This plugin allows the running of the OpenLayers-based viewer as a
stand-alone image viewer, without any Aurelia model / UI components.
This is primarily for testing purposes (see below).

Prerequisite is, of course, an installed and working instance of OMERO.web.

Add the plugin folder to the ``PYTHONPATH`` if not already set (this is
the same path as for development of omero_iviewer itself).
Then register the plugin as a web.app:

::

    $ export PYTHONPATH=$PYTHONPATH:/path/to/omero_iviewer/plugin/
    $ omero config append omero.web.apps '"ol3-viewer"'

You need to build the OpenLayers Viewer JavaScript files:

::

    $ npm run plugin

To keep the files up-to-date during development, don't forget to call:

::

    $ omero websync

After restarting your web server, you should be able to open images with a
URL like:

::

    /ol3-viewer/[IMAGE_ID]

You can use the browser console to interact with the viewer, for example:

::

    // Load and display any ROIs from OMERO, allow shape selection etc.
    viewer.addRegions()
    // Allow user to draw a new Rectangle on the image
    viewer.drawShape({type: 'rectangle'})

If you wish to set this viewer as your default image viewer:

::

    $ omero config set omero.web.viewer.view ol3-viewer.views.plugin
