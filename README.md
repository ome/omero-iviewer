# omero_iviewer

##Requirements:

In order to build you need npm version equal or greater to 3.0!

##Build:

Run ```npm run debug``` to build an uncompressed version.

Run ```npm run prod``` to build an uglified version.

All builds will build into the build directory AND deploy to the plugin directory
which can then be used like any django plugin.
For further installation help have a look at the respective [README](plugin/omero_iviewer/README.rst).

Should you want to enable the "open with" feature execute this one-liner:
``` $OMERO_SERVER/bin/omero config append omero.web.open_with '["omero_iviewer", "iviewer_index", {"supported_objects":["images"], "script_url": "omero_iviewer/openwith.js"}]'```

Note: Should you like or need to rebuild OMERO.iviewer's internal ol3 viewer,
      please have a look at the section *ol3-viewer* below!

##Development:

Run ```npm run dev``` to be able to run the webpack-dev server locally at:
localhost:3000

##Documentation:

Run ```npm run docs``` to build the html in build/docs



# ol3-viewer
OMERO.iviewer's internal image viewer (based on open layers 3)

The following software has to be installed in order to compile the java script code:

1. npm (node package manager)
2. apache ant (and therefore a java runtime)
3. python (for closure's calcdeps.py)

To build the open layers viewer for OMERO.iviewer (deploys into libs directory),
simply run ```ant``` (default target).

For further options type ```ant -p```.

More detailed resources on how to create a web app and development setup can be found here:

1. [CreateApp](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/CreateApp.html)
2. [Deployment](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/Deployment.html)


Important
=========

You need to build the viewer beforehand and deploy to the plugin directory.
Please consult the respective [README](../../README.md).


Also, make sure you keep the omero.web plugin in sync with the build:

```$OMERO_SERVER/bin/omero websync```
