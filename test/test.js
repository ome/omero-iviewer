
// This file is a webpack entry point so we can
// import from src
import Viewer from '../src/viewers/viewer/Viewer.js';

describe("Viewer", function() {

  it('isNotUndefined', function() {
      assert.notEqual(Viewer, undefined);
  });

  it('canBeCreatedWithNoId', function() {
    var v = new Viewer();
    assert.equal(v.id_, -1);
  });

});
