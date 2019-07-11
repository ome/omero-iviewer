const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {AureliaPlugin} = require('aurelia-webpack-plugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
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
      { test: /\.js$/, loader: 'babel-loader'},
      { test: /[\/\\]node_modules[\/\\]bluebird[\/\\].+\.js$/, loader: 'expose-loader?Promise' },
      { test: require.resolve('jquery'), loader: 'expose-loader?$!expose-loader?jQuery' },
      { test: /\.(png|gif|jpg|jpeg)$/, loader: 'file-loader?name=css/images/[name].[ext]' },
      { test: /\.(woff|woff2)$/, loader: 'file-loader?name=css/fonts/[name].[ext]' },
      { test: /\.css?$/, loader: 'file-loader?name=css/[name].[ext]' },
      { test: /\.html$/, loader: 'html-loader' }
    ]
  },
  devServer: {
    port: 8080,
    proxy: {
        '/iviewer/**': {
            target: 'http://localhost:4080'
        },
        '/api/**': {
            target: 'http://localhost:4080'
        },
        '/webgateway/**': {
            target: 'http://localhost:4080'
        },
        '/webclient/**': {
            target: 'http://localhost:4080'
        },
        '/static/**': {
            target: 'http://localhost:4080'
        }
    }
  }
};
