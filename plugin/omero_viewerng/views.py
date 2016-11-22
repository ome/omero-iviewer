from django.shortcuts import render
from omeroweb.decorators import login_required
from django.http import HttpResponse

@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")

    params = {'IMAGE_ID' : iid }
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key]);

    return render(request, 'omero_viewerng/index.html', {'params' : params})
