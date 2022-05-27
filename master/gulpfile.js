var args = require('yargs').argv,
    path = require('path'),
    gulp = require('gulp'),
    $ = require('gulp-load-plugins')(),
    gulpsync = $.sync(gulp),
    browserSync = require('browser-sync'),
    reload = browserSync.reload,
    PluginError = $.util.PluginError,
    del = require('del'),
    karmaServer = require('karma').Server,
    protractor = $.protractor.protractor,
    webdriver = $.protractor.webdriver,
    express = require('express');

var babel = require("gulp-babel");

var cacheBuster = require('gulp-cache-bust');


// production mode (see build task)
var isProduction = false;
// styles sourcemaps
var useSourceMaps = false;

// Switch to sass mode.
// Example:
//    gulp --usesass
//var useSass = args.usesass;
var useSass = true;

// Angular template cache
// Example:
//    gulp --usecache
var useCache = args.usecache;

// ignore everything that begins with underscore
var hidden_files = '**/_*.*';
var ignored_files = '!' + hidden_files;

// MAIN PATHS
var paths = {
    app: '../app/',
    markup: 'jade/',
	html: 'html/',
    styles: 'less/',
    scripts: 'js/'
}

// if sass -> switch to sass folder
if (useSass) {
    log('Using SASS stylesheets...');
    paths.styles = 'sass/';
}


// VENDOR CONFIG
var vendor = {
    // vendor scripts required to start the app
    base: {
        source: require('./vendor.base.json'),
        js: 'base.js',
        css: 'base.css'
    },
    // vendor scripts to make the app work. Usually via lazy loading
    app: {
        source: require('./vendor.json'),
        dest: '../vendor'
    }
};


// SOURCES CONFIG
var source = {
    scripts: [paths.scripts + 'app.module.js',
        // template modules
        paths.scripts + 'modules/**/*.module.js',
        paths.scripts + 'modules/**/*.js',
        // custom modules
        paths.scripts + 'custom/**/*.module.js',
        paths.scripts + 'custom/**/*.js'
    ],
	templatesHTML: {
		index: [paths.html + 'index.*'],
		views: [paths.html + '**/*.*', '!' + paths.html + 'index.*'],
        pages: [paths.html + '**/*.html']
	},
    styles: {
        app: [paths.styles + '*.*'],
        themes: [paths.styles + 'themes/*'],
        watch: [paths.styles + '**/*', '!' + paths.styles + 'themes/*']
    }
};

// BUILD TARGET CONFIG
var build = {
    scripts: paths.app + 'js',
    styles: paths.app + 'css',
    templates: {
        index: '../',
        views: paths.app,
        cache: paths.app + 'js/' + 'templates.js',
    }
};

// PLUGINS OPTIONS

var prettifyOpts = {
    indent_char: ' ',
    indent_size: 3,
    unformatted: ['a', 'sub', 'sup', 'b', 'i', 'u', 'pre', 'code']
};

var vendorUglifyOpts = {
    mangle: {
        except: ['$super'] // rickshaw requires this
    }
};

var tplCacheOptions = {
    root: 'app',
    filename: 'templates.js',
    //standalone: true,
    module: 'app.core',
    base: function(file) {
        return file.path.split('jade')[1];
    }
};

var injectOptions = {
    name: 'templates',
    transform: function(filepath) {
        return 'script(src=\'' +
            filepath.substr(filepath.indexOf('app')) +
            '\')';
    }
}

var cssnanoOpts = {
    safe: true,
    discardUnused: false, // no remove @font-face
    reduceIdents: false // no change on @keyframes names
}

//---------------
// TASKS
//---------------


// --------------------------------------- Default Gulp Task
gulp.task('ze', async function(){
    console.log("It's working!");
});



// Build the base script to start the application from vendor assets
gulp.task('vendor:base', function() {
    log('==[vendor:base] Copying base vendor assets..');

    var jsFilter = $.filter('**/*.js', {
        restore: true
    });
    var cssFilter = $.filter('**/*.css', {
        restore: true
    });

    return gulp.src(vendor.base.source)
        .pipe($.expectFile(vendor.base.source))
        .pipe(jsFilter)
            .pipe($.concat(vendor.base.js))
            .pipe($.if(isProduction, $.uglify()))
            .pipe(gulp.dest(build.scripts))
        .pipe(jsFilter.restore)
        .pipe(cssFilter)
            .pipe($.concat(vendor.base.css))
            .pipe($.if(isProduction, $.cssnano(cssnanoOpts)))
            .pipe(gulp.dest(build.styles))
        .pipe(cssFilter.restore)
        ;
});

// copy file from bower folder into the app vendor folder
gulp.task('vendor:app', function() {
    log('Copying vendor assets..');

    var jsFilter = $.filter('**/*.js', {
        restore: true
    });
    var cssFilter = $.filter('**/*.css', {
        restore: true
    });

    return gulp.src(vendor.app.source, {
            base: 'bower_components'
        })
        .pipe($.expectFile(vendor.app.source))
        .pipe(jsFilter)
        .pipe($.if(isProduction, $.uglify(vendorUglifyOpts)))
        .pipe(jsFilter.restore)
        .pipe(cssFilter)
        .pipe($.if(isProduction, $.cssnano(cssnanoOpts)))
        .pipe(cssFilter.restore)
        .pipe(gulp.dest(vendor.app.dest));

});

// VENDOR BUILD
gulp.task('vendor', gulp.series('vendor:base', 'vendor:app'));


// JS APP
gulp.task('scripts:app', function() {
    log('Building scripts..');
    // Minify and copy all JavaScript (except vendor scripts)
    return gulp.src(source.scripts)
        .pipe($.jsvalidate())
        .on('error', handleError)
        .pipe($.if(useSourceMaps, $.sourcemaps.init()))
        .pipe(babel())
        .pipe($.concat('app.js'))
        .pipe($.ngAnnotate())
        .on('error', handleError)
        .pipe($.if(isProduction, $.uglify({
            preserveComments: 'some'
        })))
        .on('error', handleError)
        .pipe($.if(useSourceMaps, $.sourcemaps.write()))
        .pipe(gulp.dest(build.scripts))
        .pipe(reload({
            stream: true
        }));
});

// APP LESS
gulp.task('styles:app', function() {
    log('Building application styles..');
    return gulp.src(source.styles.app)
        .pipe($.if(useSourceMaps, $.sourcemaps.init()))
        .pipe(useSass ? $.sass() : $.less())
        .on('error', handleError)
        .pipe($.if(isProduction, $.cssnano(cssnanoOpts)))
        .pipe($.if(useSourceMaps, $.sourcemaps.write()))
        .pipe(gulp.dest(build.styles))
        .pipe(reload({
            stream: true
        }));
});

// APP RTL
gulp.task('styles:app:rtl', function() {
    log('Building application RTL styles..');
    return gulp.src(source.styles.app)
        .pipe($.if(useSourceMaps, $.sourcemaps.init()))
        .pipe(useSass ? $.sass() : $.less())
        .on('error', handleError)
        .pipe($.rtlcss()) /* RTL Magic ! */
        .pipe($.if(isProduction, $.cssnano(cssnanoOpts)))
        .pipe($.if(useSourceMaps, $.sourcemaps.write()))
        .pipe($.rename(function(path) {
            path.basename += "-rtl";
            return path;
        }))
        .pipe(gulp.dest(build.styles))
        .pipe(reload({
            stream: true
        }));
});

// LESS THEMES
gulp.task('styles:themes', function() {
    log('Building application theme styles..');
    return gulp.src(source.styles.themes)
        .pipe(useSass ? $.sass() : $.less())
        .on('error', handleError)
        .pipe(gulp.dest(build.styles))
        .pipe(reload({
            stream: true
        }));
});

//MY Copy HTML files
gulp.task('templatesHTML:views', function() {
    log('Copying HTML VIEWS files....4.0');
	return gulp.src(source.templatesHTML.views)
				.pipe(gulp.dest(build.templates.views))
				.pipe(reload({
					stream: true
				}));
});

gulp.task('templatesHTML:index', gulp.series('templatesHTML:views', function() {
    log('Copying HTML PAGES files.........4.0');
	return gulp.src(source.templatesHTML.index)
				.pipe(gulp.dest(build.templates.index));
}));

gulp.task('templatesHTML:pages', function() {
    log('Copying HTML PAGES files............4.0');
    return gulp.src(source.templatesHTML.pages)
                .pipe(gulp.dest(build.templates.pages))
				.pipe(reload({ 	stream: true }));
});

gulp.task('prod', function() {
    log('Starting production build...');
    isProduction = true;
    return Promise.resolve('the value is ignored');
});

gulp.task('assets', gulp.parallel(
    'scripts:app',
    'styles:app',
    'styles:app:rtl',
    'styles:themes',
    // 'templates:index',
    // 'templates:views',
	'templatesHTML:index',
   'templatesHTML:views'
));


gulp.task('cachebust', function() {
    log('WORKING cachebust!!!');

    var src = build.templates.index + 'index.html';

    gulp.src(src)
        .pipe(cacheBuster({
            type: 'timestamp'
        }))
        .pipe(gulp.dest(build.templates.index));

    return Promise.resolve('the value is ignored');

});


// Serve files with auto reaload
gulp.task('browsersync', function() {
    log('Starting BrowserSync..');
    browserSync({
        notify: false,
        port: 3010,
        server: {
            baseDir: '..'
        }
    });
});

// // lint javascript
// gulp.task('lint', function() {
//     return gulp
//         .src(source.scripts)
//         .pipe($.jshint())
//         .pipe($.jshint.reporter('jshint-stylish', {
//             verbose: true
//         }))
//         .pipe($.jshint.reporter('fail'));
// });

// Remove all files from the build paths
gulp.task('clean', function(done) {
    var delconfig = [].concat(
        build.styles,
        build.scripts,
        build.templates.index + 'index.html',
        build.templates.views + 'views',
        build.templates.views + 'pages',
        vendor.app.dest
    );

    log('Cleaning: ' + $.util.colors.blue(delconfig));
    // force: clean files outside current directory
    del(delconfig, {
        force: true
    }).then(function() { done(); });
});

// //---------------
// // MAIN TASKS
// //---------------

// build for production (minify)
gulp.task('build', gulp.series(
    'prod',
    'vendor',
    'assets',
    'cachebust'
));

//---------------
// WATCH
//---------------

// Rerun the task when a file changes
gulp.task('watch', function() {
    log('Watching source files..');

    gulp.watch(source.scripts, gulp.series('scripts:app'));
    gulp.watch(source.styles.watch, gulp.series('styles:app', 'styles:app:rtl'));
    gulp.watch(source.styles.themes, gulp.series('styles:themes'));
    //gulp.watch(source.templates.views, ['templates:views']);
    //gulp.watch(source.templates.index, ['templates:index']);
	gulp.watch(source.templatesHTML.views, gulp.series('templatesHTML:views'));         //JADE
    gulp.watch(source.templatesHTML.index, gulp.series('templatesHTML:index'));
    return Promise.resolve('the value is ignored');

});

//gulp.task('babel');


// default (no minify)
//gulp.task('default', gulp.series('vendor','assets','watch','babel'));
gulp.task('default', gulp.parallel('vendor','assets','watch'));


// Server for development
gulp.task('serve', gulp.series('default','browsersync'), done);

// // Server for production
// gulp.task('serve-prod', gulpsync.sync(gulp.series('build','browsersync')), done);

// // build with sourcemaps (no minify)
// gulp.task('sourcemaps', gulp.series('usesources', 'default'));
// gulp.task('usesources', function() {
//     useSourceMaps = true;
// });





// /// Testing tasks

// gulp.task('test:unit', function(done) {
//     startKarmaTests(true, done);
// });

// gulp.task('webdriver', webdriver);
// gulp.task('test:e2e', gulp.series('webdriver', function(cb) {

//     var testFiles = gulp.src('test/e2e/**/*.js');

//     testServer({
//         port: '4444',
//         dir: './app/'
//     }).then(function(server) {
//         testFiles.pipe(protractor({
//             configFile: 'tests/protractor.conf.js',
//         })).on('error', function(err) {
//             // Make sure failed tests cause gulp to exit non-zero
//             throw err;
//         }).on('end', function() {
//             server.close(cb)
//         });
//     });

// }));

// gulp.task('test', gulp.series('test:unit', 'test:e2e'))

// /////////////////////

function done() {
    log('************');
    log('* All Done * You can start editing your code, BrowserSync will update your browser after any change..');
    log('************');
}

// Error handler
function handleError(err) {
    log(err.toString());
    this.emit('end');
}

// log to console using
function log(msg) {
    $.util.log($.util.colors.blue(msg));
}

function testServer(params) {

    var app = express();

    app.use(express.static(params.dir));

    return new Promise(function(res, rej) {
        var server = app.listen(params.port, function() {
            res(server)
        });
    });
}

function startKarmaTests(singleRun, done) {

    var excludeFiles = [];

    var server = new karmaServer({
        configFile: __dirname + '/tests/karma.conf.js',
        exclude: excludeFiles,
        singleRun: !!singleRun
    }, karmaCompleted);

    server.start();

    ////////////////

    function karmaCompleted(karmaResult) {
        log('Karma completed');

        if (karmaResult === 1) {
            done('\n********************************'+
                 '\nkarma: tests failed with code ' + karmaResult +
                 '\n********************************');
        } else {
            done();
        }
    }
}