0.13.0 (June 2022)
------------------

- Add support for "mirroring" (flipping of image in X and Y axes - Thanks to [Michael Barrett](https://github.com/barrettMCW)) ([#439](https://github.com/ome/omero-iviewer/pull/439))
- Make app compatible with Django 4.0.x ([#451](https://github.com/ome/omero-iviewer/pull/451))
- Upgrade Aurelia framework ([#422](https://github.com/ome/omero-iviewer/pull/422))
- Upgrade many dependencies, including webpack 5 ([#450](https://github.com/ome/omero-iviewer/pull/450))

0.12.0 (August 2022)
--------------------

- Add support for ROI color-picker palette (Thanks to [Michael Barrett](https://github.com/barrettMCW)) ([#415](https://github.com/ome/omero-iviewer/pull/415))
- Rename ?server query parameter to ?host ([#414](https://github.com/ome/omero-iviewer/pull/414))

0.11.3 (March 2022)
------------------

- Make app compatible with Django 1.11.x and 3.2.x ([#399](https://github.com/ome/omero-iviewer/pull/399))

0.11.2 (March 2022)
-------------------

- Pin omero-web version to 5.14.0 [#403](https://github.com/ome/omero-iviewer/pull/403)

0.11.1 (July 2021)
------------------

- Improve support for units [#386](https://github.com/ome/omero-iviewer/pull/386)

0.11.0 (June 2021)
------------------

- Delay the loading of the timestamp metadata [#373](https://github.com/ome/omero-iviewer/pull/373)
- Restore app compatibility with OMERO.server 5.6.0 [#377](https://github.com/ome/omero-iviewer/pull/377)
- Bug fix: preserve Shape popup state when reloading regions of interest [#374](https://github.com/ome/omero-iviewer/pull/374)
- Symlink AGPL license to the root of the source code repository [#363](https://github.com/ome/omero-iviewer/pull/363)
- Update dependencies (lodash, elliptic) [#370](https://github.com/ome/omero-iviewer/pull/370) [#382](https://github.com/ome/omero-iviewer/pull/382)

0.10.2 (February 2021)
----------------------

- Resize viewer when thumbnail panel hidden [#368](https://github.com/ome/omero-iviewer/pull/368)
- Validate zoomLevelScaling [#359](https://github.com/ome/omero-iviewer/pull/359)
- Add request limit as a known issue with nginx config [#361](https://github.com/ome/omero-iviewer/pull/361)
- Make projection slider range clearer [#348](https://github.com/ome/omero-iviewer/pull/348)
- Tiling threshold max projection bytes [#349](https://github.com/ome/omero-iviewer/pull/349)

0.10.1 (August 2020)
--------------------

- Bug fix: handle of non-default units for image timestamps [#343](https://github.com/ome/omero-iviewer/pull/343)
- Add link to the how-to guide in Help menu [#336](https://github.com/ome/omero-iviewer/pull/336) [#344](https://github.com/ome/omero-iviewer/pull/344)
- Fix copyright range in Help menu [#339](https://github.com/ome/omero-iviewer/pull/339)
- Improve console debugging for karma test server [#334](https://github.com/ome/omero-iviewer/pull/334)

0.10.0 (July 2020)
------------------

- support linking to ROI or Shape [#311](https://github.com/ome/omero-iviewer/pull/311)
- allow higher zoom levels for big Images [#325](https://github.com/ome/omero-iviewer/pull/325)
- link to Image in webclient [#328](https://github.com/ome/omero-iviewer/pull/328)
- this release requires an update to omero-web 5.7.0

0.9.1 (February 2020)
---------------------

- fix cross origin login fix [#302](https://github.com/ome/omero-iviewer/pull/302)
- play movie from end [#303](https://github.com/ome/omero-iviewer/pull/303)
- confine projection [#305](https://github.com/ome/omero-iviewer/pull/305)

0.9.0 (January 2020)
--------------------

This version drops support for Python 2.

0.8.1 (September 2019)
----------------------

This version includes:

- fix multi-viewer sync buttons [#275](https://github.com/ome/omero-iviewer/pull/275)
- disable panning of viewer when popup is shown on a Shape [#276](https://github.com/ome/omero-iviewer/pull/276)
- fix formatting of CSV when exporting Shapes outside the image [#277](https://github.com/ome/omero-iviewer/pull/277)
- show or hide all Shapes within an ROI [#278](https://github.com/ome/omero-iviewer/pull/278)
- fix UI update when saving ROIs in multi-viewer mode [#279](https://github.com/ome/omero-iviewer/pull/279)

0.8.0 (August 2019)
-------------------

This version includes:

- show a grid indicating the number of ROIs on each Z/T plane [#245](https://github.com/ome/omero-iviewer/pull/245)
- show Shape info in a popup on the image [#248](https://github.com/ome/omero-iviewer/pull/248)
- improve accuracy of Ellipse area calculation [#263](https://github.com/ome/omero-iviewer/pull/263)
- support sorting of ROIs in the table [#264](https://github.com/ome/omero-iviewer/pull/264)
- fix opening of Images in a Well when not in your default group [#271](https://github.com/ome/omero-iviewer/pull/271)

0.7.1 (June 2019)
-----------------

This version includes:

- removal of rounded corners from the scalebar [#261](https://github.com/ome/omero-iviewer/pull/261)
- display of ROI names in the Comment column when applicable [#268](https://github.com/ome/omero-iviewer/pull/268)

0.7.0 (April 2019)
------------------

This version includes:

- export of ROI coordinates along with pixel intensities [#257](https://github.com/ome/omero-iviewer/pull/257)
- modify scalebar to display user-friendly lengths [#253](https://github.com/ome/omero-iviewer/pull/253)
- link to current viewport available via context menu [#240](https://github.com/ome/omero-iviewer/pull/240)
- fix caching of image settings on Save to All [#255](https://github.com/ome/omero-iviewer/pull/255)
- fix thumbnails loading [#246](https://github.com/ome/omero-iviewer/pull/246)
- do not change the centre of the viewport when using 1:1 [#247](https://github.com/ome/omero-iviewer/pull/247)
- fix loading of ROIs when playing movie [#249](https://github.com/ome/omero-iviewer/pull/249)
- fix permissions issue when loading pixels intensity [#250](https://github.com/ome/omero-iviewer/pull/250)
- handle large numbers of ROIs on image [#231](https://github.com/ome/omero-iviewer/pull/231)
- drag and drop thumbnails to open image viewers (not supported on Internet Explorer) [#233](https://github.com/ome/omero-iviewer/pull/233)
- support URL query parameters for x, y and zoom [#236](https://github.com/ome/omero-iviewer/pull/236)
- fix scrolling of thumbnail panel to selected image [#234](https://github.com/ome/omero-iviewer/pull/234)
- fix resizing of rectangles after dragging [#229](https://github.com/ome/omero-iviewer/pull/229)
- fix double-click zooming when in drawing mode [#228](https://github.com/ome/omero-iviewer/pull/228)
- update to use version 5.3.0 of OpenLayers [#218](https://github.com/ome/omero-iviewer/pull/218)
    - this removes the need for closure compiler in the build

0.6.0 (November 2018)
---------------------

This version includes:

- cached image settings to allow navigation between images without losing unsaved settings
- improved thumbnail loading
- enabled double-click to zoom on image viewing
- improved tooltips on ROIs
- added documentation for the architecture of the application

0.5.0 (May 2018)
----------------

This version includes:

- disabled projection for image where sizeX * sizeY > 4000000
- added option to map pixels values using map other than linear
- added option to display pixels intensity when mousing over image
- enabled viewing of multiple images in the same browser window by double-clicking
- added support for opening the image in other installed applications e.g. OMERO.figure
- added option to export ROIs statistics in CSV file or Excel file
- improved ROIs creation, manipulation and persistence
- improved copy/paste of ROIs across images
- added new icon for polyline
- improved handling of statistical values
- handled images with large number of channels
- added menus in header
- improved loading and display of bird's eye view
- improved loading of tiles
- correctly handled data access depending on permissions level
- improved UI
- added minimal support for masks
- updated documentation
- reviewed build system to reduce the bundled size
- improved build system for development
- improved testing infrastructure
- upgraded Webpack to 3.6.0
- upgraded Openlayers to version 4.6.5
- upgraded JQuery to version 3.3.1


0.4.1 (November 2017)
---------------------

This version includes:

- displayed both import date and acquisition date when available
- fixed configuration issue when used as the default viewer in OMERO.web
- reduced the size of the bundled javascript
- renamed the control inverting the color to "invert" instead of "reverse"
- added option to export basic ROIs statistics in a CSV file
- added option to query pixels intensity
- upgraded Openlayers to version 4.3.2


0.3.0 (September 2017)
----------------------

This version includes:

- added option to save the image in the viewport as png
- added option to export basic ROIs measurement (area and length) in a CSV file
- handled opening of datasets and wells
- saved the projected image as a new image in OMERO
- improved support for ROIs transformations
- upgraded Openlayers and Aurelia
- added rois count


0.2.0 (June 2017)
----------------

This version includes:

- support for omero prefix
- improved manipulation of rendering setting for floating images with very small pixels range
- support for maximum intensity projection along Z
- loading ROIs using the web api
- added ability to draw lines
- improved copy and paste of ROIs and added a new context menu for these actions
- added ability to open multiple selected images
- improved layout of ROIs table
- added support for two new Lookup tables from `Janelia <https://www.janelia.org/>`_
- added option to turn on or off the interpolation


0.1.0 (May 2017)
----------------

Initial Release

This version includes:

- availability from PyPI
- support for 'Open With' functionality
- support for non-tiled and tiled images
- ability to adjust rendering settings
- support for lookup tables and reverse intensity rendering
- support for histograms
- saved rendering settings
- displayed images in the same dataset as the selected image on left-hand panel
- displayed time information
- draggable scalebar
- support for panning
- smooth zooming
- support for rotation
- ability to draw regions of interest
- shapes can be attached to a given plane, a given z or t or none
- ability to copy/paste rois between images
- saved regions of interests
