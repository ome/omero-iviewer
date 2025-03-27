module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    plugins: [
      require('karma-mocha'),
      require('karma-chai'),
      require('karma-chrome-launcher'),
      require('karma-spec-reporter'),
      require('karma-webpack'),
    ],
    files: [
      'test/unit/conversion.js',
      'test/unit/geometries.js',
      'test/unit/misc.js',
      'test/unit/net.js',
      'test/unit/regions.js',
      'test/unit/viewer.js',
    ],
    preprocessors: {
      'test/**/*.js': ['webpack']
    },
    webpack: {
      // minimal webpack config
      resolve: {
          extensions: [".js"],
             modules: ["src", "node_modules"]
      },
      module: {
        rules: [
          { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/}
        ]
      },
    },
    webpackMiddleware: {
      noInfo: true,
      // and use stats to turn off verbose output
      stats: {
        chunks: false
      }
    },
    exclude: ['test/unit/debug_mocha.js'],
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    autoWatch: false,
    concurrency: Infinity,
  })
  process.on('infrastructure_error', (error) => {
      console.error('infrastructure_error', error);
  })
}
