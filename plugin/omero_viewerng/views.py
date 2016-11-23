from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
from django.http import HttpResponse
from omeroweb.decorators import login_required

import json
import omero_marshal

@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {'IMAGE_ID' : iid }
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key]);

    return render(request, 'omero_viewerng/index.html', {'params' : params})

@login_required()
def persistRois(request, conn=None, **kwargs):
	if not request.method == 'POST':
		return JsonResponse({ "error" : "Use HTTP POST to send data!"})

	try:
		roisDict = json.loads(request.body)
	except Exception as e:
		return JsonResponse({ "error" : "Failed to load json: " + e})

	#some preliminary checks are following...
	imageId = roisDict.get('imageId', None)
	if imageId is None:
		return JsonResponse({ "error" : "No image id provided!"})

	count = roisDict.get('count', 0)
	if count == 0:
		return JsonResponse({ "stored" : 0})

	rois = roisDict.get('rois', None)
	if rois is None:
		return JsonResponse({ "error" : "Could not find rois array!"})

	# get the associated image and an instance of the update service
	image = conn.getObject("Image", imageId)
	if image is None:
		return JsonResponse({ "error" : "Could not find associated image!"})

	updateService = conn.getUpdateService()
	if updateService is None:
		return JsonResponse({ "error" : "Could not get update service!"})

	#loop over all rois and marshal, then store them
	count = 0
	retIds = {}
	try:
		for r in rois:
			roi = rois.get(r)

			#marshal,associate with image and save/update
			decoder = omero_marshal.get_decoder(roi.get("@type"))
			decodedRoi = decoder.decode(roi);
			decodedRoi.setImage(image._obj)
			decodedRoi = updateService.saveAndReturnObject(decodedRoi)

			i = 0
			hasDeletedShapes = False
			for s in decodedRoi.copyShapes():
				oldId = roi['shapes'][i].get('oldId', None)
				delete = roi['shapes'][i].get('markedForDeletion', None)
				# we delete in here so as to not create another loop
				if delete is not None:
					hasDeletedShapes = True
					decodedRoi.removeShape(s);
				if oldId is not None:
					retIds[oldId] = str(decodedRoi.getId().val) + ":" + str(s.getId().val);
				i += 1
			# update if we removed shapes
			if hasDeletedShapes:
				decodedRoi = updateService.saveAndReturnObject(decodedRoi)
				#if roi is empty => delete it as well
				if len(decodedRoi.copyShapes()) == 0:
					conn.deleteObjects("Roi", [decodedRoi.id.val], wait=False)
			count += 1
		return JsonResponse({"ids": retIds})
	except Exception as marshalOrPersistenceException:
		return JsonResponse({ "error" : "Failed to marshal/save rois: " +
			repr(marshalOrPersistenceException)})
