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
var Gulpssh = require('gulp-ssh');
var fs = require("fs");

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

gulp.task("deploy", function() {
	var gulpssh = new Gulpssh({ 
		ignoreErrors: false,
		sshConfig: {
			host: "my.open.co.za",
			username: "root",
			port: 22,
			privateKey: fs.readFileSync("/Users/jason/.ssh/id_rsa")
		}
	});
	return gulpssh
		.shell([
			"cd /var/www/dear-reader", "git pull", "npm install --production --silent --color=false -p --progress=false", "gulp js", "supervisorctl restart dear-reader"
		])
		.pipe(gulp.dest('logs'))
		.pipe(notify({ message: "Deployed Production" }));
});

gulp.task('default', ['js', 'css']);