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
  return gulp.src('src/*.js')
    .pipe(concat('all.js'))
    .pipe(uglify())
    .pipe(livereload())
    .pipe(gulp.dest('dist/'));
});

gulp.task('css', function() {
  return gulp.src('src/*.css')
    .pipe(concat('all.css'))
    .pipe(livereload())
    .pipe(gulp.dest('dist/'));
});

gulp.task('images', function() {
  return gulp.src('src/images/*.jpg')
    .pipe(livereload())
    .pipe(gulp.dest('dist/images'));
});

gulp.task('watch', function() {
  livereload.listen();
  gulp.watch([
    'src/*.js',
    'src/*.css',
    'src/images/*.jpg',
    'src/index.html',
    ], [
      'images',
      'css',
      'js',
      'copy-index',
      ]);
});

gulp.task('build', ['js', 'css', 'images', 'copy-index']);
gulp.task('default', ['watch']);
