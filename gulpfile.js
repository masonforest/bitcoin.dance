'use strict';

var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var livereload = require('gulp-livereload');

gulp.task('copy-index', function() {
  return gulp.src('src/index.html')
    .pipe(gulp.dest('dist/'));
});

gulp.task('js', function() {
  return gulp.src('src/js/*.js')
    .pipe(concat('all.js'))
    .pipe(uglify())
    .pipe(livereload())
    .pipe(gulp.dest('dist/'));
});

gulp.task('css', function() {
  return gulp.src('src/css/*.css')
    .pipe(concat('all.css'))
    .pipe(livereload())
    .pipe(gulp.dest('dist/'));
});

gulp.task('audio', function() {
  return gulp.src('src/audio/*.ogg')
    .pipe(gulp.dest('dist/audio'));
});

gulp.task('images', function() {
  return gulp.src('src/images/*')
    .pipe(gulp.dest('dist/images'));
});

gulp.task('watch', function() {
  livereload.listen();
  gulp.watch([
    'src/js/*.js',
    'src/css/*.css',
    'src/index.html',
    ], [
      'audio',
      'css',
      'js',
      'copy-index',
      ]);
});

gulp.task('build', ['js', 'css', 'audio', 'images', 'copy-index']);
gulp.task('default', ['build','watch']);
