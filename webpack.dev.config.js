var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var AureliaWebpackPlugin = require('aurelia-webpack-plugin');
var ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
  devServer: {
    host: 'localhost',
    port: 3000
  },
  entry: {
    main: [
      './src/main.js'
    ]
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js'
  },
  plugins: [
    new AureliaWebpackPlugin({nameExternalModules: false}),
    new HtmlWebpackPlugin({
      template : './src/index-dev.html',
      filename: 'index.html'
  }),
    new ProvidePlugin({
      Promise: 'bluebird',
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery'
    })
  ],
  module: {
    noParse: [/libs\/ol3-viewer.js$/],
    loaders: [
      { test: /\.js$/, loader: 'babel', exclude: /node_modules/,
        query: { compact: false,
            presets: ['es2015-loose', 'stage-1'],
            plugins: ['transform-decorators-legacy'] } },
      { test: /\.css?$/, loader: 'file?name=css/[name].[ext]' },
      { test: /\.(png|gif|jpg|jpeg)$/, loader: 'file?name=css/images/[name].[ext]' },
      { test: /\.html$/, loader: 'html' }
    ]
  }
};
