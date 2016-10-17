goog.provide('ome.ol3.feature.Cluster');

goog.require('ol.Feature');

/**
 * @classdesc
 * Cluster is a subclasss of feature that contains features itself and can be
 * styled flexibly with either styles, icons, geometries or a combination
 * thereof
 * <p>NOTE: The Cluster can be created straight away or initialized later:
 * {@link ome.ol3.feature.Cluster.initializeCluster}. If not initialzed it will remain
 * a useless empty container.</p>
 *
 * @constructor
 * @extends {ol.Feature}
 *
 */
ome.ol3.feature.Cluster = function(bbox, features) {
	goog.base(this); //call super

	/**
	 * the bbox of the cluster
	 * @private
	 * @type {Array.<number>}
	 */
	this.bbox_ = null;

	/**
	 * The features in the cluster
	 * @private
	 * @type {Array.<ol.Feature>}
	 */
	this.features_ = null;

    /**
	 * visibility of the cluster is always true
	 * @private
	 * @type {boolean}
	 */
    this.visible = true;

	// either both or none parameters have to be present
	// in order to do the initialization straight away
	if (typeof(bbox) !== 'undefined' && typeof(features) !== 'undefined')
		this.initializeCluster(bbox, features, true);
}
goog.inherits(ome.ol3.feature.Cluster, ol.Feature);

/**
 * Initializes the cluster instance
 * We'd like to be able to do it this way and not necessarily in the constructor
 * for efficiciency reasons
 * @param {Array.<number>} bbox the extent of the cluster
 * @param {Array.<ol.Feature>} features an array of features making up that cluster
 * @param {boolean=} set_cluster_reference for all features default: false
 */
ome.ol3.feature.Cluster.prototype.initializeCluster =
	function(bbox, features, set_cluster_reference) {
	if (!ome.ol3.utils.Misc.isArray(bbox) || bbox.length !== 4)
        console.error("Cluster has to have a proper bounding box array!");
    if (!ome.ol3.utils.Misc.isArray(features) || features.length < 1)
	   console.error("Cluster features have to be a non-empty array!");

	this.bbox_ = bbox;
	this.features_ = features;
	set_cluster_reference =
		typeof(set_cluster_reference) === 'boolean' ? set_cluster_reference : false;
	if (set_cluster_reference)
		for (var f in this.features_)
			this.features_[f]['cluster'] = this;

	// for now we represent clusters with a circle
	var clusterCircle = new ol.geom.Circle(ol.extent.getCenter(this.bbox_), 10);
	// we need a clusterCircle that can be translated...
	clusterCircle.translate = function(deltaX, deltaY) {
		// first translate ourselves, then every feature we contain
		ol.geom.SimpleGeometry.prototype.translate.call(this, deltaX, deltaY);
		for (var f in features)
			features[f].getGeometry().translate(deltaX, deltaY);
    this.changed();
  };
	this.setGeometry(clusterCircle);

	// we put a yellow style on it
	var style = new  ol.style.Style(
		{
			fill: new ol.style.Fill({color: 'rgba(255,255,0,0.25)'}),
			stroke : new ol.style.Stroke({color: 'rgba(255,255,0, 1)'}),
			text : new ol.style.Text({
				font : "normal 12px arial",
				stroke : new ol.style.Stroke({color: 'rgba(255,255,0, 1)'}),
				text : "" + this.features_.length
			})
		});
	this.setStyle(style);
};

/**
 * Returns bbox for cluster
 * @return {ol.Extent} the extent of the cluster
 */
ome.ol3.feature.Cluster.prototype.getBBox = function() {
	return this.bbox_;
};
