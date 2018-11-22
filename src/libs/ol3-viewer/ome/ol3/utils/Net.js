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

/**
 * Santitizes the uri and performs some basic validity checks. Used internally.
 * <p>
 * We rid the uri of all whitespace, all leading '/', breaking it apart into
 * it's leading component (path) and query string
 *
 * This utils method returns an object of the following form:
 * <pre>
 * { "path" : "imgData", "query" : "param1=6", "full" : "/imgData/?param1=6"}
 * </pre>
 *
 * @private
 * @static
 * @function
 * @param {string} uri the uri given
 * @return {Object|null} a uri object or null (if something goes badly wrong)
 */
export function checkAndSanitizeUri(uri) {
    if (typeof(uri) !== 'string') return null;

    try {
        let ret = { // prepare return object
            "path" : "/", "query" : "", "full" : "/", "relative" : true
        };
        uri = uri.replace(/\s/g, ""); // away with all white space
        if (uri.length === 0) return ret; // that's ok (strictly speaking)

        // get rid of any leading '/'
        let len = uri.length;
        for (let p=0;p<len;p++)
            if (uri.charAt(p) !== '/') break; // we stop, if it is not a '/'
            else {
                ret['relative'] = false;
                uri = uri.substring(p+1); p--;
            }

        // do we have a query string ?
        let position = uri.indexOf("?");
        if (position !== -1) {
            // cut it out and paste it into the return object without ?
            ret['query'] = uri.substring(position+1);

            // take away the query string from our original uri
            uri = uri.substring(0,position);
        }
        // get rid of any trailing '/' for the path
        len = uri.length;
        if (len > 0) {
            for (let p=len-1;p>=0;p--)
                // we stop, if the last one is not a '/'
                if (uri.charAt(p) !== '/') break;
                else uri = uri.substring(0,p);
        }
        ret['path'] = uri; // the path is what's left
        ret['full'] = ret['path']; // set the full uri
        if (ret['query'].length > 0) ret['full'] += "/?" + ret['query'];

        return ret;
    } catch(error) {
        return null;
    }
}

/**
 * Santitizes the server address/ip and performs some basic validity checks.
 * Used internally.
 * <p>
 * We rid the address of all whitespace, then check whether the protocol was
 * included which we add in as 'http' if it hasn't been included. Apart from the
 * protocol start we don't want another '/'. An empty server address,
 * however, we regard valid since we will be operating in relative addresses then
 * </p>
 *
 * This utils method returns an object of the following form:
 * <pre>
 * { "protocol" : "http", "server" : "localhost", "full" : "http://localhost"}
 * </pre>
 *
 * @private
 * @static
 * @function
 * @param {string} addressOrIp a server address/ip
 * @return {Object|null} a server address or ip or null (if something goes badly wrong)
 */
export function checkAndSanitizeServerAddress(addressOrIp) {
    if (typeof(addressOrIp) !== 'string') return null;

    try {
        let ret = { // prepare return object
            "protocol" : "", "server" : "", "full" : ""
        };
        addressOrIp = addressOrIp.replace(/\s/g, "");
        if (addressOrIp.length === 0) return ret; // that's ok, relative info is used

        // do we have protocol info in there
        let position = addressOrIp.indexOf("://");
        if (position === -1) ret['protocol'] = "http"; // we default
        else {
            // we do have a protocol, parse it. we accept only http(s) and file
            let prot = addressOrIp.substring(0, position).toLowerCase();
            if (prot !== 'http' && prot !== 'https' && prot !== 'file') return null;
            ret["protocol"] = prot;

            // take away the protocol info to be left with the rest of server info
            addressOrIp = addressOrIp.substring(position + '://'.length);
        }
        // get rid of any trailing '/'
        let len = addressOrIp.length;
        if (len > 0) {
            // the first one could be a '/', e.g. file protocol
            for (let p=len-1;p>0;p--)
                // we stop, if the last one is not a '/'
                if (addressOrIp.charAt(p) !== '/') break;
                else addressOrIp = addressOrIp.substring(0,p);
        }

        // what we have left is the rest of the address as given and, for now, we shall
        // be satisfied with that and not conduct any more checks
        ret['server'] = addressOrIp;
        ret['full'] = ret['protocol'] + "://" + ret['server'];

        return ret;
    } catch(error) {
        return null;
    }
}

/**
 * Checks whether we have a same origin request by checking a given server info
 * object against the present window.location. The server info has to come in that form:
 * <p>A word of caution: this will not handle redirects.</p>
 *
 * <pre>
 *  {"protocol" : "http", "server" : "some.address", full: "http://some.address"}
 *</pre>
 *
 * @static
 * @function
 * @param {Object} server the server info object
 * @return {boolean} true if we are same origin, false otherwise
 */
export function isSameOrigin(server) {
    if (typeof(server) !== 'object' ||
        typeof(server['protocol']) !== "string" ||
        typeof(server['server']) !== "string" ||
        typeof(server['full']) !== "string") return false;

    if (server["full"] === "") // relative addresses will always be same origin
        return true;

    let browserServerInformation = "";
    if (window.location.protocol === 'file:')
        browserServerInformation = window.location.href;
    else
        browserServerInformation =
            window.location.protocol + "//" + window.location.host;

    // just to be absolutely paranoid, lower case everything before comparison
    browserServerInformation = browserServerInformation.toLowerCase();
    let ourServer = server['full'].toLowerCase();
    if (browserServerInformation === ourServer) return true; // we are exactly the same

    return false;
}

/**
 * Sends an ajax request, based on the handed in settings.
 * The only mandatory options are:
 * <ul>
 *  <li> server (the server info: name/address incl. protocol)</li>
 *  <li> uri (the uri after the server part)</li>
 * </ul>
 *
 *
 * Optional settings:
 *  <ul>
 *      <li>method (the HTTP method), default: 'GET'</li>
 *      <li>jsonp (a hint for cross domain request and json), default: false</li>
 *      <li>headers (some custom request headers in {key: value} notation), defaults: {}</li>
 *      <li>content (here goes the 'POST' data), defaults: null</li>
 *      <li>timeout (request timeout in milliseconds), defaults: 30 * 1000</li>
 *      <li>success (a success handler with signature: function(data){}),
 *          defaults: function(data) {console.info(data)}</li>
 *      <li>error (an error handler with signature: function(error){}),
 *          defaults: function(error) {console.error(error)}</li>
 *  </ul>
 *
 * <pre>
 *  ome.ol3.Net.sendRequest({server: 'http://localhost', uri: '/someServerUrl',
 *      success: function(data){// do something with response}});
 *</pre>
 *
 * @static
 * @function
 * @param {Object} parameters the request settings
 * @param {function=} context an optional context for the handlers
 */
export function sendRequest(parameters, context) {
    let params = parameters || {};
    if (typeof params !== 'object' || params === null)
        console.error("sendRequest did not receive a params object");

    // the mandatory parameters
    // the server can be accepted as either string or ready server object
    let server = params['server'] || "";
    if (typeof(server) === 'string')
        server = checkAndSanitizeServerAddress(server);
    if (typeof server !== 'object' || server === null)
        console.error("sendRequest server info is invalid");

    let uri = params.uri || "";
    if (typeof uri !== 'string')
        console.error("sendRequest uri parameter has to be a string");

    uri = checkAndSanitizeUri(uri);
    if (typeof uri !== 'object' || uri === null)
        console.error("sendRequest uri parameter is invalid");

    // optional parameters
    let method = (typeof(params['method']) === 'string') ?
        params['method'].toUpperCase() : "GET";
    let jsonp = (typeof(params['jsonp']) === 'boolean') ?
        params['jsonp'] : false;
    let headers = (typeof(params['headers']) === 'object') ?
        params['headers'] : {};
    let content = (typeof(params['content']) === 'string') ?
        params['content'] : null;
    let timeout =  (typeof(params['timeout']) === 'number') ?
        params['timeout'] : 60 * 1000;
    let success =  (typeof(params['success']) === 'function') ?
        params['success'] : function(data) {};
    let error =  (typeof(params['error']) === 'function') ?
        params['error'] : function(error) {console.error(error);};

    // let's check if we are same origin or not.
    if (isSameOrigin(server)) {
        sendSameOrigin(
            server, uri, success, error, method, headers,
            timeout, content, context);
        return;
    }

    // seems we are cross-domain ... we have two choices => CORS or jsonp
    // we force jsonp (well supported)
    jsonp = true; // This line is intentional.
    sendJsonp(server, uri, success, error, context);
    return;
}

/**
 * Checks the request parameters and fails on asserts if they are invalid
 *
 * @private
 * @static
 * @function
 *
 * @param {boolean} is_jsonp_request flag that conducts different checks for jsonp
 * @param {Object} server the server info as an object
 * @param {Object} uri the uri info as an object
 * @param {function} success the success handler
 * @param {function} error the error handler
 * @param {string} method the method as a string
 * @param {Object} headers the headers info as an object
 * @param {number} timeout the timeout in millis
 * @param {string=} content optional POST content
 */
export function checkRequestParameters(
    is_jsonp_request, server, uri,  success, error,
    method, headers, timeout, content) {

    if (typeof is_jsonp_request !== 'boolean')
        console.error("this method needs the is_jsonp_request flag as first argument!");
    if (typeof server !== 'object' || server === null)
        console.error("sendRequest server parameter has to be an object");
    if (typeof server['full'] !== 'string')
        console.error("sendRequest server parameter has to have the fully qualified server name");
    if (typeof uri !== 'object' || uri === null)
        console.error("sendRequest uri parameter has to be an object");
    if (typeof uri['query'] !== 'string' || typeof uri['full'] !== 'string')
        console.error("sendRequest uri parameter has to have the fully qualified uri");
    if (typeof success !== 'function' || typeof error !== 'function')
        console.error("sendRequest success/error handlers have to be functions");

    if (is_jsonp_request) return; // no more cheks for a jsonp request

    if (typeof method !== 'string')
        console.error("sendRequest method has to be a string");
    if (typeof headers !== 'object' || headers === null)
        console.error("sendRequest header parameter has to be an object");
    if (typeof timeout !== 'number')
        console.error("sendRequest timeout has to be a number");

    if (typeof(content) !== 'undefined' && content !== null) {
        if (typeof content !== 'string')
            console.error("sendRequest post content has to be a string");
    }
}

/**
 * Sends an ajax request the good old-fashioned way - useded internally!
 *<p>NOTE: Use [sendRequest]{@link ome.ol3.utils#sendRequest} instead!</p
 *
 * @private
 * @static
 * @function
 * @param {Object} server the server info as an object
 * @param {Object} uri the uri info as an object
 * @param {function} success the success handler
 * @param {function} error the error handler
 * @param {string} method the method as a string
 * @param {Object} headers the headers info as an object
 * @param {number} timeout the timeout in millis
 * @param {string} content optional POST content
 * @param {function=} context an optional context for the handlers
 */
export function sendSameOrigin(
    server, uri, success, error, method, headers, timeout, content, context) {

    checkRequestParameters( // preliminary asserts
        false, server, uri, success, error, method, headers, timeout, content);

    // create xhr object
    let xhr = typeof(window.XMLHttpRequest) !== 'undefined' ?
        new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

    // assemble the url from server and uri info
    let url = server['full'] === "" &&  uri['relative'] ? uri['full'] :
        server['full'] + "/" + uri['full'];
    let timestamp = '_=' + new Date().getTime();
    if (uri['query'] === "") url += "/?" + timestamp; // to avoid redirects
    else url += "&" + timestamp;
    xhr.open(method, url, true);

    for (let h in headers) // add headers (if there)
        xhr.setRequestHeader(h, headers[h]);

    xhr.timeout = timeout; // timeout
    xhr.ontimeout = function() { console.error("xhr request timed out!");};

    xhr.onerror = function(error) { // error
        let errorText =
            typeof(error.target) != 'undefined' ?
                error.target.responseText : null;
        let errorMessage =
            (errorText === null) ?
                "xhr: an error occured" : ("xhr error: " + errorText);
        console.error(errorMessage);
    };

    xhr.onreadystatechange = function(event) { // 'success'
        if (xhr.readyState == 4 && xhr.status >= 200 && xhr.status < 300) {
            let content = xhr['responseText'];
            if (typeof(content) === 'undefined') content = null;
            if (content !== null) {
                // check the case of a login redirect
                let pattern = 'webclient/login/?url=';
                let hasResponseUrl = typeof(xhr['responseURL']) === 'string';
                let index = hasResponseUrl ?
                    xhr['responseURL'].lastIndexOf(pattern) :
                    xhr['responseText'].lastIndexOf(pattern);

                if (index !== -1) {
                    let part1ofRedirect = pattern;
                    let part2ofRedirect = window['location']['href'];
                    if (hasResponseUrl)
                        part1ofRedirect =
                            xhr['responseURL'].substring(0, index + pattern.length);
                    window['location']['href'] = part1ofRedirect + part2ofRedirect;
                    return true;
                }
                if (context) success.call(context,content);
                else success(content);
            } else {
                if (context) error.call(context, xhr.statusText);
                else error(xhr.statusText);
            }
            return true;
        }
        if (xhr.readyState == 4 ) {
            if (context) error.call(context, xhr.statusText);
            else error(xhr.statusText);
            return true;
        }
        return false;
    };

    // fire off request
    xhr.send(method === 'POST' ? content : null);
}

/**
 * Redirects to another domain for login to then be redirected and able
 * to make more requests cross-domain with a working session
 *
 * @private
 * @static
 * @function
 * @param {Object} server the server info as an object
 */
export function makeCrossDomainLoginRedirect(server) {
    if (typeof(server) !== 'object' || typeof(server['full']) !== 'string')
        return;

    // that's where we'd like to come back to after redirect
    let oldHref = window.location.href;
    // check if out old href had a query string in it, then we need to append our
    // own flag to be returned to us
    let appendFlagWithAmpersand = false;
    if (oldHref.indexOf("?") !== -1)
        appendFlagWithAmpersand = true;

    let newLocation =
        server['full'] + "/webclient/login/?url=" + oldHref;
    // we append the flag to know that we have been there
    if (appendFlagWithAmpersand)
        newLocation += "&";
    else newLocation += "?";

    window.location.href = newLocation + "haveMadeCrossOriginLogin_";
}

/**
 * Sends an ajax request using jsonp - useded internally!
 *<p>NOTE: Use [sendRequest]{@link ome.ol3.utils#sendRequest} instead!</p
 *
 * @private
 * @static
 * @function
 * @param {Object} server the server info as an object
 * @param {Object} uri the uri info as an object
 * @param {function} success the success handler
 * @param {function} error the error handler
 * @param {function=} context an optional context for the handlers
 */
export function sendJsonp(server, uri, success, error, context) {
    // preliminary asserts
    checkRequestParameters(true, server, uri, success, error);

    // setup
    let head = document.head;
    let script = document.createElement("script");
    let callback = 'jsonpCallback_' + new Date().getTime();

    // tidy up
    let cleanUp = function() {
        delete window[callback];
        if (script) head.removeChild(script);
        script = null;
    };

    let timeout = setTimeout(function() {
        let err = "jsonp request ran into timeout";
        if (context) error.call(context, err);
        else error(err);
        cleanUp();
        console.error(err);
    }, 1000 * 90);

    // internal callback
    window[callback] = function(data) {
        try {
            clearTimeout(timeout);
            if (context) success.call(context, data);
            else success(data);
        } catch(anything) {
            if (context) error.call(context, anything);
            else error(anything);
        } finally {
            cleanUp();
        }
    }

    // error handler
    script.onerror = function(err) {
        clearTimeout(timeout);
        cleanUp();
        console.error("JSONP request failed!");
        if (context) error.call(context, error);
        else error(err);
    };

    try {
        // assemble url
        let url = server['full'] + '/' + uri['full'];
        if (uri['query'] == "") url += "/?";
        else url += "&";
        // 'fire' request
        script.src = url + "callback=" + callback;
        head.appendChild(script);
    } catch(anything) {
        clearTimeout(timeout);
        cleanUp();
        console.error("jsonp failed => " + anything);
    }
}
