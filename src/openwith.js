OME.setOpenWithUrlProvider("omero_iviewer", function(selected, url) {
	// Add image Id to url
	url += selected[0].id + "/";

	// We try to traverse the jstree, to find parent of selected image
	if ($ && $.jstree) {
		try {
			var inst = $.jstree.reference('#dataTree');
			var parent = OME.getTreeImageContainerBestGuess(selected[0].id);
			if (parent && parent.data) {
				if (parent.type === 'dataset')
					url += '?dataset_id=' + parent.data.id;
			}
		} catch(err) {
			console.log(err);
		}
	}
    return url;
});
