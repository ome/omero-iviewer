
describe("Viewer", function() {

  it('isNotUndefined', function() {
      var Viewer = openlayers_viewer.default;
      assert.notEqual(Viewer, undefined);
  });

  it('canBeCreatedWithNoId', function() {
    var Viewer = openlayers_viewer.default;
    var v = new Viewer();
    assert.equal(v.id_, -1);
  });

});
