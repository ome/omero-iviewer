
Application loading
===================

In views.py ``def index()`` loads variables from they query string,
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


The index.html has no HTML elements except <body></body>

The JavaScript entry point is src/main.js:

	bootstrap(function(aurelia) {
	    aurelia.use.basicConfiguration();
	    let ctx = new Context(aurelia.container.get(EventAggregator), req);
	    if (is_dev_server) ctx.is_dev_server = true;
	    aurelia.container.registerInstance(Context,ctx);

	    aurelia.start().then(
	        () => aurelia.setRoot(PLATFORM.moduleName('app/index'), document.body));
	});

We create a singleton Context instance (app/context.js) which includes and EventAggregator (pub/sub events).
This is registered with the aurilia's [dependency injection container](https://aurelia.io/docs/fundamentals/dependency-injection#explicit-configuration) to allow any component to get hold of it.

Then the application is started specifying that the document.body is the root element of the app and that
the Aurelia entry point is the app/index (index.js and index.html).

The index.html contains the main layout of the iviewer, including custom components such as
header, thumbnail-slider, right-hand-panel as well as an instance of ol3-viewer for each of the
context.image_configs.


