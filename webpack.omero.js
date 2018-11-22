const webpackConfig = require('./webpack.config');
const {ProvidePlugin} = require('webpack');

module.exports = ({production, server, extractCss, coverage, analyze, karma} = {}) => {
  // We want css to be extracted to separate file
  extractCss = true;

  // This is the default aurelia config
  let config = webpackConfig({
    production, server, extractCss, coverage, analyze, karma
  });
  config.output.publicPath = "";
  config.output.filename = '[name].js';
  config.output.sourceMapFilename = '[name].map';
  config.output.chunkFilename = '[name].chunk.js';
  config.resolve.modules.push('libs');
  config.module.rules = config.module.rules.map(x => {
    if (x.loader && (x.loader === 'url-loader' || x.loader === 'file-loader')) {
      if (!x.options) {
        x.options = {};
      }

      if (x.test.source === /\.(png|gif|jpg|cur)$/i.source) {
        x.loader = 'file-loader';
        x.options.outputPath = 'images';
      } else {
        x.options.outputPath = 'fonts';
      }
      x.options.name = '[name].[ext]';
    }
    return x;
  });
  let providePlugin = new ProvidePlugin({
    'Promise': 'bluebird',
    $: 'jquery',
    jQuery: 'jquery',
    'window.jQuery': 'jquery'
  });
  config.plugins.splice(
    config.plugins.findIndex(
      p => p.constructor.name === ProvidePlugin.name),
    1, providePlugin);
  return config;
};
