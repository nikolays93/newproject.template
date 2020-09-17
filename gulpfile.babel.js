"use strict";

/**
 * @todo  Add force (exclude newer) session for pages and vendo
 */

/** @type {String} Public folder */
const root = './public_html/';
/** @type {String} Template folder */
const template = '';
/** @type {String} Domain for use local server proxy */
const domain = '';
/** @type {String} Path to the destination directory. Target is root + dest + ${*.*} */
const dest = root + '';
/** @type {String} Source folder */
const source = '_source/';
/** @type {String} Path to raw images */
const imageSource = '_high/';
/** @type {String} Assets folder relative by root */
const assets = 'assets/';
/** @type {String} Path to vendor assets */
const vendor = template + assets + 'vendor/';
/** @type {String} Heavy (raw) images folder */
const images = 'images/' + imageSource;
/** @type {Array} */
const pages = [
    '', //- index page
    '404/'
];
/** @type {Object} */
const extension = {
    scss: '*.scss',
    js: '*.js',
    img: '*.{jpg,jpeg,png,gif,svg,JPG,JPEG,PNG,GIF,SVG}'
}

/**
 * Modules
 */
const path = require('path')
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

/** @type {Bool} When not development build */
const production = !!yargs.argv.production;
/** @type {Object} */
const serve = {
    tunnel: !!yargs.argv.tunnel ? yargs.argv.tunnel : false,
    port: 9000,
    notify: false,
    ...(domain ? { proxy: domain } : { server: { baseDir: dest } })
}

const skipUnderscore = (path, ext) => [
    '!' + path + '_' + ext,
    path + ext
];

const paths = {
    markup: '**/*.html',

    styles: {
        // make all styles
        abstracts: root + template + assets + source + 'abstracts/**/' + extension.scss,
        // make template and pages styles
        modules: root + template + assets + source + 'module/' + extension.scss,
        // make template styles
        template: template ? skipUnderscore(root + template + assets + source + '**/', extension.scss) : [
            root + assets + source + 'template.scss',
            ...skipUnderscore(root + assets + source + 'base/**/', extension.scss),
            ...skipUnderscore(root + assets + source + 'layouts/**/', extension.scss),
        ],
        // make vendor styles
        vendor: skipUnderscore(root + vendor + source + '**/', extension.scss),
        // make pages styles
        pages: pages.map((pagename) => root + pagename + assets + source + '**/' + extension.scss),
    },

    scripts: {
        // make template and pages scripts
        modules: root + template + assets + source + 'parts/' + extension.js,
        // make template scripts
        template: template ? skipUnderscore(root + template + assets + source + '**/', extension.js) : [],
        // make vendor scripts
        vendor: skipUnderscore(root + vendor + source + '**/', extension.js),
        // make pages scripts
        pages: pages.map((pagename) => root + pagename + assets + source + '**/' + extension.js),
    },

    images: [
        // default: /public_html/images/_high/*.{jpg,png...}
        root + template + images + extension.img,
        // Optimize additional images: (for ex. /public_html/images/_high/*.{jpg,png...}, /public_html/404/images/_high/*.{jpg,png...})
        ...pages.map((pagename) => root + pagename + images + '**/' + extension.img),
    ],
}

const vendorList = [{
    name: 'Jquery',
    src: './node_modules/jquery/dist/**/*.*',
}, {
    name: 'Bootstrap',
    src: './node_modules/bootstrap/dist/js/*.*',
}, {
    name: 'Slick',
    src: './node_modules/slick-carousel/slick/**/*.*',
}, {
    name: 'Fancybox',
    src: './node_modules/@fancyapps/fancybox/dist/**/*.*',
}, { // @note: use `yarn add waypoints` for install
    name: 'Waypoints',
    src: './node_modules/waypoints/lib/**/*.*',
}]

/**
 * Build methods
 */
const buildStyles = (src, minify = !!production, force = !!production) => gulp.src(src, { allowEmpty: true, base: root })
    .pipe(gulp.plumber())
    .pipe(gulp.rename((filename) => {
        filename.dirname += "/..";
        if (minify) filename.extname = ".min" + filename.extname;
    }))
    .pipe(gulp.if(!force, gulp.newer({
        map: (relative) => {
            return root + relative;
        },
        ext: !!minify ? '.min.css' : '.css',
    })))
    // .pipe(gulp.sourcemaps())
    .pipe(gulp.sass({ includePaths: ['node_modules', root + template + assets + source] }))
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
    .pipe(gulp.dest((file) => path.resolve(file.base))) // (file) => dest + path.basename(file.base)
    .pipe(gulp.debug({ "title": "Styles" }))
    .on("end", () => minify || '' == domain ? browserSync.reload : null)

const buildScripts = (done, src, minify = !!production) => {
    const regex = new RegExp(`([\\w\\d.-_/]+)${source}([\\w\\d._-]+).js$`, 'g')
    const config = {
        entry: src.reduce((entries, entry) => {
            if (0 !== entry.indexOf('!')) {
                glob.sync(entry).forEach((found) => {
                    // @type { 0: path to _source, 1: basename (without ext) } match
                    const match = regex.exec(found)
                    if (match) {
                        entries[match[1] + '/' + match[2]] = found
                    }
                })
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

    return gulp.src('nonsense', { allowEmpty: true })
        .pipe(webpack.stream(config), webpack)
        .pipe(gulp.if(minify, gulp.rename({ suffix: ".min" })))
        .pipe(gulp.dest('./'))
        .pipe(gulp.debug({ "title": "Script" }))
}

const buildImages = (done, force = false) => gulp.src(paths.images, { allowEmpty: true, base: root })
    .pipe(gulp.rename((filename) => {
        let raw = imageSource.replace(/\/$/, '')
        let filedata = filename.dirname.split(raw, 2)
        filename.dirname = path.join(filedata[0], filedata[1])
    }))
    .pipe(gulp.if(!force, gulp.newer(dest)))
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
    .pipe(gulp.dest(dest))
    .pipe(gulp.debug({ "title": "Images" }));
// @todo buildFavicons, buildSprites

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
})

/**
 * Tasks
 */
gulp.task('build:template:styles', (done) => {
    if (paths.styles.template.length) {
        buildStyles(paths.styles.template, !!production, true);
        if (!!production) buildStyles(paths.styles.template, !production);
    }

    return done();
})

gulp.task('build:vendor:styles', (done) => {
    buildStyles(paths.styles.vendor, !!production);
    if (!!production) buildStyles(paths.styles.vendor, !production);
    return done();
})

gulp.task('build:pages:styles', (done) => {
    buildStyles(paths.styles.pages, !!production);
    if (!!production) buildStyles(paths.styles.pages, !production);
    return done();
})

gulp.task("build::styles", gulp.parallel('build:template:styles', 'build:vendor:styles', 'build:pages:styles'))

gulp.task('build:template:scripts', (done) => {
    if (paths.scripts.template.length) {
        buildScripts(done, paths.scripts.template, !!production);
        if (!!production) buildScripts(done, paths.scripts.template, !production);
        else browserSync.reload();
    }

    return done();
})

gulp.task('build:vendor:scripts', (done) => {
    buildScripts(done, paths.scripts.vendor, !!production);
    if (!!production) buildScripts(done, paths.scripts.vendor, !production);
    else browserSync.reload();
    return done();
})

gulp.task('build:pages:scripts', (done) => {
    buildScripts(done, paths.scripts.pages, !!production);
    if (!!production) buildScripts(done, paths.scripts.pages, !production);
    else browserSync.reload();
    return done();
})

gulp.task("build::scripts", gulp.parallel('build:template:scripts', 'build:vendor:scripts', 'build:pages:scripts'))

gulp.task("build::images", (done) => buildImages(done, false))
// force build images (rebuild)
gulp.task("rebuild::images", (done) => buildImages(done, true))

gulp.task("watch", (done) => {
    // Watch markup.
    gulp.watch(root + paths.markup, (done) => { browserSync.reload(); return done(); });
    // Watch styles.
    gulp.watch(paths.styles.abstracts, gulp.parallel('build::styles'));
    gulp.watch(paths.styles.modules, gulp.parallel('build:template:styles', 'build:pages:styles'));

    gulp.watch(paths.styles.template, gulp.parallel('build:template:styles'));
    gulp.watch(paths.styles.vendor, gulp.parallel('build:vendor:styles'));
    gulp.watch(paths.styles.pages, gulp.parallel('build:pages:styles'));
    // Watch javascript.
    gulp.watch(paths.scripts.modules, gulp.parallel('build::scripts'));

    gulp.watch(paths.scripts.template, gulp.parallel('build:template:scripts'));
    gulp.watch(paths.scripts.vendor, gulp.parallel('build:vendor:scripts'));
    gulp.watch(paths.scripts.pages, gulp.parallel('build:pages:scripts'));
    // Watch images.
    gulp.watch(paths.images, gulp.series("build::images"));
})

/**
 * Move assets (if yarn/npm installed them)
 * @var vendorList {Array}<{name, src}>
 */
gulp.task("install", function(done) {
    let tasks = vendorList.map((elem) => {

        let destination = root + vendor + elem.name.toLowerCase();

        return gulp.src(elem.src)
            .pipe(gulp.newer(destination))
            .pipe(gulp.dest(destination))
            .pipe(gulp.debug({ "title": "Vendor: " + elem.name }))
    })

    buildSmartGrid(root + vendor + source);
    return merge(tasks);
})

/**
 * Build only
 */
gulp.task("build", gulp.parallel("build::styles", "build::scripts", "build::images"))

/**
 * Start serve/watcher
 */
gulp.task("default", gulp.parallel("watch", () => browserSync.init(serve)))