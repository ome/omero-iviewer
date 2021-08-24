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

from django.core.urlresolvers import reverse

from omeroweb.testlib import IWebTest, get_json, post_json

from omero.model import ImageI, RoiI, PointI
from omero.rtypes import rdouble, rstring
from omero.gateway import BlitzGateway, TagAnnotationWrapper
from omero_marshal import get_encoder

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

        encoder = get_encoder(point.__class__)
        point_json = encoder.encode(point)
        unsaved_id = "-1:-1"
        point_json['oldId'] = unsaved_id
        persist_url = reverse('omero_iviewer_persist_rois')
        data = {
            'imageId': image.id.val,
            'rois': {
                'count': 1,
                'new': [point_json]
            }
        }
        rsp = post_json(django_client, persist_url, data)
        print('rsp', rsp)
        # {"ids": {"-1:-1": "225504:416603"}}
        assert "ids" in rsp
        new_ids = rsp["ids"].values()
        assert len(new_ids) == 1
        new_id = rsp["ids"][unsaved_id]
        roi_id = int(new_id.split(':')[0])
        shape_id = int(new_id.split(':')[1])

        # Add Tag to ROI and Shape
        tag = TagAnnotationWrapper(conn)
        tag.setValue("ROI/Shape Tag")
        tag.save()
        roi = conn.getObject("Roi", roi_id)
        roi.linkAnnotation(tag)
        shape = conn.getObject("Shape", shape_id)
        shape.linkAnnotation(tag)
        # check...
        assert len(list(conn.getAnnotationLinks(
            "Shape", parent_ids=[shape_id]))) == 1

        # Load Shape
        rois_url = reverse('api_rois', kwargs={'api_version': 0})
        rois_url += '?image=%s' % image.id.val
        rsp = get_json(django_client, rois_url)
        assert len(rsp['data']) == 1

        # Edit Shape
        point_json = rsp['data'][0]['shapes'][0]
        point_json["X"] = 100
        point_json["Y"] = 200
        # iviewer wants to know ROI:Shape ID
        point_json["oldId"] = new_id
        # Unload details
        del point_json["omero:details"]
        data = {
            'imageId': image.id.val,
            'rois': {
                'count': 1,
                'modified': [point_json]
            }
        }
        rsp = post_json(django_client, persist_url, data)
        # IDs shouldn't have changed, e.g.
        # {"ids": {"225504:416603": "225504:416603"}}
        print('post rsp', rsp)
        assert rsp["ids"][new_id] == new_id

        # Check annotations not lost
        roi = conn.getObject("Roi", roi_id)
        assert len(list(roi.listAnnotations())) == 1
        assert len(list(conn.getAnnotationLinks(
            "Shape", parent_ids=[shape_id]))) == 1
