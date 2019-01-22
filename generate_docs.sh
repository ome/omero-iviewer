#!/bin/bash

# fetch dependencies
echo ""
echo "-----------------------------------"
echo "Fetching Documentation Libraries..."
echo "-----------------------------------"
echo ""
npm install esdoc@0.4.8 esdoc-es7-plugin

# clean any docs that might have existed before and recreate the dir
rm -rf ./build/docs
mkdir ./build/docs

# generate docs...
echo ""
echo "----------------------------"
echo "Running esdoc for iviewer..."
echo "----------------------------"
echo ""
./node_modules/.bin/esdoc -c esdoc.json
