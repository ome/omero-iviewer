const path = require('path');
const {AureliaPlugin} = require('aurelia-webpack-plugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

module.exports = {
  entry: {
    main: './src/main',
    deps: ['d3', 'file-saver', 'text-encoding']
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: "[name].js"
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    },
  },
  performance: {
    hints: false
  },
  plugins: [
    new AureliaPlugin({
        aureliaApp: undefined,
        aureliaConfig: "basic",
        features: {svg: false}
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
    rules: [
        { test: /\.js$/, loader: 'babel-loader'},
        { test: /[\/\\]node_modules[\/\\]bluebird[\/\\].+\.js$/, loader: 'expose-loader?Promise' },
        { test: require.resolve('jquery'), loader: 'expose-loader?$!expose-loader?jQuery' },
        { test: /\.(png|gif|jpg|jpeg)$/, loader: 'file-loader?name=css/images/[name].[ext]' },
        { test: /\.(woff|woff2)$/, loader: 'file-loader?name=css/fonts/[name].[ext]' },
        { test: /\.css?$/, loader: 'file-loader?name=css/[name].[ext]' },
        { test: /\.html$/, loader: 'html-loader' }
    ]
  }
};
