# ol3-viewer plugin
In order to replace the default omero.web viewer follow the instructions below.

Prerequisite is, of course, an installed and working instance of omero.web.

Don't forget to add this folder to the PYTHONPATH, then register the plugin
as a web.app, and last but not least set it to be used as the default viewer:

* $OMERO_SERVER/bin/omero config append omero.web.apps '"ol3-viewer"'
* $OMERO_SERVER/bin/omero config set omero.web.viewer.view ol3-viewer.views.plugin


Depending on your setup you might also have to add this directory to your web server configuration, e.g. apache

More detailed resources on how to create a web app and development setup can be found here:

1. https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/CreateApp.html
2. https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/Deployment.html


IMPORTANT: In order to have the javascript files built and deployed you can choose to run either:

* ant build-plugin

This will build compressed/debug versions of the viewer, then copy them over to the static
django directories so that only a web

or (depending on whether you want the compressed/debug version):
* ant compile/compile-debug plugin

Choose one out of the two as a first parameter. This way of compiling is shorter and easier for development


Don't forget to call '$OMERO_SERVER/bin/omero websync' to keep the files up-to-date during development
