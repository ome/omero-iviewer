#!/bin/sh

#copy over html,css,js and templates
echo "Deploying built resources to plugin directory..."
cp src/index.html plugin/viewer-ng/templates/viewer-ng
cp build/css/*.css plugin/viewer-ng/static/viewer-ng/css
cp build/*.js* plugin/viewer-ng/static/viewer-ng/js
