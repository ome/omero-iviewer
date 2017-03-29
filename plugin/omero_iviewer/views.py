from django.shortcuts import render
from django.http import JsonResponse
from django.http import HttpResponse
from django.conf import settings
from django.core.urlresolvers import reverse
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

    # we add the (possibly prefixed) uris
    params['WEBGATEWAY'] = reverse('webgateway')
    params['WEBCLIENT'] = reverse('webindex')
    if settings.FORCE_SCRIPT_NAME is not None:
        params['URI_PREFIX'] = settings.FORCE_SCRIPT_NAME

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
    rois = rois_dict.get('rois', None)
    if rois is None:
        return JsonResponse({"error": "Could not find rois array!"})

    # get the associated image and an instance of the update service
    image = conn.getObject("Image", image_id)
    if image is None:
        return JsonResponse({"error": "Could not find associated image!"})

    # prepare services
    update_service = conn.getUpdateService()
    rois_service = conn.getRoiService()
    if update_service is None or rois_service is None:
        return JsonResponse({"error": "Could not get update/rois service!"})

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
                decoded_roi = update_service.saveAndReturnObject(decoded_roi)
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
                result = rois_service.findByRoi(long(r), None)
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
                decoded_roi = update_service.saveAndReturnObject(decoded_roi)
                # now append the new shapes to the existing ones
                # and persist them
                for n in shapes_to_be_added:
                    decoded_roi.addShape(n['shape'])
                decoded_roi = update_service.saveAndReturnObject(decoded_roi)
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
                            'error': "Failed to marshal/save rois: " +
                             repr(marshalOrPersistenceException)})

    return JsonResponse({"ids": ret_ids})
