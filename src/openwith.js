OME.setOpenWithUrlProvider("omero_iviewer", function(selected, url) {
    return url + selected[0].id + "/";
});
