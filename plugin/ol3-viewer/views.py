from django.shortcuts import render
from omeroweb.decorators import login_required
from django.http import HttpResponse


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
