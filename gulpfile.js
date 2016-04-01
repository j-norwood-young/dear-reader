var projectName = "dearreader";

var gulp = require('gulp');
var rename = require('gulp-rename');
var less = require('gulp-less');
// var notify = require('gulp-notify');
var watch = require('gulp-watch');
var prefix = require('gulp-autoprefixer');
var browserify = require('gulp-browserify');
var uglify = require('gulp-uglify');
var replace = require('gulp-replace');
var config = require("./config.js");

var jsInputDir = 'assets/js/**/*.js';
var lessInputDir = 'assets/less/**/*.less';

var lessInputFile = "assets/less/" + projectName + ".less";
var jsInputFile = "assets/js/" + projectName + ".js";

var cssOutputDir = "css/";
var jsOutputDir = "js/";

var buildDir = "public/";


gulp.task('css', function() {
	return gulp.src([lessInputFile])
		.pipe(less())
		.pipe(prefix({ cascade: true }))
		.pipe(rename(projectName + ".css"))
		.pipe(gulp.dest(buildDir + cssOutputDir));
});

gulp.task('js', function() {
	return gulp.src(jsInputFile)
		.pipe(browserify({ insertGlobals: true }))
		.pipe(replace('[url]', config.url))
		.pipe(rename(projectName + ".js"))
		.pipe(gulp.dest(buildDir + jsOutputDir))
		.pipe(uglify())
		.pipe(rename(projectName + ".min.js"))
		.pipe(gulp.dest(buildDir + jsOutputDir));
});

gulp.task('watch', function() {
	gulp.watch(jsInputDir, ['js']);
	gulp.watch(lessInputDir, ['css']);
});

gulp.task('default', ['js', 'css']);