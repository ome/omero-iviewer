import path from 'path';
import gulp from 'gulp';
import del from 'del';
import rename from 'gulp-rename';
import build, {config} from './build-plugin';
import project from '../aurelia.json';

const templatePath = path.join(
  project.iviewer.root,
  project.iviewer.templates
);
const staticPath = path.join(
  project.iviewer.root,
  project.iviewer.static
);

function copyStaticFiles() {
  return gulp.src([config.output.path + '/**/*', '!/**/*.js', '!/**/*.html'])
    .pipe(gulp.dest(staticPath));
}

function copyAppFile() {
  return gulp.src([config.output.path + '/app.js'])
    // .pipe(rename('app.js'))
    .pipe(gulp.dest(staticPath));
}

function copyVendorFile() {
  return gulp.src([config.output.path + '/vendor.js'])
    // .pipe(rename('vendor.js'))
    .pipe(gulp.dest(staticPath));
}

function copyOpenWith() {
  return gulp.src('src/openwith.js')
    .pipe(gulp.dest(staticPath));
}

function copyIndexHtml() {
  return gulp.src('src/index.html')
    .pipe(gulp.dest(templatePath));
}

function clearPlugin() {
  return del([staticPath, templatePath]);
}

const setupPlugin = gulp.series(
  build,
  clearPlugin,
  copyStaticFiles,
  copyAppFile,
  copyVendorFile,
  copyOpenWith,
  copyIndexHtml
);

export {
  setupPlugin as default
};
