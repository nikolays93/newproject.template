"use strict";

/**
 * Modules
 */
const glob = require('glob')
const merge = require('merge-stream')
const browserSync = require("browser-sync")
const yargs = require("yargs")
const smartgrid = require("smart-grid")

const gulp = {
    ...require("gulp"),
    if: require("gulp-if"),
    rename: require("gulp-rename"),
    replace: require("gulp-replace"),
    plumber: require("gulp-plumber"),
    debug: require("gulp-debug"),
    autoprefixer: require("gulp-autoprefixer"),
    sass: require("gulp-sass"),
    groupCssMediaQueries: require("gulp-group-css-media-queries"),
    cleanCss: require("gulp-clean-css"),
    newer: require("gulp-newer"),
    imagemin: require("gulp-imagemin"),
    // const sourcemaps = require("gulp-sourcemaps"),
    // const favicons = require("gulp-favicons"),
    // const svgSprite = require("gulp-svg-sprite"),
    // const webp = require("gulp-webp"),
}

const imagemin = {
    Pngquant: require("imagemin-pngquant"),
    Zopfli: require("imagemin-zopfli"),
    Mozjpeg: require("imagemin-mozjpeg"),
    Giflossy: require("imagemin-giflossy"),
    // Webp = require("imagemin-webp"),
}

const webpack = {
    ...require("webpack"),
    stream: require("webpack-stream"),
}

/**
 * Definitions
 */
/** @type {String} Public folder */
const root = './public_html/';
/** @type {String} Domain for use local server proxy */
const domain = '';
/** @type {String} Path to the source directory. Target is root + src + ${*.*} */
const src = root + '';
/** @type {String} Path to the destination directory. Target is root + dest + ${*.*} */
const dest = root + '';
/** @type {Bool} When not development build */
const production = !!yargs.argv.production;

const extension = {
    scss: '.scss',
    js: '.js',
    img: '.{jpg,jpeg,png,gif,svg}'
}

const serve = {
    tunnel: !!yargs.argv.tunnel ? yargs.argv.tunnel : false,
    port: 9000,
    notify: false,
    ...domain ? { proxy: domain } : { server: { baseDir: dest } }
}

const source = '_source/';

const path = {
    variables: 'assets/_source/_site-settings.scss',
    modules: 'assets/_source/module/*',

    markup: '**/*.html',
    styles: 'assets/',
    vendor: 'assets/vendor/',
    images: '**/high/',
    scripts: '**/',
}

const vendorList = [{
    name: 'Jquery',
    src: './node_modules/jquery/dist/**/*.*',
}, {
    name: 'Bootstrap',
    src: './node_modules/bootstrap/dist/js/*.*',
}, { // @todo cleave bundle (or add to main.js)
    name: 'Cleave',
    src: './node_modules/cleave.js/dist/**/*.*',
}, {
    name: 'Slick',
    src: './node_modules/slick-carousel/slick/**/*.*',
}, {
    name: 'Fancybox',
    src: './node_modules/@fancyapps/fancybox/dist/**/*.*',
}, {
    name: 'Waypoints',
    src: './node_modules/waypoints/lib/**/*.*',
}]

const buildSrcList = (src, ext) => [
    src + '**/*' + ext,
    '!' + src + '**/_*' + ext,
]

const buildStyles = (srcPaths, minify = !!production, force = !!production) => gulp.src(srcPaths, { allowEmpty: true })
    .pipe(gulp.plumber())
    .pipe(gulp.rename((filename) => {
        filename.dirname += "/..";
        if (minify) filename.extname = ".min" + filename.extname;
    }))
    .pipe(gulp.if(!force, gulp.newer({
        map: (relative) => {
            return src + relative;
        },
        // dest: src,
        ext: !!minify ? '.min.css' : '.css',
    })))
    // .pipe(gulp.newer({ dest: buildRelativePath(args['src']) + '../', ext: production ? '.min.css' : '.css' }))
    // .pipe(gulp.sourcemaps())
    .pipe(gulp.sass({ includePaths: ['node_modules', src + path.styles + source] }))
    .pipe(gulp.groupCssMediaQueries())
    .pipe(gulp.autoprefixer({ cascade: false, grid: true }))
    .pipe(gulp.if(!minify, browserSync.stream()))
    .pipe(gulp.if(minify, gulp.cleanCss({
        compatibility: "*",
        level: {
            1: {
                specialComments: 0,
                removeEmpty: true,
                removeWhitespace: true
            },
            2: {
                mergeMedia: true,
                removeEmpty: true,
                removeDuplicateFontRules: true,
                removeDuplicateMediaBlocks: true,
                removeDuplicateRules: true,
                removeUnusedAtRules: false
            }
        },
        rebase: false
    })))
    // .pipe(gulp.if(!minify, gulp.sourcemaps.write("./assets/maps/")))
    .pipe(gulp.plumber.stop())
    .pipe(gulp.dest(dest))
    .pipe(gulp.debug({ "title": "Styles" }))
    .on("end", () => minify || '' == domain ? browserSync.reload : null)

const buildScripts = (done, srcPath, minify = !!production) => {
    const allScripts = glob.sync(srcPath);
    const config = {
        entry: allScripts.reduce((entries, entry) => {
            const regex = new RegExp(``, 'g'),
                matchForRename = /([\w\d.-_\/]+)\_source\/([\w\d._-]+)\.js$/g.exec(entry);

            if (matchForRename !== null) {
                if (typeof matchForRename[1] !== 'undefined' && typeof matchForRename[2] !== 'undefined') {
                    entries[matchForRename[1].replace(root, '') + '/' + matchForRename[2]] = entry;
                }
            }

            return entries;
        }, {}),
        output: { filename: "[name].js" },
        stats: 'errors-only',
        mode: minify ? 'production' : 'development',
        devtool: minify ? false : "source-map",
    }

    if (!Object.keys(config.entry).length) {
        return done();
    }

    return gulp.src(allScripts, { allowEmpty: true })
        .pipe(webpack.stream(config), webpack)
        .pipe(gulp.if(minify, gulp.rename({ suffix: ".min" })))
        .pipe(gulp.dest(root))
        .pipe(gulp.debug({ "title": "Script" }))
        .on("end", browserSync.reload);
}

const buildSmartGrid = (buildSrc) => smartgrid(buildSrc, {
    outputStyle: "scss",
    filename: "_smart-grid",
    columns: 12, // number of grid columns
    offset: "1.875rem", // gutter width - 30px
    mobileFirst: true,
    mixinNames: {
        container: "container"
    },
    container: {
        fields: "0.9375rem" // side fields - 15px
    },
    breakPoints: {
        xs: {
            width: "20rem" // 320px
        },
        sm: {
            width: "36rem" // 576px
        },
        md: {
            width: "48rem" // 768px
        },
        lg: {
            width: "62rem" // 992px
        },
        xl: {
            width: "75rem" // 1200px
        }
    }
});

/**
 * Tasks
 */
gulp.task("build::styles", (done) => {
    const buildPath = buildSrcList(src, extension.scss);

    buildStyles(buildPath, !!production);
    if (!!production) buildStyles(buildPath, !production);
    return done();
})

gulp.task("build::scripts", (done) => {
    const buildPath = src + path.scripts + source + '*' + extension.js;

    buildScripts(done, buildPath, !!production);
    if (!!production) buildScripts(done, buildPath, !production);
    return done();
})

gulp.task("build::images", (done) => gulp.src(src + path.images + '**/*' + extension.img, { allowEmpty: true })
    .pipe(gulp.rename((path) => {
        path.dirname += "/..";
    }))
    .pipe(gulp.if(!production, gulp.newer(root)))
    .pipe(gulp.imagemin([
        imagemin.Giflossy({
            optimizationLevel: 3,
            optimize: 3,
            lossy: 2
        }),
        imagemin.Pngquant({
            speed: 5,
            quality: [0.6, 0.8]
        }),
        imagemin.Zopfli({
            more: true
        }),
        imagemin.Mozjpeg({
            progressive: true,
            quality: 90
        }),
        gulp.imagemin.svgo({
            plugins: [
                { removeViewBox: false },
                { removeUnusedNS: false },
                { removeUselessStrokeAndFill: false },
                { cleanupIDs: false },
                { removeComments: true },
                { removeEmptyAttrs: true },
                { removeEmptyText: true },
                { collapseGroups: true }
            ]
        })
    ]))
    .pipe(gulp.dest(root))
    .pipe(gulp.debug({ "title": "Images" }))); // buildFavicons, buildSprites

gulp.task("watch", (done) => {
    // Watch markup.
    gulp.watch(src + path.markup, (done) => { browserSync.reload(); return done(); });
    // Watch styles.
    gulp.watch(src + '**/*' + extension.scss, gulp.series("build::styles"));
    gulp.watch([src + path.variables, src + path.modules + extension.scss], (e) =>
        buildStyles(buildSrcList(src, extension.scss), !!production, true));
    // Watch javascript.
    gulp.watch(src + path.scripts + source + '*' + extension.js, gulp.series("build::scripts"));
    // Watch images.
    gulp.watch(src + path.images + '*' + extension.img, gulp.series("build::images"));
})

/**
 * Build only
 */
gulp.task("build", gulp.parallel("build::styles", "build::scripts", "build::images"));

/**
 * Move assets (if yarn/npm installed them)
 * @var vendorList {Array}<{name, src}>
 */
gulp.task("install", function(done) {
    let tasks = vendorList.map((vendor) => {
        let destination = src + path.vendor + vendor.name.toLowerCase();

        return gulp.src(vendor.src)
            .pipe(gulp.newer(destination))
            .pipe(gulp.dest(destination))
            .pipe(gulp.debug({ "title": "Vendor: " + vendor.name }))
    })

    buildSmartGrid(src + path.vendor + source);
    return merge(tasks);
});

/**
 * Build with start serve/watcher
 */
gulp.task("default", gulp.series("build", gulp.parallel("watch", () => browserSync.init(serve))))