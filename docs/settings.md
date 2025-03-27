
OMERO.iviewer settings
======================

Max projection bytes
--------------------

OMERO limits the size of Z-projections to reduce load on the server.
The limit is defined as the number of bytes of raw pixel data in a Z-stack and
the OMERO.server default is equivalent to 1024 * 1024 * 256 bytes.
For example, a single-channel 8-bit image (1 byte per pixel) of XYZ size
1024 * 1024 * 256 is equal to the default threshold.

To double the limit, use::

    $ omero config set omero.pixeldata.max_projection_bytes 536870912

If you wish to set a threshold for iviewer that is *lower* than for the server:

    $ omero config set omero.web.iviewer.max_projection_bytes 268435456

NB: Z-projection is not supported for tiled images in OMERO
(Images larger than 2048 * 2048 pixels per plane are tiled in iviewer).


ROI color palette
-----------------

OMERO uses Spectrum Color Picker for selecting ROI colors. 
The `roi_color_palette` option allows you to specify a grid of colors for users to choose for ROIs.
Define rows with brackets, and use commas to separate values. By default, only the first color of each row is shown. 
A full grid is shown when the default color picker is hidden (see below).
To define a color palette use::
    
    $ omero config set omero.web.iviewer.roi_color_palette "[rgb(0,255,0)],[darkred,red,pink],[#0000FF]"
  
To hide the default color picker (and show a grid for the color palette), set `show_palette_only` to true
You must define a palette and each row can display 4 colors::
    
    $ omero config set omero.web.iviewer.show_palette_only true


Enable mirror
-------------

When working with other images (coregistering MRIs for example), it is necessary to be able to mirror an image.
There is now experimental support for runtime image mirroring. To enable mirroring set `enable_mirror` to true.

    $ omero config set omero.web.iviewer.enable_mirror true


Max active channels
-------------------

By default, iviewer limits the maximum number of active channels to 10. Rendering high numbers of channels
at once puts increased load on the server and it is rarely necessary to visualise more channels at once.

    $ omero config set omero.web.iviewer.max_active_channels 20

NB: If the iviewer is using the [image region microservice](https://github.com/glencoesoftware/omero-ms-image-region)
then it will query the `max-active-channels` supported by the microservice, which is also set to 10 by default. This will override any value in the iviewer settings.


ROI page size
-------------

The pagination page size for the ROIs list is 500 by default. Loading larger numbers will take longer.
The pagination is also constrained by the underlying `omero-web` JSON API, so you need to set both these
settings if you want to increase the limit.

    $ omero config set omero.web.iviewer.roi_page_size 1000

    $ omero config set omero.web.api.max_limit 1000
