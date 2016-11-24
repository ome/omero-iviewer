.. image:: https://travis-ci.org/ome/omero-viewerng.svg?branch=master
    :target: https://travis-ci.org/ome/omero-viewerng

.. image:: https://badge.fury.io/py/omero-viewerng.svg
    :target: https://badge.fury.io/py/omero-viewerng

OMERO.viewerng
==============

An OMERO.web app for visualizing images in OMERO.

For full details see URL_TO_ADD

Requirements
============

* OMERO 5.3.0 or newer.


Installing from PyPI
====================

This section assumes that an OMERO.web is already installed.

Install the app using `pip <https://pip.pypa.io/en/stable/>`_:

::

    $ pip install omero-viewerng

Add viewerng custom app to your installed web apps:

::

    $ bin/omero config append omero.web.apps '"omero_viewerng"'

To replace the default omero.web viewer:

::

    $ bin/omero config set omero.web.viewer.view omero_viewerng.views.index

To enable the "open with" feature:

::

	$ bin/omero config append omero.web.open_with '["omero_viewerng", "viewer_ng_index", {"supported_objects":["images"], "script_url": "omero_viewerng/openwith.js"}]'

Now restart OMERO.web as normal.


License
-------

OMERO.viewerng is released under the AGPL.

Copyright
---------

2016, The Open Microscopy Environment