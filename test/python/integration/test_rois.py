#!/usr/bin/env python
# -*- coding: utf-8 -*-

#
# Copyright (C) 2021 University of Dundee. All Rights Reserved.
# Use is subject to license terms supplied in LICENSE.txt
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

"""
   Test saving ROIs
"""

# from omero.testlib import ITest
from django.core.urlresolvers import reverse

from omeroweb.testlib import IWebTest, get_json, \
    post_json, put_json, delete_json

from omero.model import ImageI, RoiI, PointI, ProjectI, ScreenI
from omero.rtypes import rdouble, rlist, rstring, unwrap
from omero.gateway import BlitzGateway

import pytest

class TestRois(IWebTest):
    """Tests querying & saving ROIs"""

    @pytest.fixture()
    def conn(self):
        """Return a new user in a read-annotate group."""
        group = self.new_group(perms='rwra--')
        user = self.new_client_and_user(group=group)
        gateway = BlitzGateway(client_obj=user[0])
        # Refresh the session context
        gateway.getEventContext()
        return gateway
    
    @pytest.fixture()
    def django_client(self, conn):
        user_name = conn.getUser().getName()
        return self.new_django_client(user_name, user_name)

    def test_save_rois(self, conn, django_client):
        """Save new ROIs to an Image"""
        image = self.make_image(client=conn.c)
        roi = RoiI()
        roi.name = rstring("roi_name")
        roi.setImage(ImageI(image.id.val, False))
        point = PointI()
        point.x = rdouble(1)
        point.y = rdouble(2)
        roi.addShape(point)
        roi = conn.getUpdateService().saveAndReturnObject(roi)

        rois_url = reverse('api_rois', kwargs={'api_version': 0})
        rois_url += '?image=%s' % image.id.val
        rsp = get_json(django_client, rois_url)
        print('rsp', rsp)
        assert len(rsp['data']) == 1
