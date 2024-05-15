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
// js
import {inject,customElement, BindingEngine} from 'aurelia-framework';
import Context from './context';
import * as FileSaver from '../../node_modules/file-saver';
import JSZip from '../../node_modules/jszip/dist/jszip';
import * as TextEncoding from "../../node_modules/text-encoding";
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import { exportViewersAsFigureJson } from '../utils/figure';
import {IMAGE_VIEWPORT_CAPTURE} from '../events/events';
import {
    APP_TITLE, CSV_LINE_BREAK, INITIAL_TYPES, IVIEWER, PROJECTION,
    WEBCLIENT, OMERO_FIGURE
} from '../utils/constants';
import { IMAGE_VIEWER_RESIZE } from '../events/events';

/**
 * @classdesc
 *
 * the app header
 */
@customElement('header')
@inject(Context, BindingEngine)
export class Header {
    /**
     * expose PROJECTION constant to template
     * @memberof Header
     * @type {Object}
     */
    PROJECTION = PROJECTION;

    /**
     * the selected image config
     * @memberof Header
     * @type {ImageConfig}
     */
    image_config = null;

    /**
     * flag that indicates whether we have any modified image settings
     * @see {@link checkIfAnyImageSettingsHasBeenModified} to set flag
     * @memberof Header
     * @type {boolean}
     */
    hasModifiedImageSettings = false;

    /**
     * observer watching for changes in the selected image
     * @memberof Header
     * @type {Object}
     */
    image_config_observer = null;

    /**
     * the other property observers
     * @memberof Header
     * @type {Array.<Object>}
     */
    observers = [];

    /**
     * the webclient url (pre-fixed)
     * @memberof Header
     * @type {string}
     */
    webclient_link = null;

    /**
     * flag whether the delete option should be shown/enabled
     * @memberof Header
     * @type {boolean}
     */
    selected_can_delete = true;

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Header
     */
    attached() {
        $('.fixed-header .dropdown').on(
            'show.bs.dropdown', () =>
                this.checkIfAnyImageSettingsHasBeenModified());
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof Header
     */
    detached() {
        $('.fixed-header .dropdown').off();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Header
     */
    bind() {
        // initial image config
        this.onImageConfigChange();
        // register observer for selected image configs and event subscriptions
        this.image_config_observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config').subscribe(
                    (newValue, oldValue) => this.onImageConfigChange());
    }

    /**
     * @constructor
     * @param {Context} context the application context
     * @param {BindingEngine} bindingEngine the BindingEngine (injected)
     */
    constructor(context, bindingEngine) {
        this.context = context;
        this.bindingEngine = bindingEngine;
        this.webclient_link = this.context.getPrefixedURI(WEBCLIENT);
    }

    /**
     * Handles changes of the selected image config
     *
     * @memberof Header
     */
    onImageConfigChange() {
        this.image_config = this.context.getSelectedImageConfig();

        // clean up old observers
        this.unregisterObservers(true);

        if (this.image_config === null) {
            document.title = APP_TITLE;
            return;
        }

        // adjust tab title
        let title = APP_TITLE;
        if (this.image_config.image_info.short_image_name !== '')
            title = this.image_config.image_info.short_image_name;
        document.title = title;

        // listen for region ready to start region selection observer
        this.observers.push(
            this.bindingEngine.propertyObserver(
                this.image_config.regions_info, 'ready').subscribe(
                    (newValue, oldValue) => this.listenToRegionsSelections()));
    }

    /**
     * Listens to regions selection changes
     *
     * @memberof Header
     */
    listenToRegionsSelections() {
        this.observers.push(
            this.bindingEngine.collectionObserver(
                this.image_config.regions_info.selected_shapes).subscribe(
                    (newValue, oldValue) => {
                        let numberOfshapesSelected =
                            this.image_config.regions_info.selected_shapes.length;
                        if (numberOfshapesSelected === 0) return;
                        let lastSelected =
                            this.image_config.regions_info.getLastSelectedShape("canDelete");
                        this.selected_can_delete =
                            this.image_config.regions_info.checkShapeForPermission(
                                lastSelected, "canDelete");
                }));
     }

    /**
     * Shows about modal with version info
     *
     * @memberof Header
     */
    showAbout() {
        let modal = $('.modal-about');
        if (modal.length === 0) return;
        modal.modal();
    }

    /**
     * Creates new image on server using projection settings
     *
     * @memberof Header
     */
    saveProjectedImage() {
        if (this.image_config === null ||
            this.image_config.image_info.projection === PROJECTION.NORMAL) return;

        let imgInf = this.image_config.image_info;
        let url =
            this.context.server + this.context.getPrefixedURI(IVIEWER) +
            '/save_projection/?image=' + imgInf.image_id +
            "&projection=" + imgInf.projection +
            "&start=" + imgInf.projection_opts.start +
            "&end=" + imgInf.projection_opts.end;
        if (this.context.initial_type !== INITIAL_TYPES.WELL &&
             typeof imgInf.parent_id === 'number')
                 url += "&dataset=" + imgInf.parent_id;

        $.ajax({
            url: url,
            success: (resp) => {
                let msg = "";
                if (typeof resp.id === 'number') {
                    let linkWebclient = this.context.server +
                        this.context.getPrefixedURI(WEBCLIENT) +
                        "/?show=image-" + resp.id;
                    let linkIviewer = this.context.server +
                        this.context.getPrefixedURI(IVIEWER) +
                        "/?images=" + resp.id;
                    if (this.context.initial_type !== INITIAL_TYPES.WELL &&
                        typeof imgInf.parent_id === 'number')
                            linkIviewer += "&dataset=" + imgInf.parent_id;
                msg =
                    "<a href='" + linkWebclient + "' target='_blank'>" +
                    "Navigate to Image in Webclient</a><br>" +
                    "<br><a href='" + linkIviewer + "' target='_blank'>" +
                    "Open Image in iviewer</a>";
                } else {
                    msg = "Failed to create projected image";
                    if (typeof resp.error === 'string')
                        console.error(resp.error);
                }
                Ui.showModalMessage(msg, 'Close');
            }
        });
    }

    /**
     * Delegates copyShapes
     *
     * @memberof Header
     */
    copyShapes() {
        if (this.image_config === null) return;
        this.image_config.regions_info.copyShapes();
     }

    /**
     * Delegates pasteShapes
     *
     * @memberof Header
     */
    pasteShapes() {
        if (this.image_config === null) return;
        this.image_config.regions_info.pasteShapes();
    }

    /**
     * Delegates deleteShapes
     *
     * @memberof Header
     */
    deleteShapes() {
        if (this.image_config === null) return;
        this.image_config.regions_info.deleteShapes();
    }

    /**
     * Creates csv file that contains area and length for selected shapes
     *
     * @param {boolean} utf if false we use excel's char set, otherwise utf
     * @memberof Header
     */
    saveRoiMeasurements(utf=false) {
        if (this.image_config === null ||
            this.image_config.regions_info.selected_shapes.length === 0) return;

        let regInf = this.image_config.regions_info;
        // we cannot query unssaved shapes
        let ids_for_stats =
            regInf.selected_shapes.filter((s) => s.indexOf("-") == -1);
        // if we have no saved shapes or no active channels ...
        // forget about it
        if (this.image_config.image_info.tiled || ids_for_stats.length === 0 ||
            regInf.image_info.getActiveChannels().length === 0) {
            this.writeCsv(regInf.selected_shapes, utf);
        } else {
            regInf.requestStats(
                ids_for_stats, () => this.writeCsv(regInf.selected_shapes, utf));
        }
    }

    /**
     * Generates a csv file for shapes (incl. stats) whose ids are given
     *
     * @param {Array.<string>} ids the shape ids ('roi_id:shape_id')
     * @param {boolean} utf if false we use excel's char set, otherwise utf
     * @memberof Header
     */
    writeCsv(ids, utf=false) {
        if (!Misc.isArray(ids) || ids.length === 0) return;

        let regInf = this.image_config.regions_info;
        let active = regInf.image_info.getActiveChannels();
        let units = regInf.image_info.image_pixels_size.symbol_x || 'px';
        let img_id = regInf.image_info.image_id;
        let img_name = regInf.image_info.short_image_name;
        let channels = regInf.image_info.channels;
        let header = [
            'image_id', 'image_name', 'roi_id', 'shape_id', 'type','z', 't',
            'channel', 'area (' + units + '\u00b2)', 'length (' + units + ')',
            'points', 'min', 'max', 'sum', 'mean', 'std_dev'
        ]

        // Find which of these columns we need for the shape types we have...
        let coordHeaders = ["X", "Y", "Width", "Height", "RadiusX", "RadiusY",
                            "X1", "Y1", "X2", "Y2", "Points"];
        let coordAttrs = {
            "polygon": ["Points"],
            "polyline": ["Points"],
            "line": ["X1", "Y1", "X2", "Y2"],
            "rectangle": ["X", "Y", "Width", "Height"],
            "ellipse": ["X", "Y", "RadiusX", "RadiusY"],
            "label": ["X", "Y"],
            "point": ["X", "Y"],
        }
        let shapeAttrs = ids.map(id => regInf.getShape(id).type)
                        .reduce((prev, shapeType) => {
                            if (coordAttrs[shapeType]) {
                                coordAttrs[shapeType].forEach(t => prev[t] = true);
                            }
                            return prev;
                        }, {});
        coordHeaders = coordHeaders.filter(attr => shapeAttrs[attr]);

        // Export Comment / Text for all shapes
        coordHeaders.unshift("Text");
        // Add coords to other column names
        header = header.concat(coordHeaders);

        // Start csv text with column headers...
        let csv = header.map(h => Misc.quoteCsvCellValue(h)).join(",");
        csv += CSV_LINE_BREAK;

        // add rows...
        for (let i=0; i<ids.length; i++) {
            let id = ids[i];
            let shape = regInf.getShape(id);
            if (shape === null) continue;
            let roi_id = id.substring(0, id.indexOf(':'));
            let is_new = id.indexOf('-') !== -1;

            let csvCommonInfo = img_id + "," +
                Misc.quoteCsvCellValue(img_name) + "," +
                (is_new ? "-" : roi_id) + "," +
                (is_new ? "-" : shape['@id']) + "," +
                Misc.quoteCsvCellValue(shape.type) + "," +
                (shape.TheZ === -1 ? "" : (shape.TheZ+1)) + "," +
                (shape.TheT === -1 ? "" : (shape.TheT+1)) + ",";
            let csvMeasure = "," +
                (shape.Area < 0 ? '' : shape.Area) + "," +
                (shape.Length < 0 ? '' : shape.Length) + ",";
            // Quote to escape commas in Points string
            let csvCoords = coordHeaders.map(attr => shape[attr] != undefined ? `"${ shape[attr] }"` : '').join(",");
            let emptyRow = ",,,,,";
            if (typeof shape.stats === 'object' &&
                shape.stats !== null &&
                active.length !== 0) {
                    for (let s in shape.stats) {
                        let stat = shape.stats[s];
                        if (active.indexOf(stat.index) !== -1) {
                            if (stat.points === 0) {
                                csv += csvCommonInfo + "," + emptyRow + CSV_LINE_BREAK;
                                break;
                            }
                            csv += csvCommonInfo +
                                Misc.quoteCsvCellValue(channels[stat.index].label) +
                                csvMeasure +
                                stat.points + "," + stat.min + "," +
                                stat.max + "," + stat.sum + "," +
                                stat.mean + "," + stat.std_dev +
                                "," + csvCoords +
                                CSV_LINE_BREAK;
                         }
                     }
            } else {
                csv += csvCommonInfo + csvMeasure + emptyRow +
                        "," + csvCoords + CSV_LINE_BREAK;
            }
        }
        let data = null;
        let encErr = true;
        try {
            // use windows-1252 character set to satisfy excel (if not UTF)
            let charSet = utf ? 'utf-8' : 'windows-1252';
            let type = 'text/csv; charset=' + charSet;
            let ansiEncoder =
                new TextEncoding.TextEncoder(
                    charSet, {NONSTANDARD_allowLegacyEncoding: !utf});
            encErr = false;
            data = new Blob([ansiEncoder.encode(csv)], {type: type});
        } catch(not_supported) {}

        if (data instanceof Blob)
            FileSaver.saveAs(
                data,
                regInf.image_info.short_image_name + "_roi_measurements.csv",
                true);
        else console.error(
                encErr ? "Error encoding csv" : "Blob not supported");
     }

    /**
     * Sends event to captures viewport as png
     *
     * @memberof Header
     */
    captureViewport() {
        if (this.image_config === null) return;
        let params = {}
        let configCount = this.context.image_configs.size;
        if (configCount > 1) {
            params.all_configs = true;
            params.count = configCount;
            params.zip = new JSZip();
        } else params.config_id = this.image_config.id;
        this.context.eventbus.publish(IMAGE_VIEWPORT_CAPTURE, params);
    }

    /**
     * Returns the keyboard command prefix based on navigator.platform
     * i.e. '&#x2318;' for apple, 'ctrl+' otherwise
     *
     * @return {string}
     * @memberof Header
     */
    getKeyboardShortCutPrefix() {
        if (Misc.isApple()) return '\u2318';
        return 'Ctrl+'
    }

    /**
     * Unregisters the the observers (property and regions info ready)
     *
     * @param {boolean} property_only true if only property observers are cleaned up
     * @memberof Header
     */
    unregisterObservers(property_only = false) {
        this.observers.map((o) => {if (o) o.dispose();});
        this.observers = [];
        if (property_only) return;
        if (this.image_config_observer) {
            this.image_config_observer.dispose();
            this.image_config_observer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Header
     */
    unbind() {
        this.unregisterObserver();
    }

    /**
     * Runs over open image configs to check if they have been modified
     *
     * @memberof Header
     */
    checkIfAnyImageSettingsHasBeenModified() {
        for (let [id, conf] of this.context.image_configs) {
            if (conf.image_info.can_annotate && conf.canUndo()) {
                this.hasModifiedImageSettings = true;
                return;
            }
        }
        this.hasModifiedImageSettings = false;
    }

    /**
     * Attempts to save the image settings for all open image configs.
     * If we have edited an image twice but separately display a warning
     *
     * @return {Array.<string>} a list of images that couldn't be saved
     * @memberof Context
     */
    saveAllImageSettings() {
        let conflictingImageChanges = this.context.saveAllImageSettings();
        let len = conflictingImageChanges.length;
        if (len > 0) {
            let msg = "The following image" + (len > 1 ? "s were" : " was") +
                " not saved (multiple/conflicting edits):" +
                "<ul class='skipped-list-files'>";
            for (let i in conflictingImageChanges)
                msg += "<li>" + conflictingImageChanges[i] + "</li>";
            msg += "</ul>";

            Ui.showModalMessage(msg, 'Close');
        }
    }

    /**
     * Check if OMERO.figure is installed
     *
     * @return {Boolean}
     * @memberof Header
     */
    omeroFigureIsInstalled() {
        return Boolean(this.context.getPrefixedURI(OMERO_FIGURE));
    }

    /**
     * Save the current layout of viewers as an OMERO.figure file
     *
     * @memberof Header
     */
    saveAsFigure() {
        let figureUrl = this.context.server + this.context.getPrefixedURI(OMERO_FIGURE);
        if (!figureUrl) {
            console.log("OMERO_FIGURE url not found. OMERO.figure not installed.");
            return;
        }

        const figureName = prompt("Enter Figure name");
        if (!figureName) {
            return;
        }

        let figureJSON = exportViewersAsFigureJson(figureName);
        let figureJSONstr = JSON.stringify(figureJSON);

        // Save
        $.post(figureUrl + "/save_web_figure/", {figureJSON: figureJSONstr})
            .done(function( data ) {
                // let fileId = +data;
                let html = `Figure created: ID ${data}.<br>
                    <a target="_blank" href="${figureUrl}/file/${data}/">Open in new tab</a>.`;

                Ui.showModalMessage(html, "OK");
            });
    }
}
