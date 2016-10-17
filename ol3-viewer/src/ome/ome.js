if (typeof(ome) !== 'object') {
	/**
	 * @namespace ome
	 */
	goog.provide('ome');
}

ome.isIE = function() {
    return goog.labs.userAgent.browser.isIE();
}

goog.exportSymbol('ome.isIE',ome.isIE,OME);
