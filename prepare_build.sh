#!/bin/sh

echo "Preparing build. You are going to need npm at a minimum"

#fetch dependencies via npm
echo "Fetching dependencies needed for build..."
npm install


#wipe build directory
echo "Erasing build/deploy directories..."
rm -rf build

#delete plugin directories
rm -rf plugin/viewer-ng/static plugin/viewer-ng/templates

#recreate static and templates directories
echo "Recreating build/deploy directories..."
mkdir -p plugin/viewer-ng/static/viewer-ng/css/images
mkdir -p plugin/viewer-ng/static/viewer-ng/js
mkdir -p plugin/viewer-ng/templates/viewer-ng
