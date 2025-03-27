#
# Copyright (c) 2017 University of Dundee.
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

from django.shortcuts import render
from django.urls import reverse
from django.http import HttpResponse
from omeroweb.decorators import login_required

from omero_version import omero_version

WEB_API_VERSION = 0


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    return plugin_debug(request, iid=iid, conn=conn)


@login_required()
def plugin(request, iid=None, conn=None, debug=False, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")
    params = {'OMERO_VERSION': omero_version}
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key])
    params['WEB_API_BASE'] = reverse(
        'api_base', kwargs={'api_version': WEB_API_VERSION})

    return render(request, 'ol3-viewer/plugin.html',
                  {'image_id': iid, 'debug': debug, 'params': params})


@login_required()
def plugin_debug(request, iid=None, conn=None, **kwargs):
    return plugin(request, iid=iid, conn=conn, debug=True)
