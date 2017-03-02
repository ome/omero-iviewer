#!/bin/bash
for p in *.patch
do
    patch -p0 -N < "$p"
done
