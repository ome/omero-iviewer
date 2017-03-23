#!/bin/bash
for p in *.patch
do
    [ -f "$p" ] || continue
    patch -p0 -N < "$p"
done
