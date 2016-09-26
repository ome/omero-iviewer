from django.shortcuts import render
from omeroweb.decorators import login_required
from omeroweb.http import HttpJsonResponse
from django.http import HttpResponse

@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {'IMAGE_ID' : iid }
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key]);

    return render(request, 'viewer-ng/index.html', {'params' : params})


@login_required()
def get_all_rdefs(request, img_id=None, conn=None, **kwargs):
    if img_id is None:
        return HttpJsonResponse({"error" : "get_all_rdefs needs an image id!"})
    try:
        img = conn.getObject("Image", img_id)

        if img is None:
            return HttpJsonResponse({"error" : "get_all_rdefs could not retrieve image!"})

        return HttpJsonResponse({'rdefs' : img.getAllRenderingDefs()})
    except:
        return HttpJsonResponse({"error" : "get_all_rdefs threw error!"})
