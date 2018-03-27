.. image:: https://travis-ci.org/ome/omero-iviewer.svg?branch=master
    :target: https://travis-ci.org/ome/omero-iviewer

.. image:: https://badge.fury.io/py/omero-iviewer.svg
    :target: https://badge.fury.io/py/omero-iviewer

OMERO.iviewer
=============

An OMERO.web app for visualizing images in OMERO.


Requirements
============

* OMERO 5.4.0 or newer.


Installing from PyPI
====================

This section assumes that an OMERO.web is already installed.

Install the app using `pip <https://pip.pypa.io/en/stable/>`_:

::

    $ pip install -U omero-iviewer

Add iviewer custom app to your installed web apps:

::

    $ bin/omero config append omero.web.apps '"omero_iviewer"'

To replace the default omero.web viewer:

::

    $ bin/omero config set omero.web.viewer.view omero_iviewer.views.index

To enable the "open with" feature:

::

    $ bin/omero config append omero.web.open_with '["omero_iviewer", "omero_iviewer_index",
      {"supported_objects":["images", "dataset", "well"],
       "script_url": "omero_iviewer/openwith.js", "label": "OMERO.iviewer"}]'

Now restart OMERO.web as normal.


License
-------

OMERO.iviewer is released under the AGPL.

Copyright
---------

2017-2018, The Open Microscopy Environment
