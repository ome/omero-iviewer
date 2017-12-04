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
import * as TextEncoding from "../../node_modules/text-encoding";
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {IMAGE_VIEWPORT_CAPTURE} from '../events/events';
import {
    CSV_LINE_BREAK, IVIEWER, INITIAL_TYPES, PROJECTION, WEBCLIENT
} from '../utils/constants';

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
         let imgConf = this.context.getSelectedImageConfig();
         if (imgConf === null) return;
         this.image_config = this.context.getSelectedImageConfig();

        // clean up old observers
        this.unregisterObservers(true);
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
         let imgInf = this.image_config.image_info;

         if (typeof imgInf.projection !== PROJECTION.NORMAL) {
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
     }

     /**
      * Creates csv file that contains area and length for selected shapes
      *
      * @memberof Header
      */
     saveRoiMeasurements() {
         let regInf = this.image_config.regions_info;
         if (regInf.selected_shapes.length === 0) return;

         // we cannot query unssaved shapes
         let ids_for_stats =
             regInf.selected_shapes.filter((s) => s.indexOf("-") == -1);
         // if we have no saved shapes or no active channels ...
         // forget about it
         if (ids_for_stats.length === 0 ||
             regInf.image_info.getActiveChannels().length === 0) {
             this.writeCsv(regInf.selected_shapes);
         } else {
             regInf.requestStats(
                 ids_for_stats, () => this.writeCsv(regInf.selected_shapes));
         }
     }

     /**
      * Generates a csv file for shapes (incl. stats) whose ids are given
      *
      * @param {Array.<string>} ids the shape ids ('roi_id:shape_id')
      * @memberof Header
      */
     writeCsv(ids) {
         if (!Misc.isArray(ids) || ids.length === 0) return;

         let regInf = this.image_config.regions_info;
         let active = regInf.image_info.getActiveChannels();
         let units = regInf.image_info.image_pixels_size.symbol_x || 'px';
         let img_id = regInf.image_info.image_id;
         let img_name = regInf.image_info.short_image_name;

         let csv =
             "image_id,image_name,roi_id,shape_id,type,z,t,channel," +
             "\"area (" + units + "\u00b2)\",\"length (" + units + ")\"," +
             "points,min,max,sum,mean,std_dev" + CSV_LINE_BREAK;

         for (let i in ids) {
             let id = ids[i];
             let shape = regInf.getShape(id);
             if (shape === null) continue;
             let roi_id = id.substring(0, id.indexOf(':'));
             let is_new = id.indexOf('-') !== -1;

             let channel = '', points = '', min = '', max = '';
             let sum = '', mean = '', stddev = '';
             let csvCommonInfo =
                 img_id + ",\"" + img_name + "\"," +
                 (is_new ? "-" : roi_id) + "," +
                 (is_new ? "-" : shape['@id']) + "," + shape.type + "," +
                 (shape.TheZ+1) + "," + (shape.TheT+1) + ",";
             let csvMeasure =
                 "," + (shape.Area < 0 ? '' : shape.Area) + "," +
                 (shape.Length < 0 ? '' : shape.Length) + ",";

             if (typeof shape.stats === 'object' &&
                 shape.stats !== null &&
                 active.length !== 0) {
                     for (let s in shape.stats) {
                         let stat = shape.stats[s];
                         if (active.indexOf(stat.index) !== -1) {
                             csv += csvCommonInfo + stat.index + csvMeasure +
                                     stat.points + "," + stat.min + "," +
                                     stat.max + "," + stat.sum + "," +
                                     stat.mean + "," + stat.std_dev +
                                     CSV_LINE_BREAK;
                         }
                     }
             } else csv += csvCommonInfo + csvMeasure + ",,,,," + CSV_LINE_BREAK;
         }

         let data = null;
         let encErr = true;
         try {
             // use windows-1252 character set to satisfy excel
             let type = 'text/csv; charset=windows-1252';
             let ansiEncoder =
                 new TextEncoding.TextEncoder(
                     'windows-1252', {NONSTANDARD_allowLegacyEncoding: true});
             encErr = false;
             data = new Blob([ansiEncoder.encode(csv)], {type: type});
         } catch(not_supported) {}

         if (data instanceof Blob)
             FileSaver.saveAs(
                 data,
                 regInf.image_info.short_image_name + "_roi_measurements.csv");
         else console.error(
                 encErr ? "Error encoding csv" : "Blob not supported");
     }

     /**
      * Sends event to captures viewport as png
      *
      * @memberof Header
      */
     captureViewport() {
         this.context.eventbus.publish(
             IMAGE_VIEWPORT_CAPTURE, {"config_id": this.image_config.id});
     }

     /**
      * Toggles MDI/single image viewing mode
      *
      * @memberof Header
      */
     toggleMDI() {
         if (this.context.useMDI)
             for (let [id, conf] of this.context.image_configs)
                 if (id !== this.context.selected_config)
                      this.context.removeImageConfig(id,conf)
         this.context.useMDI = !this.context.useMDI;
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
}
