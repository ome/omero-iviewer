#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
#
#
# Copyright (c) 2016 University of Dundee.
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
#
# Author: Jean-Marie Burel <j(dot)burel(at)dundee(dot)ac(dot)uk>, 2016.
#
# Version: 1.0
#


from django.apps import AppConfig


class IviewerAppConfig(AppConfig):
    name = "omero_iviewer"
    label = "iviewer"
