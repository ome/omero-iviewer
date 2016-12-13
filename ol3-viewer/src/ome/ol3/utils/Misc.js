/**
 * @namespace ome.ol3.utils.Misc
 */
goog.provide('ome.ol3.utils.Misc');


goog.require('ol.array');

/**
 * Generates an array of resolutions according to a step size
 * If one likes to think of it in terms of 100% (resolution: 1)
 * then the step size will determine how many levels there will be.
 * To cater for slightly different needs (i.e. tiled vs untiled sources)
 * a zoom_in step size and zoom_out step size can be given to result
 * in corresponding level numbers for above and below resolution 1.
 *
 * @static
 * @function
 * @param {number} zoom_in the increment for zoom_in
 * @param {number} zoom_out the increment for zoom_out
 */
ome.ol3.utils.Misc.generateDefaultResolutions = function(zoom_in, zoom_out) {
    // checks and clamps so as to not get an unreasonable number of
    // levels
    if (typeof zoom_in !== 'number' || zoom_in < 0.01 || zoom_in >= 1)
        zoom_in = 0.2;
    if (typeof zoom_out !== 'number' || zoom_out < 0.1 || zoom_out >= 5)
        zoom_out = 1;

    var resolutions = [];
    var zoom_out_levels = [];
    for (var z=1+zoom_out; z<5; z+=zoom_out)
        zoom_out_levels.push(z);
    resolutions = resolutions.concat(zoom_out_levels.reverse());
    resolutions.push(1);
    var zoom_in_levels = [];
    for (var z=1-zoom_in; z>0.01; z-=zoom_in)
        zoom_in_levels.push(z);
    resolutions = resolutions.concat(zoom_in_levels);

    return resolutions;
}

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
		return ome.ol3.utils.Misc.generateDefaultResolutions(0.025, 0.10);

    // for tiled sources we find the 1:1, then go backwards in the array
    // filling up with levels for zoom out
    var newRes = [1];
    var oneToOneIndex = resolutions.indexOf(1.0);
    if (oneToOneIndex === -1) resolutions.push(1.0);
    // make sure we are sorted and in reverse
    resolutions.sort((a,b) => b - a);
    oneToOneIndex = resolutions.indexOf(1.0);
    var p = oneToOneIndex > 0 ? oneToOneIndex : resolutions.length-1;
    for (var i=p; i>0;i--) {
        var resAtI = resolutions[i];
        var resBefI = resolutions[i-1];
        var delta = Math.abs(resBefI - resAtI);
        // we divide up into 8 levels in between, i.e. 12.5% of the original delta
        var partialDelta = delta * 0.125;
        for (var j=1;j<=8;j++) newRes.push(resAtI + j * partialDelta);
    }
    // append zoom in factors (if present, unlikely with tiled)
    if (oneToOneIndex < resolutions.length-1)
        for (var x=oneToOneIndex+1;x<resolutions.length;x++)
            newRes.push(resolutions[x]);

    // now we fill up zoom in and out positions
    // for a total number of resolutions
    newRes.sort((a,b) => b - a);
    var totalNumberOfLevels = newRes.length === 1 ? 20 : newRes.length + 10;
	var remainingPositions = totalNumberOfLevels - newRes.length;
	//we alternate starting at which end has fewer zoom level
	var insertFront = true;
	if (newRes.length - oneToOneIndex < oneToOneIndex)
		insertFront = false;
	while (remainingPositions > 0) {
		if (insertFront) {
			insertFront=false;
			newRes.splice(0, 0, newRes[0] * 1.20);
		} else {
			insertFront=true;
			var newVal = newRes[newRes.length-1] / 1.10;
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
 */
ome.ol3.utils.Misc.featuresAtCoords =
function(features) {
    if (!ome.ol3.utils.Misc.isArray(features) || features.length ===0) return null;

    // determine priority of whih feature ought to be returned
    var filteredIntersectingFeatures = [];
    for (var i in features)
        if (filteredIntersectingFeatures.length > 0) {
            // this should ensure that if a feature is contained by another
            // it will be always ranked first
            var firstSuchGeometry= filteredIntersectingFeatures[0].getGeometry();
            if (ol.extent.containsExtent( // we have a feature that is contained by our first feature
                        firstSuchGeometry.getExtent(),
                        features[i].getGeometry().getExtent()))
                filteredIntersectingFeatures[0] = features[i]; // replace it
        } else filteredIntersectingFeatures.push(features[i]);

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
        var rEnd = rTok[1].toLowerCase();
        // account for reverse flag
        var rPos = rEnd.indexOf("r");
        if (rPos != -1) {
            tmp['reverse'] =
                rEnd.substring(rPos-1, rPos) === '-' ? false : true;
            rEnd =
                parseInt(rEnd.substring(0, tmp['reverse'] ? rPos : rPos-1));
        } else  rEnd = parseInt(rEnd);
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
