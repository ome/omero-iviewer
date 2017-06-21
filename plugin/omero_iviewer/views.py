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
from django.http import JsonResponse
from django.http import HttpResponse
from django.conf import settings
from django.core.urlresolvers import reverse

from omeroweb.decorators import login_required
from omeroweb.webgateway.marshal import imageMarshal
from omeroweb.webgateway.templatetags.common_filters import lengthformat,\
    lengthunit

import json
import omero_marshal
import omero

from version import __version__


WEB_API_VERSION = 0


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {'VERSION': __version__, 'IMAGE_ID': iid}
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key])

    # set interpolation default
    server_settings = request.session.get('server_settings', {})
    params['INTERPOLATE'] = server_settings.get('interpolate_pixels', True)

    # we add the (possibly prefixed) uris
    params['WEBGATEWAY'] = reverse('webgateway')
    params['WEBCLIENT'] = reverse('webindex')
    params['WEB_API_BASE'] = reverse(
        'api_base', kwargs={'api_version': WEB_API_VERSION})
    if settings.FORCE_SCRIPT_NAME is not None:
        params['URI_PREFIX'] = settings.FORCE_SCRIPT_NAME

    return render(
        request, 'omero_iviewer/index.html',
        {'params': params, 'iviewer_url_suffix': u"?_iviewer-%s" % __version__}
    )


@login_required()
def persist_rois(request, conn=None, **kwargs):
    if not request.method == 'POST':
        return JsonResponse({"error": "Use HTTP POST to send data!"})

    try:
        rois_dict = json.loads(request.body)
    except Exception as e:
        return JsonResponse({"error": "Failed to load json: " + e})

    # some preliminary checks are following...
    image_id = rois_dict.get('imageId', None)
    if image_id is None:
        return JsonResponse({"error": "No image id provided!"})
    rois = rois_dict.get('rois', None)
    if rois is None:
        return JsonResponse({"error": "Could not find rois array!"})

    # get the associated image and an instance of the update service
    image = conn.getObject("Image", image_id, opts=conn.SERVICE_OPTS)
    if image is None:
        return JsonResponse({"error": "Could not find associated image!"})

    # prepare services
    update_service = conn.getUpdateService()
    rois_service = conn.getRoiService()
    if update_service is None or rois_service is None:
        return JsonResponse({"error": "Could not get update/rois service!"})

    # when persisting we use the specific group context
    conn.SERVICE_OPTS['omero.group'] = image.getDetails().getGroup().getId()

    # loop over the given rois, marshal and persist/delete
    ret_ids = {}
    try:
        for r in rois:
            roi = rois.get(r)
            # marshal and asscociate with image
            decoder = omero_marshal.get_decoder(roi.get("@type"))
            decoded_roi = decoder.decode(roi)
            decoded_roi.setImage(image._obj)

            # differentiate between new rois and existing ones
            if int(r) < 0:
                # we save the new ones including all its new shapes
                decoded_roi = update_service.saveAndReturnObject(
                    decoded_roi, conn.SERVICE_OPTS)
                roi_id = decoded_roi.getId().getValue()
                # we associate them with the ids handed in
                i = 0
                for s in decoded_roi.copyShapes():
                    old_id = roi['shapes'][i].get('oldId', None)
                    shape_id = s.getId().getValue()
                    ret_ids[old_id] = str(roi_id) + ":" + str(shape_id)
                    i += 1
            else:
                # we fetch the existing ones
                result = rois_service.findByRoi(
                    long(r), None, conn.SERVICE_OPTS)
                # we need to have one only for each id
                if result is None or len(result.rois) != 1:
                    continue
                existing_rois = result.rois[0]

                # loop over decoded shapes (new, deleted and modified)
                j = 0
                shapes_done = {}
                shapes_deleted = 0
                shapes_to_be_added = []
                roi_id = decoded_roi.getId().getValue()
                for s in decoded_roi.copyShapes():
                    old_id = roi['shapes'][j].get('oldId', None)
                    delete = roi['shapes'][j].get('markedForDeletion', None)
                    j += 1
                    shape_id = s.getId().getValue()
                    if shape_id < 0:
                        # due to deletions/modifications that we store first
                        # the newly added ones are added afterwards
                        decoded_roi.removeShape(s)
                        shapes_to_be_added.append(
                            {"oldId": old_id, "shape": s})
                        continue
                    if delete is not None:
                        decoded_roi.removeShape(s)
                        shapes_deleted += 1
                    shapes_done[shape_id] = old_id
                # needed for saving multiple shapes in same roi
                # otherwise the update routine keeps only the modified
                for e in existing_rois.copyShapes():
                    found = shapes_done.get(e.getId().getValue(), None)
                    if found is None:
                        decoded_roi.addShape(e)
                # persist deletions and modifications
                decoded_roi = update_service.saveAndReturnObject(
                    decoded_roi, conn.SERVICE_OPTS)
                # now append the new shapes to the existing ones
                # and persist them
                for n in shapes_to_be_added:
                    decoded_roi.addShape(n['shape'])
                decoded_roi = update_service.saveAndReturnObject(
                    decoded_roi, conn.SERVICE_OPTS)
                nr_of_existing_shapes = decoded_roi.sizeOfShapes()
                nr_of_added_shapes = len(shapes_to_be_added)
                # if we deleted all shapes in the roi => remove it as well
                if nr_of_existing_shapes == 0:
                    conn.deleteObjects("Roi", [roi_id], wait=False)
                elif nr_of_added_shapes > 0:
                    # gather new ids for newly persisted shapes
                    start = nr_of_existing_shapes - nr_of_added_shapes
                    for n in shapes_to_be_added:
                        n_id = str(roi_id) + ":" +  \
                            str(decoded_roi.getShape(start).getId().getValue())
                        ret_ids[str(n['oldId'])] = n_id
                        start += 1
                # add to the list that contains the successfully persisted ids
                for x in shapes_done.values():
                    ret_ids[x] = x
    except Exception as marshalOrPersistenceException:
        # we return all successfully stored rois up to the error
        # as well as the error message
        return JsonResponse({'ids': ret_ids,
                            'error': repr(marshalOrPersistenceException)})

    return JsonResponse({"ids": ret_ids})


@login_required()
def image_data(request, image_id, conn=None, **kwargs):

    image = conn.getObject("Image", image_id)

    if image is None:
        return JsonResponse({"error": "Image not found"}, status=404)

    rv = imageMarshal(image)

    # Add extra parameters with units data
    # Note ['pixel_size']['x'] will have size in MICROMETER
    px = image.getPrimaryPixels().getPhysicalSizeX()
    if (px is not None):
        size = image.getPixelSizeX(True)
        value = format_value_with_units(size)
        rv['pixel_size']['unit_x'] = value[0]
        rv['pixel_size']['symbol_x'] = value[1]
    py = image.getPrimaryPixels().getPhysicalSizeY()
    if (py is not None):
        size = image.getPixelSizeY(True)
        value = format_value_with_units(size)
        rv['pixel_size']['unit_y'] = value[0]
        rv['pixel_size']['symbol_y'] = value[1]
    pz = image.getPrimaryPixels().getPhysicalSizeZ()
    if (pz is not None):
        size = image.getPixelSizeZ(True)
        value = format_value_with_units(size)
        rv['pixel_size']['unit_z'] = value[0]
        rv['pixel_size']['symbol_z'] = value[1]

    size_t = image.getSizeT()
    time_list = []
    delta_t_unit_symbol = None
    if size_t > 1:
        params = omero.sys.ParametersI()
        params.addLong('pid', image.getPixelsId())
        z = 0
        c = 0
        query = "from PlaneInfo as Info where"\
            " Info.theZ=%s and Info.theC=%s and pixels.id=:pid" % (z, c)
        info_list = conn.getQueryService().findAllByQuery(
            query, params, conn.SERVICE_OPTS)
        timemap = {}
        for info in info_list:
            t_index = info.theT.getValue()
            if info.deltaT is not None:
                value = format_value_with_units(info.deltaT)
                timemap[t_index] = value[0]
                if delta_t_unit_symbol is None:
                    delta_t_unit_symbol = value[1]
        for t in range(image.getSizeT()):
            if t in timemap:
                time_list.append(timemap[t])

    rv['delta_t'] = time_list
    rv['delta_t_unit_symbol'] = delta_t_unit_symbol

    return JsonResponse(rv)


def format_value_with_units(value):
        """
        Formats the response for methods above.
        Returns [value, unitSymbol]
        If the unit is MICROMETER or s in database (default), we
        convert to more appropriate units & value
        """
        if value is None:
            return (None, "")
        length = value.getValue()
        unit = value.getUnit()
        if unit == "MICROMETER":
            unit = lengthunit(length)
            length = lengthformat(length)
        elif unit == "MILLISECOND":
            length = length/1000.0
            unit = value.getSymbol()
        elif unit == "MINUTE":
            length = 60*length
            unit = value.getSymbol()
        elif unit == "HOUR":
            length = 3600*length
            unit = value.getSymbol()
        else:
            unit = value.getSymbol()
        return (length, unit)
