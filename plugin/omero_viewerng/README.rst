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

* OMERO 5.2.6 or newer.


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


Now restart OMERO.web as normal.

More detailed resources on how to create a web app and development setup can be found here:

1. [CreateApp](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/CreateApp.html)
2. [Deployment](https://www.openmicroscopy.org/site/support/omero5.2/developers/Web/Deployment.html)


Important
=========

You need to build the viewer beforehand and deploy to the plugin directory.
Please consult the respective [README](../../README.md).


Also, make sure you keep the omero.web plugin in sync with the build:

```$OMERO_SERVER/bin/omero websync```


License
-------

OMERO.figure is released under the AGPL.

Copyright
---------

2016, The Open Microscopy Environment