//
// Copyright (C) 2019 University of Dundee & Open Microscopy Environment.
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

import Feature from 'ol/Feature';
import Collection from 'ol/Collection';
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import {WEBGATEWAY,
    REGIONS_STATE,
    DEFAULT_LINE_CAP,
    DEFAULT_LINE_JOIN,
    DEFAULT_MITER_LIMIT} from '../globals';
import {TRANSPARENT_PLACEHOLDER} from './Conversion';
import Regions from '../source/Regions';
import Label from '../geom/Label';
import Line from '../geom/Line';
import Mask from '../geom/Mask';
import {isArray} from '../utils/Misc';
import {convertSignedIntegerToColorObject,
    convertColorObjectToRgba} from './Conversion';

/**
 * Creates an open layers style object based on the handed in roi shapes info
 *
 * @private
 * @param {Object} shape_info the roi shape information
 * @param {boolean} is_label a flag that tells us if we are a label (default: false)
 * @param {boolean=} fill_in_defaults use defaults for missing info (default: true)
 * @return {ol.style.Style|null} a style object or null if something went wrong
 */
export const createFeatureStyle = function(shape_info, is_label, fill_in_defaults) {
    // preliminary checks
    if (typeof(shape_info) != 'object') return null;
    var forLabel = (typeof(is_label) === 'boolean') ? is_label : false;
    if (typeof fill_in_defaults !== 'boolean') fill_in_defaults = true;

    // that way we know whether at least one style property for stroke/fill was given
    var stroke = {'count' : 0};
    var fill = {'count' : 0};
    var tmpColor = null;

    // FILL PROPERTIES
    if (typeof(shape_info['FillColor']) === 'number') {
        // we need hex +alpha to rgba conversion via color object
        tmpColor = convertSignedIntegerToColorObject(
                shape_info['FillColor']);
        fill['color'] = convertColorObjectToRgba(tmpColor);
        if (fill['color'] != null) fill['count']++;
    }

    // STROKE PROPERTIES
    if (typeof(shape_info['StrokeColor']) === 'number') {
        // we need hex +alpha to rgba conversion via color object
        tmpColor = convertSignedIntegerToColorObject(
                shape_info['StrokeColor']);
        stroke['color'] = convertColorObjectToRgba(tmpColor);
        if (stroke['color'] != null) stroke['count']++;
    }
    if (typeof shape_info['StrokeWidth'] === 'object' &&
        shape_info['StrokeWidth'] !== null &&
        typeof shape_info['StrokeWidth']['Value'] === 'number') {
            stroke['width'] = shape_info['StrokeWidth']['Value'];
            stroke['count']++;
    } else if (fill_in_defaults) {
        stroke['width'] = 1;
    }
    if (stroke['count'] > 0) {
        // we need to set some sensible defaults for the following
        stroke['lineCap'] = DEFAULT_LINE_CAP;
        stroke['lineJoin'] = DEFAULT_LINE_JOIN;
        stroke['miterLimit'] = DEFAULT_MITER_LIMIT;
    }

    // instantiate style objects
    var strokeStyle = (stroke['count'] > 0) ? new Stroke(stroke) : null;
    var fillStyle = (fill['count'] > 0) ? new Fill(fill) : null;

    // contains style information
    var style = {};
    var text = { "count" : 0};
    if (typeof shape_info['Text'] === 'string') {
        text['text'] = shape_info['Text'];
        text['count']++;
    } else if (typeof shape_info['Text'] === 'object' &&
        shape_info['Text'] === null) {
        text['text'] = '';
        text['count']++;
    }
    var font = "";
    if (typeof(shape_info['FontStyle']) === 'string')
        font += (shape_info['FontStyle'] + " ");
    else if (fill_in_defaults) font += "normal ";
    if (typeof(shape_info['FontSize']) === 'object' &&
        shape_info['FontSize'] !== null)
        font += (shape_info['FontSize']['Value'] + "px ");
    else if (fill_in_defaults) font += "10px ";
    if (typeof(shape_info['FontFamily']) === 'string')
        font += shape_info['FontFamily'];
    else if (fill_in_defaults) font += "sans-serif";
    if (font.length > 0) {
        text['font'] = font;
        text['count']++;
    }
    if (strokeStyle) {
        // we don't want spikes
        stroke['lineCap'] = "round";
        stroke['lineJoin'] = "round";
        text['fill'] = new Fill(stroke);
        text['count']++;
    } else if (forLabel &&
        !(text['fill'] instanceof Fill) && fillStyle) {
            text['fill'] = new Fill(fill);
            text['count']++;
    }
    if (text['count'] > 0) {
        text['overflow'] = true;
        style['text'] = new Text(text);

        // we do not wish for defaults (ol creates default fill color)
        if (!fill_in_defaults &&
                ((!forLabel && typeof shape_info['StrokeColor'] !== 'number') ||
                (forLabel && typeof shape_info['FillColor'] !== 'number' &&
                    typeof shape_info['StrokeColor'] !== 'number')))
            style['text'].fill_ = null;
    }

    if (strokeStyle) style['stroke'] = strokeStyle;
    if (fillStyle) style['fill'] = fillStyle;
    if (forLabel) { // the workaround for mere labels
        style['stroke'] = new Stroke(
            {'color': "rgba(255,255,255,0)", 'width': 1,
             'lineCap' : DEFAULT_LINE_CAP, 'lineJoin' : DEFAULT_LINE_JOIN,
             'miterLimit' : DEFAULT_MITER_LIMIT
            });
        style['fill'] = new Fill({'color': "rgba(255,255,255,0)"});
    }

    return new Style(style);
}


/**
 * Used internally to replace the style/style function of a feature.
 * In specific, this is called if setScaleText or setRotateText members are called
 * see {@link source.Regions.setScaleText}
 * see {@link source.Regions.setRotateText}
 *
 * @private
 * @param {olFeature} feature the feature whose style (function) to adjust
 * @param {source.Regions} regions_reference a reference to the regions instance
 * @param {boolean=} forceUpdate forces label to be updated even if rotation/resolution (flags) were not modified
 */
export const updateStyleFunction =
    function(feature, regions_reference, forceUpdate) {
        if (!(feature instanceof Feature))
            console.error("A style function requires an instance of a feature!");

        if (!(regions_reference instanceof Regions))
            console.error("A style function requires an instance of Regions!");

        // all this makes only sense with a style really
        var oldStyle = feature.getStyle();
        if (oldStyle == null) return;
        var viewRef = regions_reference.viewer_.viewer_.getView();

        // three possibilities:
        // we are a style, an array of styles (arrow),
        // or a style function...
        if (typeof(oldStyle) === 'function')
            oldStyle = oldStyle.call(feature, viewRef.getResolution());
        if (isArray(oldStyle))
            oldStyle = oldStyle[0]; // we want the first one only

        // keep regions reference handy
        feature['regions'] = regions_reference;

        // remember a heck of a lot of things to see if they have changed later
        // 1. remember unselected style for un/select changes
        var oldStrokeStyle = oldStyle.getStroke();
        if (typeof(feature['oldStrokeStyle']) !== 'object') {
            if (oldStrokeStyle)
                feature['oldStrokeStyle'] = {
                    "color" : oldStrokeStyle.getColor(),
                    "width" : oldStrokeStyle.getWidth()
                };
            else feature['oldStrokeStyle'] = null;
        }
        // 2. remember old resolution/rotation and text scale/rotate flags
        // this is only relevant for labels
        if (feature.getGeometry() instanceof Label) {
            if (typeof(feature['oldRotation']) === 'undefined')
                feature['oldRotation'] = viewRef.getRotation();
            if (typeof(feature['oldScale']) === 'undefined')
                feature['oldScale'] = viewRef.getResolution();
            if (typeof(feature['oldRotationFlag']) === 'undefined')
                feature['oldRotationFlag'] = regions_reference.rotate_text_;
            if (typeof(feature['oldScaleFlag']) === 'undefined')
                feature['oldScaleFlag'] = regions_reference.scale_text_;
        }

        // 3. set masks (via style)
        if (feature.getGeometry() instanceof Mask) {
            var maskId = feature.getId();
            var url = regions_reference.viewer_.getServer()['full'] +
                regions_reference.viewer_.getPrefixedURI(WEBGATEWAY) +
                '/render_shape_mask/' +
                maskId.substring(maskId.indexOf(":")+1) + '/';
            oldStyle.setImage(new Icon({
                anchorOrigin: 'top-left',
                anchor: [0,0],
                rotateWithView: true,
                src: url
            }));
        }

        // replace style function
        feature.setStyle(function(featureToStyle, actual_resolution) {
            // fetch view via regions reference
            if (!(feature['regions'] instanceof Regions))
                return oldStyle; // we are screwed, return old setStyle

            // OpenLayers5 doesn't allow you to drag (Translate) if no fill
            if (oldStyle.getFill() == null) {
                // fill with transparent placeholder (not saved)
                oldStyle.setFill(new Fill({color: TRANSPARENT_PLACEHOLDER}));
            }

            var regions = feature['regions'];
            var geom = feature.getGeometry();
            // find present flags for scaling/rotating text
            var scale_text = regions.scale_text_;
            var rotate_text = regions.rotate_text_;
            // get present rotation
            var rotation = viewRef.getRotation();

            // is there a text style?
            var textStyle = oldStyle.getText();
            // if show_comments flag is to false, we only set the text for labels
            var isLabel = (geom instanceof Label);
            if (!isLabel && !regions.show_comments_ &&
                (textStyle instanceof Text)) {
                    feature['oldText'] = textStyle.clone();
                    textStyle = null;
                    oldStyle.text_ = textStyle;
            } else if (!isLabel && regions.show_comments_ &&
                       !(textStyle instanceof Text) &&
                       (feature['oldText'] instanceof Text)) {
                           // this brings back a previously not shown comment
                           textStyle = feature['oldText'].clone();
                           oldStyle.text_ = textStyle;
            }

            if (textStyle instanceof Text) {
                textStyle.setOverflow(true);
                // seems we want to adjust text to resolution level
                if (scale_text) {
                    var newScale = 1/actual_resolution;
                    textStyle.setScale(newScale);
                } else {// this is for a potential reset after a change
                    textStyle.setScale(1);
                }

            // seems we want the text to go along with the shape rotation
            if (rotate_text) textStyle.setRotation(rotation);
            else textStyle.setRotation(0);

            forceUpdate = forceUpdate || false;
            if (isLabel && (forceUpdate ||
                (feature['oldRotation'] !== rotation ||
                feature['oldScale'] !== actual_resolution ||
                feature['oldRotationFlag'] !== rotate_text ||
                feature['oldScaleFlag'] !== scale_text))) {
                    if (feature['oldRotation'] !== rotation)
                        feature['oldRotation'] = rotation;
                    if (feature['oldScale'] !== actual_resolution)
                        feature['oldScale'] = actual_resolution;
                    if (feature['oldRotationFlag'] !== rotate_text)
                        feature['oldRotationFlag'] = rotate_text;
                    if (feature['oldScaleFlag'] !== scale_text)
                        feature['oldScaleFlag'] = scale_text;
                    // reset the flag, we do this only once
                    if (forceUpdate) forceUpdate = false;
                    var newDims = measureTextDimensions(
                            textStyle.getText(), textStyle.getFont(),
                            scale_text ? null : actual_resolution);
                    var newRot = rotate_text ? 0 : 0-rotation;
                    geom.adjustCoordinates(newRot, newDims);
                }
            }

            var selected =
                typeof(feature['selected'] === 'boolean') ?
                    feature['selected'] : false;
            var selectionStyle = new Stroke();
            selectionStyle.setColor('rgba(0,153,255,1)');
            selectionStyle.setWidth(3);
            if (selected) {
                oldStyle.stroke_ = selectionStyle;
            } else if (regions.getHoverId() == feature.getId()) {
                oldStyle.stroke_ = new Stroke({
                    color: oldStrokeStyle.getColor(),
                    width: oldStrokeStyle.getWidth() + 2,
                });
            } else if (feature['oldStrokeStyle']) {
                // restore old style
                var w = feature['oldStrokeStyle']['width'];
                if (w === 0) w = 1;
                oldStyle.stroke_ = new Stroke({
                    'color' : feature['oldStrokeStyle']['color'],
                    'width' : w
                });
            } else {
                oldStyle.stroke_ = null;
            }

            var ret = [oldStyle];
            var zIndex = selected ? 2 : 1;

            // arrow heads/tails for lines
            if (geom instanceof Line &&
                    (geom.has_start_arrow_ || geom.has_end_arrow_)) {

                var lineStroke = oldStyle.getStroke();
                var arrowBaseWidth = 15 * actual_resolution;

                // determine which arrows we need
                var arrowsToDo = [];
                if (geom.has_end_arrow_) arrowsToDo.push(true);
                if (geom.has_start_arrow_) arrowsToDo.push(false);
                // make sure arrow is pointy, not rounded.
                lineStroke.setLineCap(DEFAULT_LINE_CAP);
                lineStroke.setLineJoin(DEFAULT_LINE_JOIN);
                lineStroke.setMiterLimit(DEFAULT_MITER_LIMIT);
                // create arrow head with styling
                for (var a in arrowsToDo) {
                    var isHeadArrow = arrowsToDo[a];
                    var arrow =
                        geom.getArrowGeometry(
                            isHeadArrow, arrowBaseWidth, arrowBaseWidth);
                    var arrowStyle =
                        new Style({
                            geometry: arrow,
                            fill: new Fill(
                                    {color: lineStroke.getColor()}),
                            stroke: lineStroke,
                            zIndex: zIndex
                    });
                    ret.push(arrowStyle);
                };
            }

            // make adjustments for masks
            if (geom instanceof Mask) {
                oldStyle.getImage().setScale(1/actual_resolution);
                if (selected) {
                    ret.push(new Style({
                        geometry: geom.getOutline(),
                        stroke: selectionStyle,
                        zIndex: zIndex+1
                    }));
                } else zIndex--;
            }

            oldStyle.setZIndex(zIndex);

            return ret;
    });
}

/**
 * Helps measure the width of text using canvas metrics
 * it will return an object like this where the units are pixels:
 * <pre>
 * { width: 10, height: 20}
 * </pre>
 *
 * @static
 * @function
 * @param {string} text the text whose width we want to measure
 * @param {string} font the font for the given text, e.g. 'bold 100px arial'
 * @param {number=} resolution the resolution applied to the font size
 * @return {Object} a dimension object with properties width and height (in pixels)
 */
export const measureTextDimensions = function(text, font, resolution) {
    // preliminary check: we need 2 strings
    if (typeof(text) !== 'string' || typeof(font) !== 'string' ) return null;

    var fontSize = 10;
    resolution =
        (typeof(resolution) === 'number' && resolution > 0) ? resolution : 1;
    var fontTokens = font.split(' ');
    if (fontTokens.length != 3) return null;

    try {
        fontSize = parseInt(fontTokens[1]);
        fontSize *= resolution;
        fontSize = Math.ceil(fontSize);
        font = fontTokens[0] + " " + fontSize + "px " + fontTokens[2];
    } catch(notANumber) {
        // nothing we can do
    }

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext("2d");
    ctx.font = font;
    var metrics = ctx.measureText(text);

    // set return object with measured dimensions
    return { 'width' : metrics.width > 0 ?
                            metrics.width : 5, 'height' : fontSize};
}

/**
 * Produces a deep copy of the style object handed in.
 * Caution: it does not copy all properties. In specific it copies only the ones
 * we want/need such as fill, stroke and text properties!
 *
 * @static
 * @function
 * @param {Style} style the style object to clone
 * @return {Style|null} an open layer's style instance or null
 */
export const cloneStyle = function(style) {
    if (!(style instanceof Style)) return null;

    var newStyle = null;

    // FILL
    var newFill = null;
    if (style.getFill())
        newFill = new Fill({"color" : style.getFill().getColor()});

    // STROKE
    var newStroke = cloneStroke(style.getStroke());

    // TEXT
    var newText = null;
    if (style.getText()) {
        var font =
        style.getText().getFont() ? style.getText().getFont() : null;
        var text =
        typeof style.getText().getText() === 'string' ?
            style.getText().getText() : "";
        var stroke = cloneStroke(style.getText().getStroke());
        var fill = style.getText().getFill() ?
            new Fill(
                {"color" : style.getText().getFill().getColor()}) : null;

        // for our purposes and for now we are not going to set some things which
        // have sensible defaults anyhow
        newText = new Text({
            "overflow" : true,
            "font" : font,
            "text" : text,
            "stroke" : stroke,
            "fill" : fill
        });
    }

    if (newFill !== null || newStroke !== null || newText !== null)
        newStyle = new Style({
            "fill" : newFill, "stroke" : newStroke, "text" : newText});

    return newStyle;
}

/**
 * Produces a deep copy of the style stroke object handed in.
 *
 * @private
 * @static
 * @function
 * @param {ol.style.Stroke} stroke the stroke object to clone
 * @return {ol.style.Stroke|null} an open layer's stroke instance or null
 */
export const cloneStroke = function(stroke) {
    if (!(stroke instanceof Stroke)) return null;

    var strokeColor = stroke.getColor() ? stroke.getColor() : null;
    var strokeWidth = stroke.getWidth() !== null ? stroke.getWidth() : 1;
    var lineCap = stroke.getLineCap() ? stroke.getLineCap() : "butt";
    var lineDash = stroke.getLineDash() ? stroke.getLineDash() : null;
    var lineJoin = stroke.getLineJoin() ? stroke.getLineJoin() : "miter";
    var miterLimit = stroke.getMiterLimit() ? stroke.getMiterLimit() : 20;

    return new Stroke({
        "color" : strokeColor,
        "lineCap" : lineCap,
        "lineDash" : lineDash,
        "lineJoin" : lineJoin,
        "miterLimit" : miterLimit,
        "width" : strokeWidth
    });
}

/**
 * Modifies styles for a given set of features
 *
 * @static
 * @function
 * @param {Object} shape_info the shape info containing style among other things
 * @param {Regions} regions_reference a reference to the regions instance
 * @param {ol.Collection} feats a collection of features
 * @param {function=} callback a success handler
 */
export const modifyStyles =
    function(shape_info, regions_reference, feats, callback) {
        if (!(regions_reference instanceof Regions) ||
            typeof(shape_info) !== 'object') return;

        // use the selected features if no handed ins were present
        if (!(feats instanceof Collection)) {
            if (regions_reference.select_ === null) return;
            feats =  regions_reference.select_.getFeatures();
        }

        var ids = [];
        var features = feats.getArray();
        for (var i=0;i<features.length;i++) {
            var feature = features[i];

            if (feature instanceof Feature) {
                // we pick the type from the existing feature
                var type = feature['type'].toLowerCase();
                shape_info['type'] = type;
                // check for arrow markers
                if (type === 'line' || type === 'polyline') {
                    if (typeof shape_info['StrokeWidth'] === 'object' &&
                        shape_info['StrokeWidth'] !== null &&
                        typeof shape_info['StrokeWidth']['Value'] === 'number' &&
                        shape_info['StrokeWidth']['Value'] === 0)
                                shape_info['StrokeWidth']['Value'] = 1;
                    if (typeof shape_info['MarkerStart'] === 'string')
                        feature.getGeometry().has_start_arrow_ =
                            shape_info['MarkerStart'] === 'Arrow';
                    else if (typeof shape_info['MarkerStart'] === 'object' &&
                        shape_info['MarkerStart'] === null)
                        feature.getGeometry().has_start_arrow_ = false;
                    if (typeof shape_info['MarkerEnd'] === 'string')
                        feature.getGeometry().has_end_arrow_ =
                            shape_info['MarkerEnd'] === 'Arrow';
                    else if (typeof shape_info['MarkerEnd'] === 'object' &&
                        shape_info['MarkerEnd'] === null)
                        feature.getGeometry().has_end_arrow_ = false;
                }
                var newStyle = createFeatureStyle(
                    shape_info, (type === 'label'), false);
                if (newStyle === null) continue;

                var style = feature.getStyle();
                if (typeof(style) === 'function')
                    style = style(
                        regions_reference.viewer_.viewer_.getView().getResolution());
                if (isArray(style)) style = style[0];
                var newFillStyle =
                    newStyle.getFill() ? newStyle.getFill() : style.getFill();

                var newStrokeStyle = null;
                // first restore the old stroke style before selection
                if (typeof(feature['oldStrokeStyle']) === 'object' &&
                    feature['oldStrokeStyle'] !== null) {
                        newStrokeStyle = new Stroke();
                        newStrokeStyle.setColor(
                        feature['oldStrokeStyle']['color']);
                        newStrokeStyle.setWidth(
                        feature['oldStrokeStyle']['width']);
                        newStrokeStyle.setLineDash(
                        feature['oldStrokeStyle']['lineDash']);
                        newStrokeStyle.setLineCap(
                        feature['oldStrokeStyle']['lineCap']);
                        newStrokeStyle.setLineJoin(
                        feature['oldStrokeStyle']['lineJoin']);
                        newStrokeStyle.setMiterLimit(
                        feature['oldStrokeStyle']['miterLimit']);
                }
                if (newStyle.getStroke()) {
                    if (newStrokeStyle === null)
                    newStrokeStyle = new Stroke();
                    // mix in new properties
                    if (newStyle.getStroke().getColor())
                        newStrokeStyle.setColor(newStyle.getStroke().getColor());
                    if (newStyle.getStroke().getLineCap())
                        newStrokeStyle.setLineCap(newStyle.getStroke().getLineCap());
                    if (newStyle.getStroke().getLineDash())
                        newStrokeStyle.setLineDash(newStyle.getStroke().getLineDash());
                    if (newStyle.getStroke().getLineJoin())
                        newStrokeStyle.setLineJoin(newStyle.getStroke().getLineJoin());
                    if (newStyle.getStroke().getMiterLimit())
                        newStrokeStyle.setMiterLimit(newStyle.getStroke().getMiterLimit());
                    if (typeof newStyle.getStroke().getWidth() === 'number')
                        newStrokeStyle.setWidth(newStyle.getStroke().getWidth());
                }
                var newTextStyle = style.getText();
                if (newTextStyle === null &&
                    feature['oldText'] instanceof Text) {
                        var tmp = newStyle.getText();
                        if (tmp instanceof Text) {
                            if (typeof tmp.getText() === 'string')
                                feature['oldText'].text_ = tmp.getText();
                            if (typeof tmp.getFont() === 'string')
                                feature['oldText'].font_ = tmp.getFont();
                            if (newStrokeStyle)
                                feature['oldText'].fill_ = newStrokeStyle;
                        }
                } else if (newTextStyle === null)
                    newTextStyle = newStyle.getText();
                else if (newStyle.getText()) {
                    // mix in new properties
                    if (newStyle.getText().getFont())
                        newTextStyle.setFont(newStyle.getText().getFont());
                    if (newStyle.getText().getOffsetX())
                        newTextStyle.setOffsetX(newStyle.getText().getOffsetX());
                    if (newStyle.getText().getOffsetY())
                        newTextStyle.setOffsetY(newStyle.getText().getOffsetY());
                    if (newStyle.getText().getFill())
                        newTextStyle.setFill(newStyle.getText().getFill());
                    if (newStyle.getText().getRotation())
                        newTextStyle.setRotation(newStyle.getText().getRotation());
                    if (newStyle.getText().getScale())
                        newTextStyle.setScale(newStyle.getText().getScale());
                    if (newStyle.getText().getStroke())
                        newTextStyle.setStroke(newStyle.getText().getStroke());
                    if (typeof newStyle.getText().getText() === 'string')
                        newTextStyle.setText(newStyle.getText().getText());
                    if (newStyle.getText().getTextAlign())
                        newTextStyle.setTextAlign(newStyle.getText().getTextAlign());
                    if (newStyle.getText().getTextBaseline())
                        newTextStyle.setTextBaseline(newStyle.getText().getTextBaseline());
                }
                if (newTextStyle instanceof Text) {
                    newTextStyle.setOverflow(true);
                    if (typeof newTextStyle.text_ !== 'string') newTextStyle.text_ = "";
                    if (newTextStyle.fill_ === null)
                        newTextStyle.fill_ =
                            new Fill({color: newStrokeStyle.getColor()});
                }

                var newMixedStyle = new Style({
                    "fill" : newFillStyle,
                    "stroke" : newStrokeStyle,
                    "text" : newTextStyle
                });

                // reset oldStrokeStyle so that it is set with the new one
                delete feature['oldStrokeStyle'];
                feature.setStyle(newMixedStyle);
                updateStyleFunction(
                    feature, regions_reference, true);

                // add id to the list for state change
                ids.push(feature.getId());
            }
        };

        if (ids.length > 0)
            regions_reference.setProperty(
                ids, "state", REGIONS_STATE.MODIFIED, callback);
}

/**
 * Looks at the shape info and checks if, depending on the type some vital
 * information is missing so that the shape could not be constructed, in which
 * case we fill the gaps by providing sensible defaults or random gap-fillers.
 *
 * @static
 * @private
 * @param {Object} shape_info the roi shape information
 */
export const remedyShapeInfoIfNecessary =
    function(shape_info) {
        // no shape info, no good
        if (typeof(shape_info) !== 'object') return;

        if (typeof(shape_info['type']) !== 'string' ||
            shape_info['type'].length === 0) return;

        var type = shape_info['type'].toLowerCase();
        if (type === 'point') {
            if (typeof shape_info['X'] !== 'number') shape_info['X'] = 6;
            if (typeof shape_info['Y'] !== 'number') shape_info['Y'] = 6;
        } else if (type === 'line') {
            if (typeof shape_info['X1'] !== 'number') shape_info['X1'] = 2;
            if (typeof shape_info['X2'] !== 'number') shape_info['X2'] = 17;
            if (typeof shape_info['Y1'] !== 'number') shape_info['Y1'] = 2;
            if (typeof shape_info['Y2'] !== 'number') shape_info['Y2'] = 2;
        } else if (type === 'polyline') {
            if (typeof shape_info['Points'] !== 'string')
                shape_info['Points'] = "2,2 7,7 12,2 17,7";
        } else if (type === 'polygon') {
            if (typeof shape_info['Points'] !== 'string')
                shape_info['Points'] = "2,2 7,7 12,2 17,7 2,2";
        } else if (type === 'rectangle') {
            if (typeof shape_info['X']  !== 'number') shape_info['X'] = 2;
            if (typeof shape_info['Y']  !== 'number') shape_info['Y'] = 2;
            if (typeof shape_info['Width'] !== 'number')
                shape_info['Width'] = 15;
            if (typeof shape_info['Height'] !== 'number')
                shape_info['Height'] = 15;
        } else if (type === 'ellipse') {
            if (typeof shape_info['X'] !== 'number') shape_info['X'] = 20;
            if (typeof shape_info['Y'] !== 'number') shape_info['Y'] = 15;
            if (typeof shape_info['RadiusX'] !== 'number')
                shape_info['RadiusX'] = 8;
            if (typeof shape_info['RadiusY'] !== 'number')
                shape_info['RadiusY'] = 5;
        } else if (type === 'label') {
            if (typeof shape_info['FontFamily'] !== 'string')
                shape_info['FontFamily'] = "sans-serif";
            if (typeof shape_info['FontSize'] !== 'object' ||
                shape_info['FontSize'] === null ||
                typeof shape_info['FontSize']['Value'] !== 'number') {
                    shape_info['FontSize'] = {};
                    shape_info['FontSize']['Value'] = 15;
            }
            if (typeof shape_info['FontStyle'] !== 'string')
                shape_info['FontStyle'] = "normal";
            if (typeof shape_info['Text'] !== 'string')
                shape_info['Text'] = "generated";
            if (typeof shape_info['X'] !== 'number') shape_info['X'] = 10;
            if (typeof shape_info['Y']  !== 'number') shape_info['Y'] = 10;
        }
};

/**
 * Looks at the shape info and checks if there is style info there.
 * If not, we put some minimal stroke properties on the shape info or else
 * we won't see anything.
 *
 * @static
 * @private
 * @param {Object} shape_info the roi shape information
 */
export const remedyStyleIfNecessary = function(shape_info) {
    if (typeof(shape_info) !== 'object') return; // no shape info, no style

    var defaultStrokeColor = -1;
    var defaultStrokeWidth = 1;

    // at a minumum we'd like to see the outline if no style has been handed in
    var isLineGeometry =
        typeof shape_info['type'] === 'string' && shape_info['type'].indexOf(
            'line') !== -1;
    var hasStroke =
        typeof(shape_info['StrokeColor']) === 'number' &&
        !isNaN(shape_info['StrokeColor']);
    var hasFill =
        typeof(shape_info['FillColor']) === 'number' &&
        !isNaN(shape_info['FillColor']);
    if ((!hasFill && !hasStroke) || (isLineGeometry && !hasStroke)) {
            shape_info['StrokeColor'] = defaultStrokeColor;
            if (typeof shape_info['StrokeWidth'] !== 'object' ||
                shape_info['StrokeWidth'] === null ||
                typeof shape_info['StrokeWidth']['Value'] !== 'number') {
                    shape_info['StrokeWidth'] = {};
                    shape_info['StrokeWidth']['Value'] = defaultStrokeWidth;
            }
    }
};
