/*
 * Tests utility routines in ome.ol3.utils.Net
 */
describe("Net", function() {

	it('checkAndSanitizeServerAddress', function() {
		var sanitizedAddress =
			ome.ol3.utils.Net.checkAndSanitizeServerAddress("www.blablab.at");

		expect(sanitizedAddress['protocol']).to.eql("http");
		expect(sanitizedAddress['server']).to.eql("www.blablab.at");
		expect(sanitizedAddress['full']).to.eql("http://www.blablab.at");

		sanitizedAddress =
			ome.ol3.utils.Net.checkAndSanitizeServerAddress("https://demo.openmicroscopy.org/web");

		expect(sanitizedAddress['protocol']).to.eql("https");
		expect(sanitizedAddress['server']).to.eql("demo.openmicroscopy.org/web");
		expect(sanitizedAddress['full']).to.eql("https://demo.openmicroscopy.org/web");

		sanitizedAddress =
			ome.ol3.utils.Net.checkAndSanitizeServerAddress("127.0.0.1/myproxy");

		expect(sanitizedAddress['protocol']).to.eql("http");
		expect(sanitizedAddress['server']).to.eql("127.0.0.1/myproxy");
		expect(sanitizedAddress['full']).to.eql("http://127.0.0.1/myproxy");
	});

	it('checkAndSanitizeUri', function() {
		var sanitizedUri =
			ome.ol3.utils.Net.checkAndSanitizeUri("////some_path/even_longer/?query=SHDHDF&bla=what");

		expect(sanitizedUri['path']).to.eql("some_path/even_longer");
		expect(sanitizedUri['query']).to.eql("query=SHDHDF&bla=what");
		expect(sanitizedUri['full']).to.eql("some_path/even_longer/?query=SHDHDF&bla=what");
		expect(sanitizedUri['relative']).to.eql(false);

		sanitizedUri =
			ome.ol3.utils.Net.checkAndSanitizeUri("some_relative/dataset/1/");

		expect(sanitizedUri['path']).to.eql("some_relative/dataset/1");
		expect(sanitizedUri['query']).to.eql("");
		expect(sanitizedUri['full']).to.eql("some_relative/dataset/1");
		expect(sanitizedUri['relative']).to.eql(true);
	});

});
