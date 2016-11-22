#!/bin/sh

echo "Preparing build. You are going to need npm at a minimum"

#fetch dependencies via npm
echo "Fetching dependencies needed for build..."
npm install


#wipe build directory
echo "Erasing build/deploy directories..."
rm -rf build

#delete plugin directories
rm -rf plugin/omero_viewerng/static plugin/omero_viewerng/templates

#recreate static and templates directories
echo "Recreating build/deploy directories..."
mkdir -p plugin/omero_viewerng/static/omero_viewerng/css/images
mkdir -p plugin/omero_viewerng/templates/omero_viewerng
