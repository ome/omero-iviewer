const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {AureliaPlugin} = require('aurelia-webpack-plugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
  mode: "development",
  entry: {
    main: [
      './src/main'
    ]
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js'
  },
  performance: {
    hints: false
  },
  plugins: [
    new AureliaPlugin({
      aureliaApp: undefined,
      aureliaConfig: "basic",
      features: {svg: false}}),
    new ProvidePlugin({
        Promise: 'bluebird',
        $: 'jquery',
        jQuery: 'jquery',
        'window.jQuery': 'jquery'
    }),
    new HtmlWebpackPlugin({
      template : './src/index-dev.html',
      filename: 'index.html'
  })],
  resolve: {
      extensions: [".js"],
         modules: ["src", "node_modules"]
  },
  module: {
    rules: [
      { test: /\.js$/, use: {loader: 'babel-loader'}},
      { test: require.resolve('jquery'), use: {
        loader: 'expose-loader',
        options: {exposes: ["$", "jQuery"]}
      }},
      { test: /\.(png|gif|jpg|jpeg)$/, use: {loader: 'file-loader?name=css/images/[name].[ext]' }},
      { test: /\.(woff|woff2)$/, use: {loader: 'file-loader?name=css/fonts/[name].[ext]' }},
      { test: /\.css?$/, use: {loader: 'file-loader?name=css/[name].[ext]' }},
      { test: /\.html$/, use: {loader: 'html-loader' }}
    ]
  },
  devServer: {
    port: 8080,
    proxy: {
        '/iviewer': {
            target: 'http://127.0.0.1:4080'
        },
        '/api': {
            target: 'http://127.0.0.1:4080'
        },
        '/webgateway': {
            target: 'http://127.0.0.1:4080'
        },
        '/webclient': {
            target: 'http://127.0.0.1:4080'
        },
        '/static': {
            target: 'http://127.0.0.1:4080'
        }
    }
  }
};
