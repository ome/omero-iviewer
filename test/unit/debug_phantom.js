/**
 * THIS IS NOT USED FOR THE UNIT TESTS OTHER THAN FOR DEBUGGING ON DEMAND!!!
 *
 * In particular phantomjs can be debugged by calling:
 *      phantomjs --debug=true debug_phantom.js
 *
 */
var page = require('webpage').create();

page.onError = function(msg, trace) {

  var msgStack = ['ERROR: ' + msg];

  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
    });
  }

  console.error(msgStack.join('\n'));

};

page.onConsoleMessage = function(msg) {
  console.log('The web page said: ' + msg);
};

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
page.settings.webSecurityEnabled = false;
page.settings.localToRemoteUrlAccessEnabled = true;

page.open('test/unit/suite.html', function(status) {
  phantom.exit();
});
