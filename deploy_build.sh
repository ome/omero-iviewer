#!/bin/bash

#copy over html,css,js and templates
echo "Deploying built resources to plugin directory..."
cp src/index.html plugin/omero_iviewer/templates/omero_iviewer
cp build/css/all.min.css plugin/omero_iviewer/static/omero_iviewer/css
cp -r build/css/images plugin/omero_iviewer/static/omero_iviewer/css
cp -r build/css/fonts plugin/omero_iviewer/static/omero_iviewer/css
cp build/*.js* plugin/omero_iviewer/static/omero_iviewer/
cp src/openwith.js plugin/omero_iviewer/static/omero_iviewer/
