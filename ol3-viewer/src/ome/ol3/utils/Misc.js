/**
 * @namespace ome.ol3.utils.Misc
 */
goog.provide('ome.ol3.utils.Misc');


goog.require('ol.array');

/**
 * This convenience method prepares the resolutions for pyramid and non-tiled
 * sources likewise. It makes use of {@link ome.ol3.DEFAULT_RESOLUTIONS} to achieve a
 * certain number of zoom levels
 *
 * @static
 * @function
 * @param {?Array} resolutions the resolutions array or null
 */
ome.ol3.utils.Misc.prepareResolutions = function(resolutions) {
	if (!ome.ol3.utils.Misc.isArray(resolutions) || resolutions.length === 0 ||
				(resolutions.length === 1 && resolutions[0] === 1))
		return ome.ol3.DEFAULT_RESOLUTIONS;

	// if the given resolutions exceed the number of default zoom levels
	// we use them as is
	var defResLen = ome.ol3.DEFAULT_RESOLUTIONS.length;
	if (resolutions.length >= defResLen)
		return resolutions;

	// if the given resolutions do not cover the default zoom levels, fill up
	// by taking into  account the number of levels before and after the 1:1 resolution
	var newRes = [].concat(resolutions);
	var oneToOneIndex = -1;
	for (var i in  newRes)
		if (newRes[i] === 1.0) {
			oneToOneIndex = i;
			break;
		}
	if (oneToOneIndex < 0) { // no one to one, let's inject one
		for (var i in  newRes)
			if (newRes[i] < 1.0) {
				oneToOneIndex = i;
				break;
			}
		if (oneToOneIndex < 0) {
			newRes.push(1.0);
			oneToOneIndex = newRes.length-1;
		} else
			newRes.splice(oneToOneIndex, 0, 1.0);
	}
	if (newRes.length >= defResLen) // we are already full, return us
		return newRes;

	var defResOneToOne = 0;
	for (var i in  ome.ol3.DEFAULT_RESOLUTIONS)
		if (ome.ol3.DEFAULT_RESOLUTIONS[i] == 1.0) {
			defResOneToOne = i;
			break;
		}

	var remainingPositions = defResLen - newRes.length;
	//we alternate starting at which end has fewer zoom level
	var insertFront = true;
	if (newRes.length - oneToOneIndex < oneToOneIndex)
		insertFront = false;
	while (remainingPositions > 0) {
		if (insertFront) {
			insertFront=false;
			newRes.splice(0, 0, newRes[0] * 1.5);
		} else {
			insertFront=true;
			var newVal = newRes[newRes.length-1] / 1.5;
			newRes.push(newVal);
		}
		remainingPositions--;
	}

	return newRes;
};

/**
 * Parses a given svg path for polylines and polygons and
 * returns a coordinates array
 *
 * @static
 * @function
 * @param {string} svg_path a svg path
 * @return {Array.<Array.<number>>|null} returns the coordinates as x,y tuples or null
 */
ome.ol3.utils.Misc.parseSvgStringForPolyShapes = function(svg_path) {
	if (typeof(svg_path) != 'string' || svg_path.length == 0)
		return null;

	var c=0;
	var len=svg_path.length;
	var coords = [];
	var start = -1;

	var usesComma = svg_path.indexOf(",") > 0;

	while (len-c > 0) { // get rid of anything that is not M,L or z
		if (svg_path[c] == ' ') {
			if (c+1 >= len) break;

			if (!usesComma || (usesComma && svg_path[c+1] === ' ')) {
				c++;
				if (usesComma) continue;
			}
		}

		var v = svg_path[c].toLowerCase();
		if (v === 'm' || v === 'l' || v === 'z' || v === ' ') {
			if (start < 0) {
				while (c+1 < len && v === ' ' &&
					(svg_path[c+1] === ' ' || svg_path[c+1].toLowerCase() === 'z'))
					v = svg_path[++c].toLowerCase();
				if (v == 'z') {
					coords.push(coords[0]);
					start = -1;
					break;
				}
				start = c+1;
				while (len-c > 0 && (svg_path[++c] === ' ' || svg_path[c] === 'M'))
					start++;
			} else {
				try {
					var tok =
						svg_path.substring(start,
							usesComma ? c : c-1).split(usesComma ? "," : " ");
					if (typeof(tok) != 'object' || tok.length < 2)
							return null;

					var c1 = null;
					var c2 = null;
					for (var t in tok) {
						if (tok[t] === "")
							continue;
						if (c1 === null)
							c1 = tok[t];
						else if (c2 === null)
							c2 = tok[t];
						else break;
					}
					if (c1 === null && c2 === null) return null;
					coords.push([parseInt(c1), -parseInt(c2)]);
					start = -1;
					c--;
				} catch(err) {
					return null;
				}
			}
		}
		c++;
	}
	if (start !== -1) { // we have the end point left over (e.g. line)
		try {
			var tok = svg_path.substring(start, len).split(usesComma ? "," : " ");
			if (typeof(tok) != 'object' || tok.length < 2)
				return null;

			var c1 = null;
			var c2 = null;
			for (var t in tok) {
				if (tok[t] === "")
					continue;
				if (c1 === null)
					c1 = tok[t];
				else if (c2 === null)
					c2 = tok[t];
				else break;
			}
			if (c1 === null && c2 === null) return null;

			coords.push([parseInt(c1), -parseInt(c2)]);
		} catch(err) {
			return null;
		}
	}

	return coords;
};


/**
 * Deals with multiple features under the same coordinate
 *
 * @static
 * @param {Array.<ol.Feature>} features the features found under the coordinate
 * @param {boolean|undefined|null}  cluster_has_priority a flag whether a cluster needs to be returned first
 */
ome.ol3.utils.Misc.featuresAtCoords =
function(features, cluster_has_priority) {
    if (!ome.ol3.utils.Misc.isArray(features) || features.length ===0) return null;

    cluster_has_priority =
        typeof(cluster_has_priority) === 'boolean' ? cluster_has_priority : false;

    // determine priority of whih feature ought to be returned
    var filteredIntersectingFeatures = [];
    for (var i in features)
        if (cluster_has_priority && // clusteres have priority
                features[i] instanceof ome.ol3.feature.Cluster)
            filteredIntersectingFeatures.push(features[i]);
        else if (filteredIntersectingFeatures.length > 0) {
            // this should ensure that if a feature is contained by another
            // it will be always ranked first
            var firstSuchGeometry= filteredIntersectingFeatures[0].getGeometry();
            if (ol.extent.containsExtent( // we have a feature that is contained by our first feature
                        firstSuchGeometry.getExtent(),
                        features[i].getGeometry().getExtent()))
                filteredIntersectingFeatures[0] = features[i]; // replace it
        } else filteredIntersectingFeatures.push(features[i]);

    // we have to check for the rather implausible szenario of one cluster being
    // fully covered by another
    if (cluster_has_priority && filteredIntersectingFeatures.length > 1)
        for (var i in filteredIntersectingFeatures)
            if (ol.extent.containsExtent(
                    filteredIntersectingFeatures[0].getGeometry().getExtent(),
                    filteredIntersectingFeatures[i].getGeometry().getExtent()))
                filteredIntersectingFeatures[0] = filteredIntersectingFeatures[1];

    return filteredIntersectingFeatures.length > 0 ?
        filteredIntersectingFeatures[0] : null;
};


/**
 * Returns all classes associated with the html element
 *
 * @static
 * @param {Object} element an html element
 * @return {Array.<string>|null} an array of classes or null
 */
ome.ol3.utils.Misc.getClass = function(element) {
	if (typeof(element) !== 'object' || typeof(element['className']) !== 'string')
		return null;

	var classNames = element['className'];

	return classNames.match(/\S+/g) || null;
}

/**
 * Sets a class for an element
 *
 * @static
 * @param {Object} element an html element
 * @param {string} className a class
 */
ome.ol3.utils.Misc.setClass = function(element, className) {
	if (typeof(element) !== 'object' || typeof(element['className']) !== 'string'
	 			|| typeof(className) !== 'string')
		return;
	element['className'] = className;
}

/**
 * Checks whethere a given html element has a given class associated with it
 *
 * @static
 * @param {Object} element an html element
 * @param {string} className a class
 * @return {boolean} true if the element has the class on it, false otherwise
 */
ome.ol3.utils.Misc.containsClass = function(element, className) {
	if (typeof(className) !== 'string' || className.length === 0) return false;

	var allClasses = ome.ol3.utils.Misc.getClass(element);
	if (allClasses === null) return false;

	return ol.array.includes(allClasses, className);
}

/**
 * Helps to find a suitable number of shapes per viewing extent before things get too slow
 * As general rule webkit based browsers perform pretty well and can easily
 * handle 1,000, up to 5,000 shapes drawn onto the canvas incl. redraws
 *
 * Firefox does not so well and we have to keep the number low.
 * IEs performance is variable depending on th version. Up to 9 they seem to be
 * in the same ballpark as firefox, then they get faster though never reaching webkit levels
 *
 * @static
 * @return {number} a good number to work with given a specific browser
 */
ome.ol3.utils.Misc.getGoodShapeThresholdForUsedBrowser = function() {
	if (goog.labs.userAgent.engine.isWebKit())
		return 1000;
	// both of these (present versions) should alrady have fallen into the above category
	if (goog.labs.userAgent.browser.isOpera() ||
	 			goog.labs.userAgent.browser.isSafari())
		return 1000;
	if (goog.labs.userAgent.engine.isGecko()) // FF
		return 800;
	if (goog.labs.userAgent.browser.isIE()) { // IEs
		if (goog.labs.userAgent.engine.isTrident() ||
				goog.labs.userAgent.engine.isEdge())
			return 800;
		return 500;
	}

	return 250; // the rest
}

/**
 * Checks if something is an array
 *
 * @static
 * @param {string} something a potential array
 * @return {boolean} true if something is an array, otherwise false
 */
ome.ol3.utils.Misc.isArray = function(something) {
   if (typeof something !== 'object' || something === null) return false;

   if (something instanceof Array ||
       Object.prototype.toString.call(null, something) === '[object Array]')
           return true;

   return false;
}

/**
 * Finds cookie (if exists) matching the given name
 *
 * @static
 * @param {string} name the name of the cookie
 * @return {string} the cookie's value
 */
ome.ol3.utils.Misc.getCookie = function(name) {
	if (typeof(name) != 'string')
		return "";

		var all = document.cookie.split(';');
		for(var i=0, ii = all.length;i<ii; i++) {
				var cookie = all[i];
				while (cookie.charAt(0)==' ') cookie = cookie.substring(1);
				if (cookie.indexOf(name + '=') == 0) return cookie.substring(name.length+1,cookie.length);
		}
		return "";
};

/**
 * Takes a string with channel information in the form:
 * -1|111:343$808080,2|0:255$FF0000 and parses it into an object that contains
 * the respective channel information/properties
 *
 * @static
 * @function
 * @param {string} some_string a string containing encoded channel info
 * @return {Array|null} an array of channel objects or null
 */
ome.ol3.utils.Misc.parseChannelParameters = function(some_string) {
    if (typeof some_string !== 'string' || some_string.length === 0)
        return null;

    var ret = [];

    // first remove any whitespace there may be
    some_string = some_string.replace(/\s/g, "");

    // split up into channels
    var chans = some_string.split(',');
    if (chans.length === 0) return null;

    // iterate over channel tokens
    for (var k in chans) {
        // extract channel number
        var c = chans[k];
        var pos = c.indexOf('|');
        if (pos === -1) continue;

        var chanNum = parseInt(c.substring(0, pos));
        if (isNaN(chanNum)) continue;

        var tmp = {
            'index' : chanNum < 0 ? (-chanNum)-1 : chanNum-1,
            'active' : chanNum < 0 ? false : true
        };

        // extract range token
        c = c.substring(pos+1); // shave off number info
        pos = c.indexOf("$");
        if (pos === -1) continue;
        var rTok = c.substring(0, pos).split(':');
        if (rTok.length !== 2) continue; // we need start and end
        var rStart = parseInt(rTok[0]);
        var rEnd = parseInt(rTok[1]);
        if (isNaN(rStart) || isNaN(rEnd)) continue;
        tmp['start'] = rStart;
        tmp['end'] = rEnd;

        // extract last bit: color tokens
        c = c.substring(pos+1); // shave off range info
        //if (c.length !== 3 && c.length !== 6) continue; // we need hex notation length
        tmp['color'] = c;

        // add to return
        ret.push(tmp);
    }

    return ret;
}
