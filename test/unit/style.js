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

/*
 * Tests custom geometry classes
 */
describe("Style", function() {

    it('createFeatureStyle', function() {
        var shape_info = {
            "@type": "http://www.openmicroscopy.org/Schemas/OME/2016-06#Polyline",
            "FillColor": 1876845056,
            "StrokeColor": 3609855,
            "StrokeWidth": { "Value": 5.0, "Unit": "PIXEL" }
        };

        var style = ome.ol3.utils.Style.createFeatureStyle(shape_info);

        assert.instanceOf(style, ol.style.Style);
        var fill = style.getFill();
        assert.instanceOf(fill, ol.style.Fill);
        expect(fill.getColor()).to.eql("rgba(111,222,98,0)");
        var stroke = style.getStroke();
        expect(stroke.getColor()).to.eql("rgba(0,55,20,1)");

        shape_info = {
            "type": "Label",
            "FontStyle": "Normal",
            "FontSize": { "Value": 24.0, "Unit": "PIXEL" },
            "FontFamily": "sans-serif",
            "Text": "some text",
            "StrokeWidth": { "Value": 1.0, "Unit": "PIXEL" },
            "StrokeColor": 1694433535
        }
        style = ome.ol3.utils.Style.createFeatureStyle(shape_info, true);

        assert.instanceOf(style, ol.style.Style);
        var textStyle = style.getText();
        assert.instanceOf(textStyle, ol.style.Text);
        expect(textStyle.getText()).to.eql("some text");
        var fill = textStyle.getFill();
        expect(fill.getColor()).to.eql("rgba(100,255,0,1)");
    });
});
