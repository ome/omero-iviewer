/*
 * Tests cluster type
 */
describe("Cluster", function() {

	it('createClusterFeature', function() {
		var features = [];
		features.push(new ol.Feature(
			{geometry: new ome.ol3.geom.Rectangle(10, 20, 50, 30)}));
		features.push(new ol.Feature(
			{geometry: new ol.geom.Circle([50, 50], 20)}));

		var cluster =
			new ome.ol3.feature.Cluster([0, -100, 200,100], features);

		assert.instanceOf(cluster, ome.ol3.feature.Cluster);
		for (var f in features)
			assert(ol.extent.containsExtent(
				cluster.getBBox(),
				features[f].getGeometry().getExtent()));
	});

});
