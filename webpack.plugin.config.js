const path = require('path');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
  entry: {
    main: [
      './src/viewers/viewer/Viewer.js'
    ]
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'ol-viewer.js',
    library: 'openlayers_viewer',
  },
  plugins: [
    new ProvidePlugin({
        Promise: 'bluebird',
    }),
  ],
  resolve: {
      extensions: [".js"],
         modules: ["src", "node_modules"]
  },
  module: {
    rules: [
      { test: /\.js$/, loader: 'babel-loader'}
    ]
  },
};
