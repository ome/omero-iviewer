from django.shortcuts import render
from django.http import JsonResponse
from omeroweb.decorators import login_required
from django.http import HttpResponse

import omero_marshal
from omero.model import MaskI


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    return plugin_debug(request, iid=iid, conn=conn)


@login_required()
def plugin(request, iid=None, conn=None, debug=False, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {}
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key])

    return render(request, 'ol3-viewer/plugin.html',
                  {'image_id': iid, 'debug': debug, 'params': params})


@login_required()
def plugin_debug(request, iid=None, conn=None, **kwargs):
    return plugin(request, iid=iid, conn=conn, debug=True)


@login_required()
def request_rois(request, iid, conn=None, **kwargs):
    if iid is None:
        return JsonResponse({"error":
                            "no image id supplied for regions request"})

    roi_service = conn.getRoiService()
    if roi_service is None:
        return JsonResponse({"error":
                            "Could not get rois instance of roi service!"})

    ret = []
    try:
        result = roi_service.findByImage(long(iid), None)
        for roi in result.rois:
            rois_to_be_returned = {"@id": roi.getId().val, "shapes": []}
            for shape in roi.copyShapes():
                # masks not supported by marshal (would raise exception)
                if shape.__class__ == MaskI:
                    continue
                encoder = omero_marshal.get_encoder(shape.__class__)
                encoded_shape = encoder.encode(shape)
                if encoded_shape is None:
                    return JsonResponse({"error": "Failed to encode roi!"})
                rois_to_be_returned['shapes'].append(encoded_shape)
                ret.append(rois_to_be_returned)

        return JsonResponse(ret, safe=False)
    except Exception as someException:
        return JsonResponse({"error": "Failed to request/marshal rois: " +
                            repr(someException)})
