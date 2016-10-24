#!/bin/sh

#copy over html,css,js and templates
echo "Deploying built resources to plugin directory..."
cp src/index.html plugin/viewer-ng/templates/viewer-ng
cp -r build/css/* plugin/viewer-ng/static/viewer-ng/css
cp build/*.js* plugin/viewer-ng/static/viewer-ng/
cp src/openwith.js plugin/viewer-ng/static/viewer-ng/
