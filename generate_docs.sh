#!/bin/bash

# fetch dependencies
echo ""
echo "-----------------------------------"
echo "Fetching Documentation Libraries..."
echo "-----------------------------------"
echo ""
npm install jsdoc esdoc@0.4.8 esdoc-es7-plugin

# clean any docs that might have existed before and recreate the dir
rm -rf ./build/docs
mkdir ./build/docs

# generate docs from source for both ol3viewer and iviewer
echo ""
echo "--------------------------------"
echo "Running jsdocs for ol3-viewer..."
echo "--------------------------------"
echo ""
./node_modules/.bin/jsdoc -r ./ol3-viewer -d ./build/docs/ol3-viewer -p --verbose
echo ""
echo "----------------------------"
echo "Running esdoc for iviewer..."
echo "----------------------------"
echo ""
./node_modules/.bin/esdoc -c esdoc.json
