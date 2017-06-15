//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
OME.setOpenWithUrlProvider("omero_iviewer", function(selected, url) {
    selected_count = selected.length;
    // last selected image
    last_selected = selected[selected_count-1];
    // Add image Id to url
    url += last_selected.id + "/";

    // We try to traverse the jstree, to find parent of selected image
    if (selected_count === 1 && $ && $.jstree) {
        try {
            var inst = $.jstree.reference('#dataTree');
            var parent = OME.getTreeImageContainerBestGuess(last_selected.id);
            if (parent && parent.data) {
                if (parent.type === 'dataset')
                    url += '?' + parent.type + '=' + parent.data.id;
            }
        } catch(err) {
            console.log(err);
        }
        return url;
    }

    // append image list if more than one image was selected
    url += '?images=';
    for (var i=0;i<selected_count-1;i++)
        url += selected[i].id + ',';

    return url.substring(0, url.length-1);
});
