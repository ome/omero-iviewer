# viewer-ng plugin

In order to replace the default omero.web viewer follow the instructions below.

Prerequisite is a working installation of omero.web!

Don't forget to add this folder to the PYTHONPATH, then register the plugin
as a web.app, and last but not least set it to be used as the default viewer:

* $OMERO_SERVER/bin/omero config append omero.web.apps '"viewer-ng"'
* $OMERO_SERVER/bin/omero config set omero.web.viewer.view viewer-ng.views.index


Depending on your setup you might also have to make adjustments to your web server configuration

More detailed resources on how to create a web app and development setup can be found here:

1. [CreateApp](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/CreateApp.html)
2. [Deployment](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/Deployment.html)


##IMPORTANT

You need to build the viewer beforehand and deploy to the plugin directory.
Please consult the respective [README](../../README.md).


Also, make sure you keep the omero.web plugin in sync with the build:

```$OMERO_SERVER/bin/omero websync```
