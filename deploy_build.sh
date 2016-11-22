#!/bin/sh

#copy over html,css,js and templates
echo "Deploying built resources to plugin directory..."
cp src/index.html plugin/omero_viewerng/templates/omero_viewerng
cp -r build/css/* plugin/omero_viewerng/static/omero_viewerng/css
cp build/*.js* plugin/omero_viewerng/static/omero_viewerng/
cp src/openwith.js plugin/omero_viewerng/static/omero_viewerng/
