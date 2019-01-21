const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {AureliaPlugin} = require('aurelia-webpack-plugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
  entry: {
    main: [
      './src/viewers/viewer/Viewer.js'
    ]
  },
  output: {
    path: path.join(__dirname, 'plugin', 'ol3-viewer', 'static', 'ol3-viewer', 'js'),
    filename: 'viewer.js',
    library: 'openlayers_viewer',
  },
  plugins: [
    // new AureliaPlugin({
    //   aureliaApp: undefined,
    //   aureliaConfig: "basic",
    //   features: {svg: false}}),
    new ProvidePlugin({
        Promise: 'bluebird',
        $: 'jquery',
        jQuery: 'jquery',
        'window.jQuery': 'jquery'
    }),
    // new HtmlWebpackPlugin({
    //   template : './src/index-dev.html',
    //   filename: 'index.html'
    // })
  ],
  resolve: {
      extensions: [".js"],
         modules: ["src", "node_modules"]
  },
  module: {
    rules: [
      { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/,
      query: { compact: false,
               presets: [[ 'env', {
                   "loose": true,
                   "uglify": process.env.NODE_ENV === 'production',
                   "modules": false,
                   "useBuiltIns": true } ]],
               plugins: ['transform-decorators-legacy',
                         'transform-class-properties'] } },
      { test: /[\/\\]node_modules[\/\\]bluebird[\/\\].+\.js$/, loader: 'expose-loader?Promise' },
      { test: require.resolve('jquery'), loader: 'expose-loader?$!expose-loader?jQuery' },
      { test: /\.(png|gif|jpg|jpeg)$/, loader: 'file-loader?name=css/images/[name].[ext]' },
      { test: /\.(woff|woff2)$/, loader: 'file-loader?name=css/fonts/[name].[ext]' },
      { test: /\.css?$/, loader: 'file-loader?name=css/[name].[ext]' },
      { test: /\.html$/, loader: 'html-loader' }
    ]
  },
};
