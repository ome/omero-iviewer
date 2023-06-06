#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
# All rights reserved.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

"""Settings for the OMERO.iviewer app."""

import sys
from omeroweb.settings import process_custom_settings, report_settings

# load settings
IVIEWER_SETTINGS_MAPPING = {

    "omero.web.iviewer.max_projection_bytes":
        ["MAX_PROJECTION_BYTES",
         -1,
         int,
         ("Maximum bytes of raw pixel data allowed for Z-projection. "
          "Above this threshold, Z-projection is disabled. "
          "If unset, the server setting of "
          "omero.pixeldata.max_projection_bytes will be used or "
          "the lower value if both are set.")],

    "omero.web.iviewer.roi_page_size":
        ["ROI_PAGE_SIZE",
         500,
         int,
         "Page size for ROI pagination."],

    "omero.web.iviewer.roi_color_palette":
        ["ROI_COLOR_PALETTE",
         '',
         str,
         ("Set of predefined color options for drawing rois"
          "Define rows with brackets, and seperate values with commas"
          "ex: [rgb(0,0,0),rgba(0,0,0,0)],[#000000]...")],

    "omero.web.iviewer.show_palette_only":
        ["SHOW_PALETTE_ONLY",
         False,
         bool,
         ("Disables spectrum color picker. Forces users to use preset options."
          "Must define a color palette for this setting to work.")],

    "omero.web.iviewer.enable_mirror":
        ["ENABLE_MIRROR",
         False,
         bool,
         ("Enables buttons to mirror X or Y axis.")]
}

process_custom_settings(sys.modules[__name__], 'IVIEWER_SETTINGS_MAPPING')
report_settings(sys.modules[__name__])
