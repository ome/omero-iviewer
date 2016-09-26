from django.conf.urls import patterns
from django.conf.urls import url

import views

urlpatterns = patterns('django.views.generic.simple',
     url( r'^(?P<iid>[0-9]+)?/?$', views.index, name='viewer_ng_index' ),
     url( r'^get_all_rdefs/(?P<img_id>[0-9]+)?/?$', views.get_all_rdefs, name='viewer_ng_get_all_rdefs' ),
 )
