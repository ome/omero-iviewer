from django.conf.urls import patterns
from django.conf.urls import url

import views

urlpatterns = patterns('django.views.generic.simple',
                       url(r'^(?P<iid>[0-9]+)?/?$', views.index,
                           name='ol3-viewer-index'),
                       url(r'^plugin/(?P<iid>[0-9]+)?/?$', views.plugin,
                           name='ol3-viewer-plugin'),
                       url(r'^plugin-debug/(?P<iid>[0-9]+)?/?$',
                           views.plugin_debug, name='ol3-viewer-plugin-debug'),
                       url(r'^request_rois/(?P<iid>[0-9]+)?/?$',
                           views.request_rois, name='ol3-viewer-request-rois'))
