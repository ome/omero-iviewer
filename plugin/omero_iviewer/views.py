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
from django.conf import settings
from django.core.urlresolvers import reverse

from os.path import splitext
from struct import unpack

from omeroweb.decorators import login_required
from omeroweb.webgateway.marshal import imageMarshal
from omeroweb.webgateway.templatetags.common_filters import lengthformat,\
    lengthunit

import json
import omero_marshal
import omero
from omero.rtypes import rint, rlong
from omero_sys_ParametersI import ParametersI
import omero.util.pixelstypetopython as pixelstypetopython

from version import __version__
from omero_version import omero_version

WEB_API_VERSION = 0

PROJECTIONS = {
    'normal': -1,
    'intmax': omero.constants.projection.ProjectionType.MAXIMUMINTENSITY,
    'intmean': omero.constants.projection.ProjectionType.MEANINTENSITY,
    'intsum': omero.constants.projection.ProjectionType.SUMINTENSITY,
}

QUERY_DISTANCE = 25


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    # create params (incl. versions)
    params = {'VERSION': __version__, 'OMERO_VERSION': omero_version}

    # check for image_id (default viewer setup)
    if iid is not None:
        params['IMAGES'] = iid

    # add rest of query string params
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
        return JsonResponse({"errors": ["Use HTTP POST to send data!"]})

    try:
        rois_dict = json.loads(request.body)
    except Exception as e:
        return JsonResponse({"errors": ["Failed to load json: " + repr(e)]})

    # some preliminary checks are following...
    image_id = rois_dict.get('imageId', None)
    if image_id is None:
        return JsonResponse({"errors": ["No image id provided!"]})
    rois = rois_dict.get('rois', None)
    if rois is None:
        return JsonResponse({"errors": ["Could not find rois object!"]})

    # get the associated image and an instance of the update service
    image = conn.getObject("Image", image_id, opts=conn.SERVICE_OPTS)
    if image is None:
        return JsonResponse({"errors": ["Could not find associated image!"]})

    # prepare services
    update_service = conn.getUpdateService()
    if update_service is None:
        return JsonResponse({"errors": ["Could not get update service!"]})

    # when persisting we use the specific group context
    conn.SERVICE_OPTS['omero.group'] = image.getDetails().getGroup().getId()

    # for id syncing
    ids_to_sync = {}
    # keep track of errors
    errors = []

    # insert new ones
    try:
        new = rois.get('new', [])
        new_count = len(new)
        if new_count > 0:
            decoded_rois = []
            for n in new:
                new_roi = {
                    "@type":
                    "http://www.openmicroscopy.org/Schemas/OME/2016-06#ROI",
                    "shapes": [n]
                }
                decoder = omero_marshal.get_decoder(new_roi.get("@type"))
                decoded_roi = decoder.decode(new_roi)
                decoded_roi.setImage(image._obj)
                decoded_rois.append(decoded_roi)
            decoded_rois = update_service.saveAndReturnArray(
                decoded_rois, conn.SERVICE_OPTS)
            # sync ids
            for r in range(new_count):
                ids_to_sync[new[r]['oldId']] = \
                    str(decoded_rois[r].getId().getValue()) + ':' + \
                    str(decoded_rois[r].getShape(0).getId().getValue())
    except Exception as marshalOrPersistenceException:
        errors.append('Error persisting new rois: ' +
                      repr(marshalOrPersistenceException))

    # modify existing ones
    try:
        modified = rois.get('modified', [])
        modified_count = len(modified)
        if modified_count > 0:
            decoded_shapes = []
            for m in modified:
                decoder = omero_marshal.get_decoder(m.get("@type"))
                decoded_shapes.append(decoder.decode(m))
            update_service.saveArray(decoded_shapes, conn.SERVICE_OPTS)
        # set ids after successful modification
        for r in range(modified_count):
            ids_to_sync[modified[r]['oldId']] = modified[r]['oldId']
    except Exception as marshalOrPersistenceException:
        errors.append('Error modifying rois: ' +
                      repr(marshalOrPersistenceException))

    # delete entire (empty) rois
    try:
        empty_rois = rois.get('empty_rois', {})
        empty_rois_ids = [long(k) for k in list(empty_rois.keys())]
        if (len(empty_rois_ids) > 0):
            conn.deleteObjects("Roi", empty_rois_ids, wait=True)
        # set ids after successful deletion,
        for e in empty_rois:
            for s in empty_rois[e]:
                ids_to_sync[s] = s
    except Exception as deletionException:
        errors.append('Error deleting empty rois: ' +
                      repr(deletionException))

    # remove individual shapes (so as to not punch holes into shape index)
    try:
        deleted = rois.get('deleted', {})
        deleted_rois_ids = deleted.keys()
        if len(deleted_rois_ids) > 0:
            rois_service = conn.getRoiService()
            rois_to_be_updated = []
            for d in deleted_rois_ids:
                r = rois_service.findByRoi(
                    long(d), None, conn.SERVICE_OPTS).rois[0]
                for s in r.copyShapes():
                    roi_shape_id = str(d) + ':' + str(s.getId().getValue())
                    if roi_shape_id in deleted[d]:
                        r.removeShape(s)
                rois_to_be_updated.append(r)
            update_service.saveArray(rois_to_be_updated, conn.SERVICE_OPTS)
            # set ids after successful deletion,
            for d in deleted:
                for s in deleted[d]:
                    ids_to_sync[s] = s
    except Exception as deletionException:
        errors.append('Error deleting shapes: ' + repr(deletionException))

    # prepare response
    ret = {'ids': ids_to_sync}
    if len(errors) > 0:
        ret['errors'] = errors

    return JsonResponse(ret)


@login_required()
def image_data(request, image_id, conn=None, **kwargs):

    image = conn.getObject("Image", image_id)

    if image is None:
        return JsonResponse({"error": "Image not found"}, status=404)

    try:
        rv = imageMarshal(image)

        # set roi count
        rv['roi_count'] = image.getROICount()

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
        df = "%Y-%m-%d %H:%M:%S"
        rv['import_date'] = image.creationEventDate().strftime(df)
        if image.getAcquisitionDate() is not None:
            rv['acquisition_date'] = image.getAcquisitionDate().strftime(df)

        # add available families
        rv['families'] = []
        families = image.getFamilies().values()
        for fam in families:
            rv['families'].append(fam.getValue())

        return JsonResponse(rv)
    except Exception as image_data_retrieval_exception:
        return JsonResponse({'error': repr(image_data_retrieval_exception)})


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


@login_required()
def save_projection(request, conn=None, **kwargs):
    # check for mandatory parameters
    image_id = request.GET.get("image", None)
    proj_type = request.GET.get("projection", None)
    if image_id is None or proj_type is None:
        return JsonResponse({"error": "Image id/Projection not supplied"})
    proj = PROJECTIONS.get(proj_type, -1)
    # we do only create new images for listed projections
    if proj == -1:
        return JsonResponse({"error": "Projection type not listed"})

    # optional parameters
    start = request.GET.get("start", None)
    end = request.GET.get("end", None)
    dataset_id = request.GET.get("dataset", None)

    # retrieve image object
    img = conn.getObject("Image", image_id, opts=conn.SERVICE_OPTS)
    if img is None:
        return JsonResponse({"error": "Image not Found"}, status=404)

    new_image_id = None
    try:
        # no getter defined in gateway...
        proj_svc = conn._proxies['projection']

        # gather params needed for projection call
        pixels_id = img.getPixelsId()
        pixels = img.getPrimaryPixels()
        pixels_type = pixels.getPixelsType()._obj

        # assemble new file name
        filename, extension = splitext(img.getName())
        file_name = filename + '_proj' + extension

        # delegate to projectPixels
        new_image_id = proj_svc.projectPixels(
            pixels_id, pixels_type, proj, 0, img.getSizeT()-1,
            range(img.getSizeC()), 1, int(start), int(end), file_name)

        # apply present rendering settings
        try:
            rnd = conn.getRenderingSettingsService()
            rnd.applySettingsToImage(pixels_id, new_image_id)
        except Exception:
            pass

        # set image decription
        details = []
        details.append("Original Image: " + img.getName())
        details.append("Original Image ID: " + image_id)
        details.append("Projection Type: " + proj_type)
        details.append(
            "z-sections: " + str(int(start)+1) + "-" + str(int(end)+1))
        size_t = img.getSizeT()
        if size_t == 1:
            details.append("timepoint: " + str(size_t))
        else:
            details.append("timepoints: 1-" + str(size_t))
        description = "\n".join(details)

        new_img = conn.getObject(
            "Image", new_image_id, opts=conn.SERVICE_OPTS)
        new_img.setDescription(description)
        new_img.save()

        # if we have a dataset id => we try to link to it
        if dataset_id is not None:
            upd_svc = conn.getUpdateService()
            conn.SERVICE_OPTS.setOmeroGroup(
                conn.getGroupFromContext().getId())
            link = omero.model.DatasetImageLinkI()
            link.parent = omero.model.DatasetI(long(dataset_id), False)
            link.child = omero.model.ImageI(new_image_id, False)
            upd_svc.saveObject(link, conn.SERVICE_OPTS)
    except Exception as save_projection_exception:
        return JsonResponse({"error": repr(save_projection_exception)})

    return JsonResponse({"id": new_image_id})


@login_required()
def well_images(request, conn=None, **kwargs):
    # check for mandatory parameter id
    well_id = request.GET.get("id", None)
    if well_id is None:
        return JsonResponse({"error": "No well id provided."})

    try:
        query_service = conn.getQueryService()

        # set well id
        params = ParametersI()
        params.add("well_id", rlong(long(well_id)))

        # get total count first
        count = query_service.projection(
            "select count(distinct ws.id) from WellSample ws " +
            "where ws.well.id = :well_id", params, )
        results = {"data": [], "meta": {"totalCount": count[0][0].val}}

        # set offset and limit
        filter = omero.sys.Filter()
        filter.offset = rint(request.GET.get("offset", 0))
        filter.limit = rint(request.GET.get("limit", 10))
        params.theFilter = filter

        # fire off query
        images = query_service.findAllByQuery(
            "select ws.image from WellSample ws " +
            "where ws.well.id = :well_id order by well_index", params)

        # we need only image id and name for our purposes
        for img in images:
            img_ret = {"@id": img.getId().getValue()}
            if img.getName() is not None:
                img_ret["Name"] = img.getName().getValue()
            results["data"].append(img_ret)

        return JsonResponse(results)
    except Exception as get_well_images_exception:
        return JsonResponse({"error": repr(get_well_images_exception)})


@login_required()
def get_intensity(request, conn=None, **kwargs):
    # get mandatory params
    image_id = request.GET.get("image", None)
    x, y = request.GET.get("x", None), request.GET.get("y", None)
    z, t = request.GET.get("z", None), request.GET.get("t", None)
    cs = request.GET.get("c", None)

    # checks
    if image_id is None or x is None or y is None or cs is None \
            or z is None or t is None:
                return JsonResponse(
                    {"error": "Mandatory params are: image, x, y, c, z and t"})

    # retrieve image object
    img = conn.getObject("Image", image_id, opts=conn.SERVICE_OPTS)
    if img is None:
        return JsonResponse({"error": "Image not Found"}, status=404)

    # further bound checks
    x, y, z, t = int(float(x)), int(float(y)), int(float(z)), int(float(t))
    size_x, size_y = img.getSizeX(), img.getSizeY()
    size_z, size_t = img.getSizeZ(), img.getSizeT()
    if (x < 0 or x >= size_x or y < 0 or y >= size_y or
            z < 0 or z >= size_z or t < 0 or t >= size_t):
        return JsonResponse(
            {"error": "Either one or more x, y, z, t are out of bounds"})

    # check given channels
    channels = []
    try:
        tokens = cs.split(',')
        size_c = img.getSizeC()
        for tok in tokens:
            tok = int(tok)
            if tok < 0 or tok >= size_c:
                return JsonResponse(
                    {"error": "One or more channels are out of bounds"})
            channels.append(tok)
    except Exception:
        return JsonResponse(
            {"error": "The channels have to be a comma separated string"})
    if len(channels) == 0:
        return JsonResponse(
            {"error": "Please supply a valid list of channels"})

    raw_pixel_store = None
    try:
        raw_pixel_store = conn.createRawPixelsStore()
        raw_pixel_store.setPixelsId(img.getPixelsId(), True)
        pixels_type = img.getPrimaryPixels().getPixelsType().getValue()

        # determine query extent
        x_offset = x - QUERY_DISTANCE
        if x_offset < 0:
            x_offset = 0
        y_offset = y - QUERY_DISTANCE
        if y_offset < 0:
            y_offset = 0
        width = 2 * QUERY_DISTANCE + 1
        if x_offset + width >= size_x:
            width = size_x - x_offset
        height = 2 * QUERY_DISTANCE + 1
        if y_offset + height >= size_y:
            height = size_y - y_offset
        extent = [x_offset, y_offset, x_offset + width, y_offset + height]
        conversion = '>' + str(width * height) +  \
            pixelstypetopython.toPython(pixels_type)

        # prepare return object (setting extent)
        results = {}
        results['count'] = 0
        results['pixels'] = {}

        # loop over all channels and collect the pixel intensities
        # contained in extent with getTile (extent width x height)
        for chan in channels:
            point_data = raw_pixel_store.getTile(
                z, chan, t, x_offset, y_offset, width, height)
            unpacked_point_data = unpack(conversion, point_data)
            i = 0
            for row in range(extent[1], extent[3]):
                for col in range(extent[0], extent[2]):
                    key = str(col) + "-" + str(row)
                    entry = results['pixels'].get(key)
                    if entry is None:
                        entry = {}
                        results['pixels'][key] = entry
                    entry[str(chan)] = unpacked_point_data[i]
                    i += 1
            results['count'] += i
        return JsonResponse(results)
    except Exception as pixel_service_exception:
        return JsonResponse({"error": repr(pixel_service_exception)})
    finally:
        if raw_pixel_store is not None:
            raw_pixel_store.close()


@login_required()
def shape_stats(request, conn=None, **kwargs):
    # check for mandatory parameters
    ids = request.GET.get("ids", None)
    z = request.GET.get("z", None)
    t = request.GET.get("t", None)
    if ids is None or z is None or t is None:
        return JsonResponse(
            {"error": "Parameters ids, z and t are mandatory"})

    # convert input params
    channels = []
    try:
        ids = [
            long(id.split(':')[1]) if ':' in id else long(id)
            for id in ids.split(',') if id != ''
        ]
        z, t = int(z), int(t)
        # optional cs
        cs = request.GET.get("cs", None)
        if cs is not None:
            channels = [int(c) for c in cs.split(',') if c != '']
    except Exception:
        return JsonResponse({"error": "Invalid Parameter types"})

    try:
        # call rois service restricted stats method
        # populating our own return objects for convenience
        rois_service = conn.getRoiService()
        stats = rois_service.getShapeStatsRestricted(ids, z, t, channels)
        ret = {}
        for stat in stats:
            ret_stat = []
            number_of_channels = len(stat.channelIds)
            i = 0
            while i < number_of_channels:
                ret_stat_chan = {
                    "index": stat.channelIds[i],
                    "points": stat.pointsCount[i],
                    "min": stat.min[i],
                    "max": stat.max[i],
                    "sum": stat.sum[i],
                    "mean": stat.mean[i],
                    "std_dev": stat.stdDev[i]
                }
                ret_stat.append(ret_stat_chan)
                i += 1
            ret[str(stat.shapeId)] = ret_stat
        return JsonResponse(ret,)
    except omero.ApiUsageException as api_exception:
        return JsonResponse({"error": api_exception.message})
    except Exception as stats_call_exception:
        return JsonResponse({"error": repr(stats_call_exception)})
