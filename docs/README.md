
<img src="https://github.com/ome/omero-iviewer/blob/master/docs/iviewer_classes.png?raw=true">

This class diagram shows some of the major iviewer classes and some key attributes and relationships.

To edit the diagram, go to https://www.draw.io/ and open the ``iviewer_classes.xml`` file.
When you save, this will download an updated xml file. Use ``Export as -> PNG`` to create a new diagram.


Application loading
===================

In ``views.py``, ``def index()`` loads variables from the query string,
uses ``reverse(url)`` to generate URLS and the Django ``index.html`` template
(at ``plugin/omero_iviewer/templates/omero_iviewer/index.html``)
converts it into global JavaScript object:

    // example JavaScript object created in index.html

    INITIAL_REQUEST_PARAMS = {DATASET: "601",
                        IMAGES: "3727,3728,3731,55184",
                        INTERPOLATE: "True",
                        OMERO_VERSION: "5.4.7-ice36-SNAPSHOT",
                        VERSION: "0.5.0",
                        WEBCLIENT: "/webclient/",
                        WEBGATEWAY: "/webgateway/",
                        WEB_API_BASE: "/api/v0/"}


The ``index.html`` has no HTML elements except ``<body></body>``

The JavaScript entry point is ``src/main.js``:

    // src/main.js

    bootstrap(function(aurelia) {
        aurelia.use.basicConfiguration();
        let ctx = new Context(aurelia.container.get(EventAggregator), req);
        if (is_dev_server) ctx.is_dev_server = true;
        aurelia.container.registerInstance(Context,ctx);

        aurelia.start().then(
            () => aurelia.setRoot(PLATFORM.moduleName('app/index'), document.body));
    });

We create a singleton ``Context`` instance (``app/context.js``) which includes an ``EventAggregator`` (pub/sub events)
called ``eventbus``.
The ``Context`` is registered with the aurelia's [dependency injection container](https://aurelia.io/docs/fundamentals/dependency-injection#explicit-configuration) to allow any component to get hold of it.

Then the application is then started, specifying that the ``document.body`` is the root element of the app and that
the Aurelia entry point is the ``app/index`` (``index.js`` and ``index.html``).

The ``app/index.html`` template (a different file from the Django ``index.html`` template above)
contains the main layout of the iviewer, including custom components such as
header, thumbnail-slider and right-hand-panel as well as an instance of
openlayers viewer for each of the context.image_configs.


Loading Images
==============

When the app loads, the ``thumbnail-slider`` component loads thumbnails for the selected images. For
a single image, it loads the parent container to display thumbnails for all images within the container (Dataset or Well).

The ``thumbnail-slider`` initiates image loading by calling ``context.addImageConfig(image_id, parent_id, parent_type)``.
This may first remove other ``image_configs`` before creating a new one and loading image data:

    // src/app/context.js

    let image_config = new ImageConfig(this, image_id, parent_id, parent_type);
    // store the image config in the map and make it the selected one
    this.image_configs.set(image_config.id, image_config);
    this.selectConfig(image_config.id);
    // Call bind() to initialize image data loading
    image_config.bind();

The ``context.selected_config`` attribute is ``Observed`` by the ``right-hand-panel`` component, so that changing the selected config causes the right hand panel to re-render, passing the new ``image_config`` down to all of the
child components via ``bind``, for example ``<settings image_config.bind="image_config"></settings>``.

When these components first re-render, the image data will not have been loaded yet. They wait for this by observing
``image_config.image_info.ready`` which is set to ``true`` when the image is loaded.

When a ``new ImageConfig()`` is created above, the constructor creates a new ``image_info``:

    this.image_info = new ImageInfo(this.context, this.id, image_id, parent_id, parent_type);

and the ``image_config.bind()`` calls ``image_info.bind()`` which calls ``image_info.requestData()`` to load the
image data and calls ``initializeImageInfo(response, refresh);`` which finally sets ``image_info.ready = true``.
This causes other view components to re-render and show the image as mentioned above.


Image viewer (OpenLayers)
=========================

Each ``ol3-viewer`` Aurelia component wraps an ``OpenLayers`` viewer.
The OpenLayers classes are under ``src/viewers/viewer`` with ``Viewer.js``
being the entry point.

The Viewer class gets passed the ``context.eventbus`` but not the
``context`` or ``image_info`` like other Aurelia classes.

    // src/viewers/ol3-viewer.js

    this.viewer_ = new Viewer(
        this.image_config.image_info.image_id, {
            eventbus : this.context.eventbus,
            server : this.context.server,
            data: this.image_config.image_info.tmp_data,
            initParams : initParams,
            container: this.container
        });

The ``Viewer.image_info_`` is actually the ``image_info.tmp_data`` JSON response object,
not the ``Image_Info`` class.

When the Viewer is created, we create the OpenLayers Map and other components
from the ``image_info_`` data:

    // src/viewers/ol3-viewer.js

    import OlMap from 'ol/Map';

    // within bootstrapOpenLayers(), called by constructor
    // use image_info_ data to get IDs, dimensions etc. e.g.
    dims = this.image_info_['size']

    var source = new OmeroImage({
        image: this.id_,
        width: dims['width'],
        height: dims['height'],
        // other parameters omitted
    });

    this.viewer_ = new OlMap({
        controls: controls,                 // e.g. [ScaleBar, Zoom]
        interactions: interactions,         // e.g. [DragPan, MouseWheelZoom]
        layers: [new Tile({source: source})],
        target: this.container_,
        view: view                          // ol.View
    });

The ``OmeroImage`` extends ``OpenLayers TileImage`` with a custom
``tileUrlFunction`` that uses the image data as well as the current rendering
settings to provide tile URLs.


Regions (ROIs)
==============

When we select the ROIs tab in the ``right-hand-panel`` component, this calls
``this.image_config.regions_info.requestData()`` which makes the AJAX call to
load ROIs. When ready, the ``ol3-viewer`` calls ``this.viewer.addRegions(data)``.
This adds a Vector layer to the OpenLayers Map:

    // src/viewers/viewer/Viewer.js

    import Vector from 'ol/layer/Vector'
    import Regions from './source/Regions';    // extends 'ol/source/Vector'

    addRegions(data) {

        // Regions constructor creates ol.Features from JSON data
        this.regions_ = new Regions(this, {data: data});
        this.viewer_.addLayer(new Vector({source : this.regions_}));

        // enable roi selection by default, as well as modify and translate
        this.regions_.setModes([SELECT, MODIFY, TRANSLATE]);
    }

When a drawing tool such as Rectangle is selected, the ol3-viewer calls
``this.viewer.drawShape(params)``:

    // src/viewers/viewer/Viewer.js

    drawShape(shape, roi_id, opts) {
        this.setRegionsModes([DRAW]);
        this.regions_.draw_.drawShape(shape, roi_id, opts);
    }

This first calls ``source/Regions.setModes(DRAW)`` to create a new
``viewer/interaction/Draw``...

    // src/viewers/viewer/source/Regions.js

    setModes(modes) {
        // if DRAW in modes
        this.draw_ = new Draw(oldModes, this);
    }

The ``viewer/interaction/Draw`` calls wraps an OpenLayers Draw instance instead of
extending it. A new ``OpenLayers Draw`` instance is created with a function that
generates e.g. a new ``viewer/geom/Rectangle``:

    // src/viewers/viewer/interaction/Draw.js

    // called by Viewer.drawShape() above
    drawShape(shape, roi_id, opts)

    // which calls e.g.
    drawRectangle_()

    // which calls
    drawShapeCommonCode_(ol_shape, shape_type, geometryFunction) {

        // where geometryFunction returns e.g. new Rectangle(x, y, w, h);

        this.ol_draw_ = new OlDraw({
            geometryFunction: geometryFunction
        }

        this.regions_.viewer_.viewer_.addInteraction(this.ol_draw_);
        this.ol_draw_.on(DrawEventType.DRAWEND, onDrawEndAction, this);
    }

The ``onDrawEndAction()`` is fired when a shape is completed and calls:

    // src/viewers/viewer/interaction/Draw.js

    self.regions_.addFeature(event.feature);

    // sends notification via
    self.regions_.viewer_.eventbus_
