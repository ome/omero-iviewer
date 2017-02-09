#!/bin/bash

COMPILE_VIEWER=0
if [ "$#" -gt 0 ] && [ "$1" = "DEV" ] && [ -f "libs/ol3-viewer.js" ]; then
   COMPILE_VIEWER=1
fi

if [ $COMPILE_VIEWER -eq 0 ]; then
    echo "preparing ol3-viewer"
    rm  -rf libs
    mkdir -p libs
    ant
    ant prepare-unit-tests
else
    echo "omitting ol3-viewer build"
fi
