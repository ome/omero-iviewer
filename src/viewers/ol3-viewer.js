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

// dependencies
import Context from '../app/context';
import Misc from '../utils/misc';
import {Converters} from '../utils/converters';
import Ui from '../utils/ui';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {ol3} from '../../libs/ol3-viewer.js';
import Ol3ViewerLinkedEvents from './ol3-viewer-linked-events';
import * as FileSaver from '../../node_modules/file-saver';
import {draggable} from 'jquery-ui/ui/widgets/draggable';
import {resizable} from 'jquery-ui/ui/widgets/resizable';
import {
    IMAGE_CONFIG_RELOAD, IVIEWER, PLUGIN_PREFIX, PROJECTION,
    REGIONS_DRAWING_MODE, RENDER_STATUS, VIEWER_ELEMENT_PREFIX, WEBCLIENT
} from '../utils/constants';
import {
    IMAGE_CANVAS_DATA, IMAGE_DIMENSION_CHANGE, IMAGE_DIMENSION_PLAY,
    IMAGE_INTENSITY_QUERYING, IMAGE_SETTINGS_CHANGE,
    IMAGE_VIEWER_CONTROLS_VISIBILITY, IMAGE_VIEWER_INTERACTION,
    IMAGE_VIEWER_RESIZE, IMAGE_VIEWER_SPLIT_VIEW, IMAGE_VIEWPORT_CAPTURE,
    REGIONS_CHANGE_MODES, REGIONS_COPY_SHAPES, REGIONS_DRAW_SHAPE,
    REGIONS_GENERATE_SHAPES, REGIONS_HISTORY_ACTION, REGIONS_HISTORY_ENTRY,
    REGIONS_MODIFY_SHAPES, REGIONS_PROPERTY_CHANGED, REGIONS_SET_PROPERTY,
    REGIONS_SHOW_COMMENTS, REGIONS_STORED_SHAPES, REGIONS_STORE_SHAPES,
    VIEWER_IMAGE_SETTINGS, VIEWER_SET_SYNC_GROUP, EventSubscriber
} from '../events/events';


/**
 * The openlayers 3 viewer wrapped for better aurelia integration
 * @extends {EventSubscriber}
 */
@customElement('ol3-viewer')
@inject(Context, Element, BindingEngine)
export default class Ol3Viewer extends EventSubscriber {
    /**
     * handles mdi group syncing
     * @memberof Ol3Viewer
     * @type {Ol3ViewerLinkedEvents}
     */
     linked_events = new Ol3ViewerLinkedEvents(this);

    /**
     * the image config reference to work with (bound via template)
     * @memberof Ol3Viewer
     * @type {ImageConfig}
     */
    @bindable image_config = null;

    /**
     * the image info ready observers
     * @memberof Ol3Viewer
     * @type {Object}
     */
    image_info_ready_observer = null;

    /**
     * watches for selection changes
     * @memberof Ol3Viewer
     * @type {Object}
     */
    image_config_selection_observer = null;

    /**
     * the internal instance of the ol3.Viewer
     * @memberof Ol3Viewer
     * @type {ol3.Viewer}
     */
    viewer = null;

    /**
     * the info needed for the play loop
     * @memberof Ol3Viewer
     * @type {number}
     */
    player_info = {dim: null, forwards: null, handle: null};

    /**
     * events we subscribe to
     * @memberof Ol3Viewer
     * @type {Array.<string,function>}
     */
    sub_list = [
        [IMAGE_VIEWER_INTERACTION,
            (params={}) => this.syncView(params)],
        [IMAGE_VIEWER_CONTROLS_VISIBILITY,
            (params={}) => this.toggleControlsVisibility(params)],
        [IMAGE_VIEWER_RESIZE,
            (params={}) => this.resizeViewer(params)],
        [IMAGE_DIMENSION_CHANGE,
            (params={}) => this.changeDimension(params)],
        [IMAGE_DIMENSION_PLAY,
            (params={}) => this.playDimension(params)],
        [IMAGE_SETTINGS_CHANGE,
            (params={}) => this.changeImageSettings(params)],
        [REGIONS_PROPERTY_CHANGED,
            (params={}) => this.getRegionsPropertyChange(params)],
        [REGIONS_SET_PROPERTY,
            (params={}) => this.setRegionsProperty(params)],
        [IMAGE_INTENSITY_QUERYING,
            (params={}) => this.toggleIntensityQuerying(params)],
        [VIEWER_IMAGE_SETTINGS,
            (params={}) => this.getImageSettings(params)],
        [IMAGE_VIEWER_SPLIT_VIEW,
            (params={}) => this.toggleSplitChannels(params)],
        [REGIONS_CHANGE_MODES,
            (params={}) => this.changeRegionsModes(params)],
        [REGIONS_DRAW_SHAPE,
            (params={}) => this.drawShape(params)],
        [REGIONS_GENERATE_SHAPES,
            (params={}) => this.generateShapes(params)],
        [REGIONS_STORE_SHAPES,
            (params={}) => this.storeShapes(params)],
        [REGIONS_STORED_SHAPES,
            (params={}) => this.afterShapeStorage(params)],
        [REGIONS_MODIFY_SHAPES,
            (params={}) => this.modifyShapes(params)],
        [REGIONS_HISTORY_ENTRY,
            (params={}) => this.addHistoryEntry(params)],
        [REGIONS_HISTORY_ACTION,
            (params={}) => this.affectHistoryAction(params)],
        [REGIONS_COPY_SHAPES,
            (params={}) => this.copyShapeDefinitions(params)],
        [REGIONS_SHOW_COMMENTS,
            (params={}) => this.showComments(params)],
        [IMAGE_VIEWPORT_CAPTURE,
            (params={}) => this.captureViewport(params)],
        [IMAGE_CANVAS_DATA,
            (params={}) => this.saveCanvasData(params)],
        [VIEWER_SET_SYNC_GROUP,
            (params={}) => this.setSyncGroup(params)]];

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     * @param {Element} element the associated dom element (injected)
     * @param {BindingEngine} bindingEngine injected instance of BindingEngine
     */
    constructor(context, element, bindingEngine) {
        super(context.eventbus)
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Returns the viewer's container element
     *
     * @return {Object} the viewer's html container(jquery)
     * @memberof Ol3Viewer
     */
    getContainer() {
        return $(this.element).parent();
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Ol3Viewer
     */
    attached() {
        let container = this.getContainer();
        // additions that are necessary for mdi
        // we need the viewers to be draggable, resizable
        // also place the viewer within the frame boundaries
        let frame = $('.frame');
        let minX = frame.position().left+10;
        let maxX =
            frame.position().left+frame.width()-
                parseInt(this.image_config.size.width);
        let minY = frame.position().top+10;
        let maxY =
            frame.position().top+frame.height()-
                parseInt(this.image_config.size.height);
        this.image_config.position.top =
            Misc.getRandomInteger(minY,maxY) + 'px';
        this.image_config.position.left =
            Misc.getRandomInteger(minX,maxX) + 'px';
        container.draggable({
            handle: '.viewer-handle',
            stop: (event, ui) => {
                this.image_config.position.top = ui.position.top + 'px';
                this.image_config.position.left = ui.position.left + 'px';
            }
        });
        container.resizable({
            containment: "parent", handles: 'se',
            stop: (e, ui) => {
                this.image_config.size.width = ui.size.width + 'px';
                this.image_config.size.height = ui.size.height + 'px';
                this.resizeViewer();
            }
        });
        this.createObservers();
    }

    /**
     * Creates Observers (used internally)
     *
     * @private
     * @memberof Ol3Viewer
     */
    createObservers() {
        let imageDataReady = () => {
            // refresh image settings only
            if (this.image_config.image_info.refresh) {
                this.viewer.changeImageModel(
                    this.image_config.image_info.model);
                let channels = this.image_config.image_info.channels;
                let updates = [];
                for (let i=0;i<channels.length;i++) {
                    let chan = channels[i];
                    let chanUpdate = {
                        index: i,
                        active: chan.active,
                        start: chan.window.start,
                        end: chan.window.end,
                        color: chan.color,
                        inverted: chan.inverted
                    };
                    updates.push(chanUpdate);
                };
                this.viewer.changeChannelRange(updates);
                return;
            }

            // create viewer instance, register event subscriptions
            this.initViewer();
            this.subscribe();
            // listen to when the regions info data is ready
            this.regions_info_ready_observer =
                this.bindingEngine.propertyObserver(
                    this.image_config.regions_info, 'ready').subscribe(
                        (newValue, oldValue) => {
                            if (this.viewer === null) return;
                            this.viewer.removeRegions();
                            if (newValue) this.initRegions();
                    });
            // mdi needs to switch image config when using controls
            this.getContainer().find('.ol-control').on(
                'mousedown',
                () => this.context.selectConfig(this.image_config.id))
        };
        // listen via the observer for image ready changes
        this.image_info_ready_observer =
            this.bindingEngine.propertyObserver(
                this.image_config.image_info, 'ready').subscribe(
                    (newValue, oldValue) => {
                        if (!oldValue && newValue) imageDataReady();
                    });
        // listens to image config changes for mdi
        this.image_config_selection_observer =
            this.bindingEngine.propertyObserver(
                this.context, 'selected_config').subscribe(
                    (newValue, oldValue) => {
                        this.resizeViewer({config_id: newValue, delay: 200});
                        if (!this.context.useMDI ||
                            oldValue !== this.image_config.id ||
                            !this.image_config.regions_info.hasBeenModified()) {
                                return;
                            }

                        let sameImageConfs =
                            this.context.getImageConfigsForGivenImage(
                                this.image_config.image_info.image_id,
                                this.image_config.id);
                        if (sameImageConfs.length === 0) return;

                        // we have another image config for the same image
                        // let's prompt the user with a warning about rois
                        Ui.showConfirmationDialog(
                            'Save ROIS?',
                            'You have changed ROI(S) on an image ' +
                            'that\'s been opened multiple times.<br>' +
                            'Do you want to save now to avoid ' +
                            'inconsistence (and a potential loss ' +
                            'of some of your changes)?' ,
                            () => this.storeShapes(
                                {"config_id": this.image_config.id}));
                });
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof Ol3Viewer
     */
    bind() {
        // we 'tag' the element to belong to a certain image config
        this.element.parentNode.id = this.image_config.id;
        // define the container element
        this.container = VIEWER_ELEMENT_PREFIX + this.image_config.id;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is unmounted
     *
     * @memberof Ol3Viewer
     */
    detached() {
        if (this.context.useMDI) {
            let container = this.getContainer();
            container.find('.ol-control').off('mousedown');
            try {container.draggable("destroy")} catch(ignored) {}
            try {container.resizable("destroy")} catch(ignored) {}
        }
        if (this.viewer) {
            this.viewer.destroyViewer();
            this.viewer = null;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof Ol3Viewer
     */
    unbind() {
        if (this.image_config_selection_observer) {
            this.image_config_selection_observer.dispose();
            this.image_config_selection_observer = null;
        }
        if (this.image_info_ready_observer) {
            this.image_info_ready_observer.dispose();
            this.image_info_ready_observer = null;
        }
        if (this.regions_info_ready_observer) {
            this.regions_info_ready_observer.dispose();
            this.regions_info_ready_observer = null;
        }
        this.unsubscribe();
        this.viewer = null;
        this.image_config = null;
    }

    /**
     * Instantiates a new ol3 viewer once image data is ready
     *
     * @memberof Ol3Viewer
     */
    initViewer() {
        // tweak initParams for ol3viewer to reflect iviewer app name
        let ol3initParams = Object.assign({}, this.context.initParams);
        ol3initParams[PLUGIN_PREFIX] = this.context.getPrefixedURI(IVIEWER);

        // create viewer instance
        this.viewer =
            new ol3.Viewer(
                this.image_config.image_info.image_id, {
                     eventbus : this.context.eventbus,
                     server : this.context.server,
                     data: this.image_config.image_info.tmp_data,
                     initParams :  ol3initParams,
                     container: this.container
                 });
        delete this.image_config.image_info.tmp_data;

        // hide controls for mdi when more than 1 image configs
        if (this.context.useMDI && this.context.image_configs.size > 1)
            this.toggleControlsVisibility({
                config_id: this.image_config.id, flag: false
            });
        // only the first request should be affected
        this.context.resetInitParams();
        // use existing interpolation setting
        this.viewer.enableSmoothing(this.context.interpolate);
        // initialize regions if rois tab active
        if (this.context.isRoisTabActive()) this.initRegions();
        this.resizeViewer({window_resize: true, delay: 100});
    }

    /**
     * Handles dimension changes which come in the form of an event notification
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    changeDimension(params = {}) {
        // we ignore notifications that don't concern us
        // and need a dim identifier as well an array value
        if (this.viewer === null ||
            typeof params.dim !== 'string' ||
            !Misc.isArray(params.value) ||
            params.value.length === 0) return;

        if (params.config_id === this.image_config.id)
            this.viewer.setDimensionIndex(params.dim, params.value);
        else this.linked_events.syncAction(params, "setDimensionIndex");
    }

    /**
     * Handles the following image changes:
     * - channel range (start, end, color)
     * - color/grayscale
     * - projection
     * - interpolation
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    changeImageSettings(params = {}) {
        if (this.viewer === null) return;

        let isSameConfig = params.config_id === this.image_config.id;
        if (typeof params.model === 'string') {
            if (isSameConfig) this.viewer.changeImageModel(params.model);
            else this.linked_events.syncAction(params, "changeImageSettings");
        } else if (isSameConfig && typeof params.projection === 'string')
            this.viewer.changeImageProjection(
                params.projection,
                this.image_config.image_info.projection_opts);
        else if (Misc.isArray(params.ranges) && params.ranges.length > 0) {
            if (isSameConfig) this.viewer.changeChannelRange(params.ranges);
            else this.linked_events.syncAction(params, "changeImageSettings");
        } else if (typeof params.interpolate === 'boolean')
            this.viewer.enableSmoothing(params.interpolate);
    }

    /**
     * In case of a resize we are forced to issue a redraw for the ol3 Viewer
     * which is especially important for the regions layer
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    resizeViewer(params={}) {
        if (this.viewer === null ||
            (typeof params.config === 'number' &&
                !isNaN(params.config_id) && params.config !== -1 &&
                params.config_id !== this.image_config.id)) return;

        // while dragging does not concern us
        if (typeof params.is_dragging !== 'boolean') params.is_dragging = false;
        if (params.is_dragging) return;

        // check if we are way to small, then we collapse...
        if (typeof params.window_resize === 'boolean' && params.window_resize)
            Ui.adjustSideBarsOnWindowResize();

        this.viewer.redraw(params.delay);
    }

    /**
     * Handles regions property changes received from the ol3 viewer,e.g.
     * selection, modification, deletetion
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
     getRegionsPropertyChange(params = {}) {
         // the shapes has to be an array.
         // if the properties and values are an array they have to be in a 1:1
         // relationship to the shapes, otherwise they have to be a simple string
         // or at least not undefined in which case one property/value respectively
         // belongs to multiple shapes
         if (typeof params !== 'object' ||
             params.config_id !== this.image_config.id ||
             !Misc.isArray(params.shapes) || params.shapes.length === 0 ||
             (!Misc.isArray(params.properties) &&
                typeof params.properties !== 'string') ||
             (Misc.isArray(params.properties) &&
                params.properties.length !== params.shapes.length) ||
             (!Misc.isArray(params.values) &&
                typeof params.values === 'undefined') ||
             (Misc.isArray(params.values) &&
                params.values.length !== params.shapes.length)) return;

            // loop over all shapes, trying to set the property
            for (let i in params.shapes) {
                let shape = params.shapes[i];
                let refOrCopy =
                    this.image_config.regions_info.data ?
                        this.image_config.regions_info.getShape(shape) : null;
                let hasBeenModified = refOrCopy ? refOrCopy.modified : null;
                let prop = Misc.isArray(params.properties) ?
                                params.properties[i] : params.properties;
                let value = Misc.isArray(params.values) ?
                                params.values[i] : params.values;
                if (prop === 'selected' || prop === 'modified' ||
                        prop === 'deleted' || prop === 'visible')
                    this.image_config.regions_info.setPropertyForShape(
                        shape, prop, value);
                // in the case of new shapes that get deleted we will need
                // a deep copy since they get removed from the map
                if (refOrCopy && prop === 'deleted')
                    refOrCopy = Object.assign({}, refOrCopy);
                if (typeof params.callback === 'function')
                    params.callback(refOrCopy, hasBeenModified);
                // update measurement info (if shape was modified)
                if (prop === 'modified') {
                    let measurements =
                        this.viewer.getLengthAndAreaForShapes([shape], true);
                    if (Misc.isArray(measurements) &&
                        measurements.length > 0 &&
                        measurements[0].id === shape) {
                            refOrCopy.Area = measurements[0].Area;
                            refOrCopy.Length = measurements[0].Length;
                    }
                }
            }
     }

    /**
     * Handles regions property changes such as visibility and selection
     * by delegation to sub handlers
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
     setRegionsProperty(params = {}) {
         // at a minimum we need a viewer and params with a property
         if (this.viewer === null ||
             typeof params !== 'object' ||
             typeof params.property !== 'string'||
             params.config_id !== this.image_config.id) return

        // delegate to individual handler
        let prop = params.property.toLowerCase();
        if (prop === 'visible')
            this.viewer.setRegionsVisibility(params.value, params.shapes);
        else if (prop === 'selected')
            this.changeShapeSelection(params);
        else if (prop === 'state')
            this.deleteShapes(params);
     }

     /**
      * Generates shape for both, pasting and propagation
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      generateShapes(params = {}) {
          //we want only notifications that concern us
          // and need at least a viewer one shape definition in an array
          if (params.config_id !== this.image_config.id ||
              this.viewer === null ||
              !Misc.isArray(params.shapes) ||
              params.shapes.length === 0) return;

          if (typeof params.number !== 'number') params.number = 1;
          if (typeof params.roi_id !== 'number')
              params.roi_id = this.image_config.regions_info.getNewRegionsId();
          let theDims =
            Misc.isArray(params.theDims) && params.theDims.length !== 0 ?
                params.theDims : null;

          params.shapes.map((def) => {
              try {
                  if (!def.deleted) {
                      let deepCopy = Object.assign({},def);
                      // we are modified so let's update the definition
                      // before we generate from it
                      if (deepCopy.modified) {
                          let upToDateDef =
                            this.viewer.getShapeDefinition(deepCopy.shape_id);
                          if (upToDateDef)
                            deepCopy =
                                Converters.amendShapeDefinition(upToDateDef);
                      }
                      delete deepCopy['shape_id'];
                      if (typeof params.paste === 'boolean' && params.paste)
                        deepCopy['roi_id'] =
                            this.image_config.regions_info.getNewRegionsId();
                      else deepCopy['roi_id'] = params.roi_id;
                      let opts = {
                          'number': params.number,
                          'position': params.position,
                          'extent': this.viewer.getSmallestViewExtent(),
                          'theDims': theDims
                      };
                      if (typeof params.scale_factor === 'number')
                          opts['scale_factor'] = params.scale_factor;
                      if (typeof params.add_history === 'boolean')
                          opts['add_history'] = params.add_history;
                      if (typeof params.hist_id === 'number')
                          opts['hist_id'] = params.hist_id;
                      this.viewer.generateShapes(deepCopy, opts);
                };
              } catch(ignored) {}
          });
      }

     /**
      * Changes the deleted state of shapes
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      deleteShapes(params = {}) {
          //we want only notifications that concern us
          // and need at least a viewer instance and
          //one shape id in the array as well as a value
          // for the action, either delete or undo
          if (params.config_id !== this.image_config.id ||
              this.viewer === null ||
              typeof params.value !== 'string' ||
              !Misc.isArray(params.shapes) || params.shapes.length === 0) return;

          if (params.value === 'delete')
             this.viewer.deleteShapes(params.shapes, false, params.callback);
          else if (params.value === 'undo')
            this.viewer.deleteShapes(params.shapes, true);
      }

     /**
      * Changes the selected state of shapes
      * by delegation to sub handlers
      *
      * @param {Object} params the event notification parameters
      * @memberof Ol3Viewer
      */
      changeShapeSelection(params = {}) {
          //we want only notifications that concern us
          // and need at least a viewer instance and one shape id in the array
          if (params.config_id !== this.image_config.id ||
              this.viewer === null ||
              !Misc.isArray(params.shapes) ||
              params.shapes.length === 0) return;

        let delay = 0;
        if (params.clear) {
            // switch to plane/time where the shape is
            let viewerT = this.viewer.getDimensionIndex('t');
            let viewerZ = this.viewer.getDimensionIndex('z');
            let shape =
                this.image_config.regions_info.getShape(params.shapes[0]);
            let shapeT = typeof shape.TheT === 'number' ? shape.TheT : -1;
            if (shapeT !== -1 && shapeT !== viewerT) {
                this.image_config.image_info.dimensions.t = shapeT;
                delay += 25;
            }
            let shapeZ = typeof shape.TheZ === 'number' ? shape.TheZ : -1;
            if (shapeZ !== -1 && shapeZ !== viewerZ) {
                this.image_config.image_info.dimensions.z = shapeZ;
                delay += 25;
            }
        }

        setTimeout(() => {
            this.abortDrawing();
            this.viewer.selectShapes(
                params.shapes, params.value,
                params.clear, params.center);
        }, delay);
      }

    /**
     * Queries the present image settings of the viewer
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
    getImageSettings(params = {}) {
        // we ignore notifications that don't concern us
        if (params.config_id !== this.image_config.id ||
            this.viewer === null ||
            typeof params.callback !== 'function') return;

        params.callback(this.viewer.captureViewParameters());
        this.viewer.redraw();
    }

    /**
     * Changes the regions modes
     *
     * @param {Object} params the event notification parameters
     * @memberof Ol3Viewer
     */
    changeRegionsModes(params={}) {
        // we don't do this if it does not concern us
        // or we don't have the right params
        if (params.config_id !== this.image_config.id ||
                this.viewer === null ||
                typeof params !== 'object' ||
                !Misc.isArray(params.modes)) return;

        this.image_config.regions_info.regions_modes =
            this.viewer.setRegionsModes(params.modes);

    }

    /**
     * Initializes the ol3 regions layer
     *
     * @memberof Ol3Viewer
     */
    initRegions() {
        if (this.viewer === null ||
            this.image_config === null ||
            this.image_config.regions_info === null ||
            !this.image_config.regions_info.ready ||
            !Misc.isArray(this.image_config.regions_info.tmp_data)) return;

        this.viewer.addRegions(this.image_config.regions_info.tmp_data);
        delete this.image_config.regions_info.tmp_data;
        this.changeRegionsModes(
            { modes: this.image_config.regions_info.regions_modes});
        this.viewer.showShapeComments(
            this.image_config.regions_info.show_comments);

        let updateMeasurements = () => {
            if (this.viewer === null) return;
            let ids =
                this.image_config.regions_info.unsophisticatedShapeFilter();
            let measurements = this.viewer.getLengthAndAreaForShapes(ids);
            for (let i=0;i<measurements.length;i++) {
                let measurement = measurements[i];
                if (typeof measurement !== 'object' ||
                    measurement === null || typeof measurement.id !== 'string')
                        continue;
                let shape =
                    this.image_config.regions_info.getShape(measurement.id);
                if (shape !== null) {
                    shape.Area = measurement.Area;
                    shape.Length = measurement.Length;
                }
            }
        };
        setTimeout(updateMeasurements, 50);
    }

    /**
     * Handles view changes between split and normal view (event notification)
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    toggleSplitChannels(params = {}) {
        // check if we have a viewer instance and the event concerns us
        if (params.config_id !== this.image_config.id ||
            this.viewer === null ||
            typeof params.split !== 'boolean') return;

        this.viewer.toggleSplitView(params.split);
    }

    /**
     * Handles drawing of shapes via event notification as well as cancellation
     * of a chosen drawing interaction
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    drawShape(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.image_config.id ||
            this.viewer === null) return;

        // we want to only abort
        if (typeof params.abort === 'boolean' && params.abort) {
            this.abortDrawing();
            return;
        }

        // gather unattached dimensions (if any)
        // and decide if we add the drawn shape
        let add = true;
        let unattached = [];
        switch (this.image_config.regions_info.drawing_mode) {
            case REGIONS_DRAWING_MODE.NEITHER_Z_NOR_T:
                unattached = ['z', 't'];
                break;
            case REGIONS_DRAWING_MODE.NOT_Z:
                unattached.push('z');
                break;
            case REGIONS_DRAWING_MODE.NOT_T:
                unattached.push('t');
                break;
            case REGIONS_DRAWING_MODE.ALL_Z_AND_T:
            case REGIONS_DRAWING_MODE.ALL_Z:
            case REGIONS_DRAWING_MODE.ALL_T:
            case REGIONS_DRAWING_MODE.CUSTOM_Z_AND_T:
                add = false;
        }
        if (unattached.indexOf('z') === -1 &&
            this.image_config.image_info.projection === PROJECTION.INTMAX)
                unattached.push('z');

        // draw shape
        this.viewer.drawShape(
            params.shape, params.roi_id,
            {
                hist_id: params.hist_id,
                unattached: unattached,
                add: add
            });
    }


    /**
     * Aborts drawing interaction in ol3 viewer
     *
     * @memberof Ol3Viewer
     */
    abortDrawing() {
        this.viewer.abortDrawing();
        this.image_config.regions_info.shape_to_be_drawn = null;
    }

    /**
     * Stores shapes
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    storeShapes(params = {}) {
        // we need a viewer instance at a minimun,
        // also check if the event doesn't concern us
        if (this.viewer === null ||
            params.config_id !== this.image_config.id) return;

        let numberOfdeletedShapes =
            this.image_config.regions_info.getNumberOfDeletedShapes(true);
        let storeRois = () => {
            let requestMade =
                this.viewer.storeRegions(
                    Misc.isArray(params.deleted) ? params.deleted : [],
                    false, params.omit_client_update);

            if (requestMade) Ui.showModalMessage("Saving Regions. Please wait...");
            else if (params.omit_client_update)
                this.context.publish(
                    REGIONS_STORED_SHAPES, { omit_client_update: true});
        };

        if (numberOfdeletedShapes > 0) {
            Ui.showConfirmationDialog(
                'Save ROIS?',
                'Saving your changes includes the deletion of ' +
                numberOfdeletedShapes + ' ROIs. Do you want to continue?',
                storeRois, () => {
                    if (params.omit_client_update)
                        this.context.publish(
                            REGIONS_STORED_SHAPES, { omit_client_update: false});
                });
        } else storeRois();
    }

    /**
     * Modifies shape definition
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    modifyShapes(params = {}) {
        // the event doesn't concern us, we don't have a viewer instance
        // or does not have all the params required
        if (params.config_id !== this.image_config.id ||
            this.viewer === null ||
            !Misc.isArray(params.shapes) || params.shapes.length === 0 ||
            typeof params.definition !== 'object' ||
            params.definition === null) return;

        let modifies_attachment =
            typeof params.modifies_attachment === 'boolean' &&
            params.modifies_attachment;
        let modify = modifies_attachment ?
                        this.viewer.modifyShapesAttachment :
                        this.viewer.modifyRegionsStyle;

        // call modification function
        modify.call(
            this.viewer,
            params.definition, params.shapes.slice(),
            typeof params.callback === 'function' ? params.callback : null);
    }

    /**
     * Handling of 'synchronization' after storage
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    afterShapeStorage(params = {}) {
        Ui.hideModalMessage();
        // the event doesn't concern us
        if (params.config_id !== this.image_config.id) return;

        // reload other configs with the same image id (in mdi)
        if (this.context.useMDI)
            this.context.reloadImageConfigForGivenImage(
                this.image_config.image_info.image_id,
                IMAGE_CONFIG_RELOAD.REGIONS,
                this.image_config.id,
                this.viewer.getRois());

        // more checks
        if (typeof params.shapes !== 'object' ||
                params.shapes === null ||
                params.omit_client_update) return;

        let ids = [];
        // we iterate over the ids given and reset states accordingly
        for (let id in params.shapes) {
            let shape = this.image_config.regions_info.getShape(id);
            if (shape) {
                let syncId = params.shapes[id];
                ids.push(id);
                let oldRoiAndShapeId = Converters.extractRoiAndShapeId(id);
                let newRoiAndShapeId = Converters.extractRoiAndShapeId(syncId);
                // we reset modifed and stats
                shape.modified = false;
                shape.stats = null;
                // new ones are stored under their newly created ids
                let wasNew = typeof shape.is_new === 'boolean' && shape.is_new;
                if (wasNew) {
                    let newRoi =
                        this.image_config.regions_info.data.get(
                            newRoiAndShapeId.roi_id);
                    if (typeof newRoi === 'undefined') {
                        newRoi = {
                            shapes: new Map(),
                            show: false,
                            deleted: 0
                        };
                        this.image_config.regions_info.data.set(
                            newRoiAndShapeId.roi_id, newRoi);
                    }
                    delete shape['is_new'];
                    let newShape = Object.assign({}, shape);
                    newShape.shape_id = syncId;
                    newShape['@id'] = newRoiAndShapeId.shape_id;
                    newRoi.shapes.set(newRoiAndShapeId.shape_id, newShape);
                    shape.deleted = true; // take out old entry
                }
                // we remove shapes flagged deleted=true
                if (shape.deleted) {
                    let oldRoi =
                        this.image_config.regions_info.data.get(
                                oldRoiAndShapeId.roi_id);
                    if (typeof oldRoi !== 'undefined' &&
                        oldRoi.shapes instanceof Map)
                        oldRoi.shapes.delete(oldRoiAndShapeId.shape_id);
                    // remove empty roi as well
                    if (oldRoi.shapes.size === 0)
                        this.image_config.regions_info.data.delete(
                            oldRoiAndShapeId.roi_id);
                    // take out of count if not new
                    if (!wasNew) {
                        if (!shape.visible) // if not visible we correct
                            this.image_config.regions_info.visibility_toggles++;
                        this.image_config.regions_info.number_of_shapes--;
                    }
                }
            }
        }

        // update roi count
        this.image_config.image_info.roi_count =
            this.image_config.regions_info.data.size;

        // if we stored as part of a delete request we need to clean up
        // the history for the deleted shapes,
        // otherwise we wipe the history altogether
        if (params.is_delete)
            this.image_config.regions_info.history.removeEntries(ids);
        else this.image_config.regions_info.history.resetHistory();

        // error handling: will probably be adjusted
        if (typeof params.error === 'string') {
            let msg = "Saving of Rois/Shapes failed.";
            if (params.error.indexOf("SecurityViolation") !== -1)
                msg = "Insufficient Permissions to save some Rois/Shapes.";
            Ui.showModalMessage(msg, 'OK');
            console.error(params.error);
            return;
        }
    }

    /**
     * Shows/hides comments on shapes
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    showComments(params = {}) {
        // the event doesn't concern us
        if (params.config_id !== this.image_config.id ||
            this.viewer === null) return;

        this.viewer.showShapeComments(params.value);
    }

    /**
     * Adds an ol3 viewer history entry to our internal history
     * which is the only way we can then undo/redo geometry translations/
     * modifications that take place within the ol3 viewer
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    addHistoryEntry(params) {
        // the event doesn't concern us or we don't have a numeric history id
        if (params.config_id !== this.image_config.id ||
            typeof params.hist_id !== 'number') return;

        // we record the ol3 history id from a geometry modification/translation
        let history = this.image_config.regions_info.history;
        history.addHistory(
            history.getHistoryId(),
            history.action.OL_ACTION,
            {hist_id : params.hist_id, shape_ids: params.shape_ids});
    }

    /**
     * Undo/redo geometry modifications and translations that took place
     * in the ol3 viewer and have an associated history entry
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    affectHistoryAction(params) {
        // the event doesn't concern us, we don't have a viewer instance
        // or we don't have a numeric history id
        if (params.config_id !== this.image_config.id ||
            this.viewer === null ||
            typeof params.hist_id !== 'number') return;

        if (typeof params.undo !== 'boolean') params.undo = true;
        this.viewer.doHistory(params.hist_id, params.undo);
    }

    /**
     * Copies shape definitions (updating them if necessary)
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     * @return
     */
    copyShapeDefinitions(params) {
        // the event doesn't concern us, we don't have a viewer instance
        // or we have nothing selected for copy
        if (params.config_id !== this.image_config.id ||
            this.viewer === null ||
            this.image_config.regions_info.selected_shapes.length === 0) return;

        this.image_config.regions_info.copied_shapes = []; // empty first
        // loop over the selected and find the json for the shape,
        //then store it this.regions_info.copied_shapes and
        // in the localStorage (if supported)
        this.image_config.regions_info.selected_shapes.map(
            (id) => {
                let deepCopy =
                    Object.assign({},
                    this.image_config.regions_info.getShape(id));
                // if we have been modified we get an up-to-date def
                // from the viewer
                if (deepCopy.modified) {
                  let upToDateDef =
                    this.viewer.getShapeDefinition(deepCopy.shape_id);
                  if (upToDateDef)
                    deepCopy =
                        Converters.amendShapeDefinition(upToDateDef);
                }
                this.image_config.regions_info.copied_shapes.push(deepCopy)});

        // put them in local storage
        try {
            // remember image dimension for pasting into different size images
            window.localStorage.setItem(
                IVIEWER + ".copy_image_dims",
                JSON.stringify({
                    width: this.image_config.image_info.dimensions.max_x,
                    height: this.image_config.image_info.dimensions.max_x
            }));
            // remember shape definitions for generating copies
            window.localStorage.setItem(
                IVIEWER + ".copy_shape_defs",
                JSON.stringify(this.image_config.regions_info.copied_shapes));
        } catch(localstorage_not_supported) {}
    }

    /**
     * Starts/Stops dimension play
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     * @return
     */
    playDimension(params = {}) {
        // the event doesn't concern us or we don't have the minimum params
        // needed to properly process the event
        if (params.config_id !== this.image_config.id  ||
            this.viewer === null ||
            typeof params.forwards !== 'boolean' ||
            typeof params.dim !== 'string' ||
            (params.dim !== 'z' && params.dim !== 't')) return;

        // the stop function
        let stopPlay = (() => {
            if (this.player_info.handle !== null)
                clearInterval(this.player_info.handle);
            this.player_info.dim = null;
            this.player_info.forwards = null;
            this.player_info.handle = null;
            this.image_config.undo_redo_enabled = true;
            this.viewer.getRenderStatus(true);
        }).bind(this);

        // check explicit stop flag (we default to true if not there)
        if (typeof params.stop !== 'boolean') params.stop = true;
        let forwards = params.forwards;
        // we stop the play loop if either we have the stop flag set to true
        // or the dimension to be played has changed
        // for both cases an existing loop handle needs to be there
        if ((params.stop && this.player_info.handle !== null) ||
                (!params.stop && this.player_info.handle !== null &&
                    (params.dim !== this.player_info.dim ||
                    forwards !== this.player_info.forwards))) stopPlay();

        // only if stop is false we continue to start
        if (params.stop) return;

        let delay =
            (typeof params.delay === 'number' && params.delay >= 100) ?
                params.delay : 250;

        // bounds and present dimension index
        let dims = this.image_config.image_info.dimensions;
        let dim = params.dim;
        let min_dim = 0;
        var max_dim = dims['max_' + dim]-1;
        var pres_dim = dims[dim];

        // we can go no further
        if (max_dim === 0 ||
             (forwards && pres_dim >= max_dim) ||
             (!forwards && pres_dim <= min_dim)) return;

        this.player_info.dim = dim;
        this.player_info.forwards = forwards;
        this.image_config.undo_redo_enabled = false;
        this.player_info.handle =
            setInterval(
                () => {
                    try {
                        // keep handle backup in window in case of error
                        window.interval_handle = this.player_info.handle;

                        // if we get an in progress status the dimension has not yet
                        // rendered and we return to wait for the next iteration
                        let renderStatus = this.viewer.getRenderStatus();
                        if (renderStatus === RENDER_STATUS.IN_PROGRESS) return;

                        // get present dim index and check if we have hit a bound
                        // if so => abort play
                        pres_dim = dims[dim];
                        if (renderStatus === RENDER_STATUS.ERROR ||
                                (forwards && pres_dim >= max_dim) ||
                                (!forwards && pres_dim <= min_dim)) {
                                    stopPlay(); return;}

                        // arrange for the render status to be watched
                        if (!this.viewer.watchRenderStatus(true))
                            this.viewer.getRenderStatus(true);
                        // set the new dimension index
                        dims[dim] = pres_dim + (forwards ? 1 : -1);
                    } catch(ignored) {
                        clearInterval(window.interval_handle);
                    }
                }, delay);
    }

    /**
     * Captures Viewport Canvas Data
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     * @return
     */
    captureViewport(params={}) {
        if (this.viewer === null ||
            params.config_id !== this.image_config.id) return;
        this.viewer.sendCanvasContent();
    }

    /**
     * Saves Viewport Canvas Data
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     * @return
     */
    saveCanvasData(params={}) {
        if (this.image_config === null || // sanity check
            this.image_config.id !== params.config_id) return; // not for us
        if (!params.supported) { // blob not supported
                console.error("Capturing Viewport as Blob not supported");
                return;
        }

        FileSaver.saveAs(
            params.data, this.image_config.image_info.image_name + ".png");
    }

    /**
     * Propagates image interaction such as zoom/drag
     * to image configs in the same sync group
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
     syncView(params={}) {
         // not intended for same image configs
         if (this.viewer === null ||
             params.config_id === this.image_config.id) return;
         this.linked_events.syncAction(params, "syncView");
     }

     /**
      * Sets the sync group for the viewer
      *
      * @memberof Ol3Viewer
      * @param {Object} params the event notification parameters
      */
      setSyncGroup(params={}) {
          if (this.viewer === null ||
              params.config_id !== this.image_config.id) return;
          this.viewer.setSyncGroup(params.sync_group);
      }

    /**
     * Turns on/off intensity querying
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    toggleIntensityQuerying(params = {}) {
        if (this.viewer === null || this.image_config === null || // sanity checks
            this.image_config.id !== params.config_id) {// not for us
                return;
        }
        this.image_config.image_info.query_intensity =
            this.viewer.toggleIntensityQuerying(params.flag);
    }

    /**
     * Shows/hides viewer controls
     *
     * @memberof Ol3Viewer
     * @param {Object} params the event notification parameters
     */
    toggleControlsVisibility(params = {}) {
        // sanity checks
        if (this.viewer === null || this.image_config === null ||
            this.image_config.id !== params.config_id ||
            typeof params.flag !== 'boolean') return;

        if (params.flag) {
            $("#" + this.image_config.id + " .ol-control").show();
            this.image_config.show_controls = true;
        } else {
            $("#" + this.image_config.id + " .ol-control").hide();
            this.image_config.show_controls = false;
        }
    }
}
