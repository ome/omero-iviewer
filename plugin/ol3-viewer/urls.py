from django.conf.urls import patterns
from django.conf.urls import url

import views

urlpatterns = patterns('django.views.generic.simple',
     url( r'^(?P<iid>[0-9]+)?/?$', views.index, name='ol3_viewer_index' ),
 	 url( r'^getrois/(?P<iid>[0-9]+)?/?$', views.requestRois, name='ol3-viewer-getrois' ),
	 url( r'^persist_rois/?$', views.persistRois, name='ol3-viewer-persist-rois' ),
	 url( r'^plugin/(?P<iid>[0-9]+)?/?$', views.plugin, name='ol3-viewer-plugin' ),
	 url( r'^plugin-debug/(?P<iid>[0-9]+)?/?$', views.plugin_debug, name='ol3-viewer-plugin-debug' )
 )
