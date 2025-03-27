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
  }
};
