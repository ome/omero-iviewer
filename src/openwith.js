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
    initial_id = selected[0].id;
    initial_type = selected[0].type;

    // we short-circuit for anything that is not an image
    if (initial_type !== 'image') {
        return url + "?" + initial_type + "=" + initial_id;
    }

    // add image(s)
    url += "?images=";
    for (var i=0;i<selected_count;i++) {
        if (i !== 0) url += ',';
        url += selected[i].id;
    }
    // add parent for single image
    if (selected_count === 1 && $ && $.jstree) {
        try {
            var inst = $.jstree.reference('#dataTree');
            var parent = OME.getTreeImageContainerBestGuess(initial_id);
            if (parent && parent.data) {
                if (parent.type === 'dataset')
                    url += '&' + parent.type + '=' + parent.data.id;
            }
        } catch(err) {
            console.log(err);
        }
    }

    return url;
});
