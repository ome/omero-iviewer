#!/bin/bash

#copy over css and js
echo "Deploying built resources to plugin directory..."
rm -rf plugin/ol3-viewer/static
mkdir -p plugin/ol3-viewer/static/ol3-viewer/js
mkdir -p plugin/ol3-viewer/static/ol3-viewer/css
mkdir -p plugin/ol3-viewer/static/ol3-viewer/fonts

# Generated from webpack.plugin.config.js
cp build/ol-viewer.js plugin/ol3-viewer/static/ol3-viewer/js

# Copy from source (not minified css)
cp -r css/* plugin/ol3-viewer/static/ol3-viewer/css

# Copy bootstrap css and fonts (for button glyphicons etc)
cp ./node_modules/bootstrap/dist/css/bootstrap.min.css plugin/ol3-viewer/static/ol3-viewer/css
cp -r ./node_modules/bootstrap/dist/fonts/* plugin/ol3-viewer/static/ol3-viewer/fonts
