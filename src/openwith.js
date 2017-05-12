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
    // Add image Id to url
    url += selected[0].id + "/";

    // We try to traverse the jstree, to find parent of selected image
    if ($ && $.jstree) {
        try {
            var inst = $.jstree.reference('#dataTree');
            var parent = OME.getTreeImageContainerBestGuess(selected[0].id);
            if (parent && parent.data) {
                if (parent.type === 'dataset')
                    url += '?' + parent.type + '=' + parent.data.id
            }
        } catch(err) {
            console.log(err);
        }
    }
    return url;
});
