import gulp from 'gulp';
import del from 'del';
import webpack from 'webpack';
import { CLIOptions, Configuration } from 'aurelia-cli';

import project from '../aurelia.json';
import webpackConfig from '../../webpack.omero';
import configureEnvironment from './environment';

const analyze = CLIOptions.hasFlag('analyze');
const buildOptions = new Configuration(project.build.options);
const production = CLIOptions.getEnvironment() === 'prod';
const server = buildOptions.isApplicable('server');
const extractCss = buildOptions.isApplicable('extractCss');
const coverage = buildOptions.isApplicable('coverage');

const config = webpackConfig({
  production, server, extractCss, coverage, analyze
});
const compiler = webpack(config);

function clearDist() {
  return del([config.output.path]);
}

function buildWebpack(done) {
  if (CLIOptions.hasFlag('watch')) {
    compiler.watch({}, onBuild);
  } else {
    compiler.run(onBuild);
    compiler.plugin('done', () => done());
  }
}

function onBuild(err, stats) {
  if (!CLIOptions.hasFlag('watch') && err) {
    console.error(err.stack || err);
    if (err.details) console.error(err.details);
    process.exit(1);
  } else {
    process.stdout.write(stats.toString({ colors: require('supports-color') }) + '\n');

    if (!CLIOptions.hasFlag('watch') && stats.hasErrors()) {
      process.exit(1);
    }
  }
}

// function runAntBuild() {
//   const exec = require('child_process').exec;
//   exec('ant', function(err, stdout, stderr) {
//     console.log(stdout);
//     console.log(stderr);
//     console.error(err.stack || err);
//   });
// }

const build = gulp.series(
  // runAntBuild,
  clearDist,
  configureEnvironment,
  buildWebpack
);

export {
  config,
  build as default
};
