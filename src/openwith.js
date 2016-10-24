OME.setOpenWithUrlProvider("viewer-ng", function(selected, url) {
    return url + selected[0].id + "/";
});
