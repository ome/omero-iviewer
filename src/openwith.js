OME.setOpenWithUrlProvider("OMERO.iviewer", function(selected, url) {
    return url + selected[0].id + "/";
});
