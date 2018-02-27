const path = require('path');
const {AureliaPlugin} = require('aurelia-webpack-plugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const pkg = require('./package.json');

module.exports = {
  entry: {
    main: './src/main',
    deps: ['d3', 'file-saver', 'text-encoding']
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: "[name].js"
  },
  plugins: [
    new AureliaPlugin({
        aureliaApp: undefined,
        aureliaConfig: "basic",
        features: {svg: false}}),
    new CommonsChunkPlugin({
        names: ['deps']
    }),
    new CommonsChunkPlugin({
        names: ['manifest'],
        filename: 'init.js',
        minChunks: Infinity
    }),
    new ProvidePlugin({
      Promise: 'bluebird',
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery'
    })],
  resolve: {
      extensions: [".js"],
      modules: ["src", "libs", "node_modules"]
  },
  module: {
    noParse: [/libs\/ol3-viewer.js$/],
    rules: [
        { test: /\.js$/, exclude: /node_modules/, use: [{
            loader: 'babel-loader',
            query: { compact: false,
                   presets: [[ 'env', {
                       "loose": true,
                       "uglify": process.env.NODE_ENV === 'production',
                       "modules": false,
                       "useBuiltIns": true } ]],
                   plugins: ['transform-decorators-legacy',
                             'transform-class-properties'] } },
            {loader: 'webpack-conditional-loader'}]},
        { test: /[\/\\]node_modules[\/\\]bluebird[\/\\].+\.js$/, loader: 'expose-loader?Promise' },
        { test: require.resolve('jquery'), loader: 'expose-loader?$!expose-loader?jQuery' },
        { test: /\.(png|gif|jpg|jpeg)$/, loader: 'file-loader?name=css/images/[name].[ext]' },
        { test: /\.(woff|woff2)$/, loader: 'file-loader?name=css/fonts/[name].[ext]' },
        { test: /\.html$/, loader: 'html-loader' }
    ]
  }
};
