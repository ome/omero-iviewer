ol3-viewer plugin
=================

In order to replace the default OMERO.web viewer follow the instructions below.

Prerequisite is, of course, an installed and working instance of OMERO.web.

Don't forget to add this folder to the PYTHONPATH, then register the plugin
as a web.app, and last but not least set it to be used as the default viewer:

::

    $ bin/omero config append omero.web.apps '"ol3-viewer"'
    $ bin/omero config set omero.web.viewer.view ol3-viewer.views.plugin


Depending on your setup you might also have to add this directory to your web server configuration, e.g. apache

More detailed resources on how to create a web app and development setup can be found here:

1. `CreateApp <https://docs.openmicroscopy.org/latest/omero/developers/Web/CreateApp.html>`_
2. `Deployment <https://docs.openmicroscopy.org/latest/omero/developers/Web/Deployment.html>`_

IMPORTANT: In order to have the javascript files built and deployed you can choose to run either:

::

    $ ant build-plugin

This will build compressed/debug versions of the viewer, then copy them over to the static
Django directories:

::

    $ compile plugin

This way of compiling is shorter and easier for development


To keep the files up-to-date during development, don't forget to call

::

    $ bin/omero websync
