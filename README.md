# viewer_ng

##Requirements:

In order to build you need npm version equal or greater to 3.0!

##Build:

Run ```npm run debug``` to build an uncompressed version.

Run ```npm run prod``` to build an uglified version.

All builds will build into the build directory AND deploy to the plugin directory
which can then be used like any django plugin.
For further installation help have a look at the respective [README](plugin/viewer-ng/README.md).

Note: Should you like or need to rebuild viewer-ng's internal ol3 viewer,
      please have a look at the section *ol3-viewer* below!

##Development:

Run ```npm run dev``` to be able to run the webpack-dev server locally at:
localhost:3000

##Documentation:

Run ```npm run docs``` to build the html in build/docs



# ol3-viewer
Viewer NG's internal image viewer (based on open layers 3)

The following software has to be installed in order to compile the java script code:

1. npm (node package manager)
2. apache ant (and therefore a java runtime)
3. python (for closure's calcdeps.py)

To build the open layers viewer for viewer-ng (deploys into libs directory),
simply run ```ant``` (default target).

For further options type ```ant -p```.
