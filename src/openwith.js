OME.setOpenWithUrlProvider("omero_viewerng", function(selected, url) {
    return url + selected[0].id + "/";
});
