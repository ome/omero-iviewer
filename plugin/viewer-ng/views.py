from django.shortcuts import render
from omeroweb.decorators import login_required
from django.http import HttpResponse

@login_required()
def index(request, iid=None, conn=None, **kwargs):
    if iid is None:
		return HttpResponse("Viewer needs an image id!")

    return render(request, 'viewer-ng/index.html', {'image_id' : iid })
