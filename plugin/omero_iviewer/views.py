from django.shortcuts import render
from django.http import JsonResponse
from django.http import HttpResponse
from omeroweb.decorators import login_required

import json
import omero_marshal


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {'IMAGE_ID': iid}
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key])

    return render(request, 'omero_iviewer/index.html', {'params': params})


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

    count = rois_dict.get('count', 0)
    if count == 0:
        return JsonResponse({"stored": 0})

    rois = rois_dict.get('rois', None)
    if rois is None:
        return JsonResponse({"error": "Could not find rois array!"})

    # get the associated image and an instance of the update service
    image = conn.getObject("Image", image_id)
    if image is None:
        return JsonResponse({"error": "Could not find associated image!"})

    update_service = conn.getUpdateService()
    if update_service is None:
        return JsonResponse({"error": "Could not get update service!"})

    # loop over all rois and marshal, then store them
    count = 0
    ret_ids = {}
    try:
        for r in rois:
            roi = rois.get(r)

            # marshal,associate with image and save/update
            decoder = omero_marshal.get_decoder(roi.get("@type"))
            decoded_roi = decoder.decode(roi)
            decoded_roi.setImage(image._obj)
            decoded_roi = update_service.saveAndReturnObject(decoded_roi)

            i = 0
            has_deleted_shapes = False
            for s in decoded_roi.copyShapes():
                old_id = roi['shapes'][i].get('oldId', None)
                delete = roi['shapes'][i].get('markedForDeletion', None)
                # we delete in here so as to not create another loop
                if delete is not None:
                    has_deleted_shapes = True
                    decoded_roi.removeShape(s)
                if old_id is not None:
                    id1 = decoded_roi.getId().getValue()
                    id2 = s.getId().getValue()
                    ret_ids[old_id] = str(id1) + ":" + str(id2)
                i += 1
            # update if we removed shapes
            if has_deleted_shapes:
                decoded_roi = update_service.saveAndReturnObject(decoded_roi)
                # if roi is empty => delete it as well
                if len(decoded_roi.copyShapes()) == 0:
                    conn.deleteObjects("Roi", [decoded_roi.getId().getValue()],
                                       wait=False)
            count += 1
        return JsonResponse({"ids": ret_ids})
    except Exception as marshalOrPersistenceException:
        return JsonResponse({"error": "Failed to marshal/save rois: " +
                            repr(marshalOrPersistenceException)})
