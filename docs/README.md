
<img src="https://raw.githubusercontent.com/will-moore/omero-iviewer/intro_docs/docs/iviewer_classes.png">

This class diagram shows some of the major iviewer classes and some key attributes and relationships.

To edit the diagram, go to https://www.draw.io/ and open the ``iviewer_classes.xml`` file.
When you save, this will download an updated xml file. Use ``Export as -> PNG`` to create a new diagram.


Application loading
===================

In views.py ``def index()`` loads variables from the query string,
uses reverse(url) to generate URLS and the Django index.html template
(at plugin/omero_iviewer/templates/omero_iviewer/index.html)
converts it into global JavaScript object:

    INITIAL_REQUEST_PARAMS = {DATASET: "601",
                        IMAGES: "3727,3728,3731,55184",
                        INTERPOLATE: "True",
                        OMERO_VERSION: "5.4.7-ice36-SNAPSHOT",
                        VERSION: "0.5.0",
                        WEBCLIENT: "/webclient/",
                        WEBGATEWAY: "/webgateway/",
                        WEB_API_BASE: "/api/v0/"}


The index.html has no HTML elements except ``<body></body>``

The JavaScript entry point is src/main.js:

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
header, thumbnail-slider and right-hand-panel as well as an instance of ol3-viewer for each of the
context.image_configs.


Loading Images
==============

When the app loads, the ``thumbnail-slider`` component loads thumbnails for the selected images. For
a single image, it loads the parent container to display thumbnails for all images within the container (Dataset or Well).

The ``thumbnail-slider`` initiates image loading by calling ``context.addImageConfig(image_id, parent_id, parent_type)``.
This may first remove other ``image_configs`` before creating a new one and loading image data:

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

Each ``ol3-viewer`` Aurelia component wraps an ``OpenLayers`` viewer. The OpenLayers classes are
under ``ol3-viewer/src`` and are built via Google's closure compiler into a ``libs/ol3-viewer.js`` library
which is then included in the ``main.js`` built by webpack.

NB: The closure compiler will minimize all internal variable names, so you cannot use dot notation.
You must use ``foo['bar']`` instead of ``foo.bar``.

The ol3.Viewer class gets passed the ``context.eventbus`` but not the ``context`` or ``image_info``
like other Aurelia classes.

    this.viewer = new ol3.Viewer(
        this.image_config.image_info.image_id, {
            eventbus : this.context.eventbus,
            server : this.context.server,
            data: this.image_config.image_info.tmp_data,
            initParams :  ol3initParams,
            container: this.container
         });

The ``ol3.Viewer.image_info_`` is actually the ``image_info.tmp_data`` JSON response object,
not the ``Image_Info`` class.
