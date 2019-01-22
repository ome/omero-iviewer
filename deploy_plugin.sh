#!/bin/bash

#copy over css and js
echo "Deploying built resources to plugin directory..."
rm -rf plugin/ol3-viewer/static
mkdir -p plugin/ol3-viewer/static/ol3-viewer/js
mkdir -p plugin/ol3-viewer/static/ol3-viewer/css
cp -r css/* plugin/ol3-viewer/static/ol3-viewer/css
cp build/ol-viewer.js plugin/ol3-viewer/static/ol3-viewer/js
