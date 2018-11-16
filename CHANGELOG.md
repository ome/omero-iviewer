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
