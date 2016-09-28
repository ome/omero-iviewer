from django.conf.urls import patterns
from django.conf.urls import url

import views

urlpatterns = patterns('django.views.generic.simple',
     url( r'^(?P<iid>[0-9]+)?/?$', views.index, name='viewer_ng_index' )
 )
