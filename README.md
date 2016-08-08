# viewer_ng

##Requirements:

In order to build you need npm version equal or greater to 3.0!

##Build:

Run ```npm run debug``` to build an uncompressed version.

Run ```npm run prod``` to build an uglified version.

All builds will build into the build directory AND deploy to the plugin directory
which can then be used like any django plugin.
For further installation help have a look at the respective [README](plugin/viewer-ng/README.md).

##Development:

Run ```npm run dev``` to be able to run the webpack-dev server locally at:
localhost:3000

##Documentation:

Run ```npm run docs``` to build the html in build/docs
