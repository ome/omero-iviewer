from django.conf.urls import patterns
from django.conf.urls import url

import views

urlpatterns = patterns('django.views.generic.simple',
                       url(r'^(?P<iid>[0-9]+)?/?$', views.index,
                           name='omero_iviewer_index'),
                       url(r'^persist_rois/?$', views.persist_rois,
                           name='omero_iviewer_persist_rois'))
