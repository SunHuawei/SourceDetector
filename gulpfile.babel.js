// generated on 2017-03-02 using generator-chrome-extension 0.6.1
import gulp from "gulp";
import gulpLoadPlugins from "gulp-load-plugins";
import del from "del";
import runSequence from "run-sequence";
import { stream as wiredep } from "wiredep";

const $ = gulpLoadPlugins();

export function extras() {
  return gulp
    .src(
      [
        "app/*.*",
        "app/_locales/**",
        "!app/scripts.babel",
        "!app/*.json",
        "!app/*.html",
      ],
      {
        base: "app",
        dot: true,
      }
    )
    .pipe(gulp.dest("dist"));
}

export function lint() {
  const files = "app/scripts.babel/**/*.js";
  const options = {
    parser: "babel-eslint",
    env: {
      es6: true,
    },
  };
  return gulp.src(files).pipe($.eslint(options)).pipe($.eslint.format());
}

export function images() {
  return gulp
    .src("app/images/**/*")
    .pipe(
      $.if(
        $.if.isFile,
        $.cache(
          $.imagemin({
            progressive: true,
            interlaced: true,
            // don't remove IDs from SVGs, they are often used
            // as hooks for embedding and styling
            svgoPlugins: [{ cleanupIDs: false }],
          })
        ).on("error", function (err) {
          console.log(err);
          this.end();
        })
      )
    )
    .pipe(gulp.dest("dist/images"));
}

export function html() {
  return (
    gulp
      .src("app/*.html")
      .pipe($.useref({ searchPath: [".tmp", "app", "."] }))
      .pipe($.sourcemaps.init())
      // .pipe($.if('*.js', $.uglify()))
      .pipe($.if("*.css", $.cleanCss({ compatibility: "*" })))
      .pipe($.sourcemaps.write())
      .pipe(
        $.if(
          "*.html",
          $.htmlmin({ removeComments: true, collapseWhitespace: true })
        )
      )
      .pipe(gulp.dest("dist"))
  );
}

export function chromeManifest() {
  return (
    gulp
      .src("app/manifest.json")
      .pipe(
        $.chromeManifest({
          buildnumber: true,
          background: {
            target: "scripts/background.js",
            exclude: ["scripts/chromereload.js"],
          },
        })
      )
      .pipe($.if("*.css", $.cleanCss({ compatibility: "*" })))
      .pipe($.if("*.js", $.sourcemaps.init()))
      // .pipe($.if('*.js', $.uglify()))
      .pipe($.if("*.js", $.sourcemaps.write(".")))
      .pipe(gulp.dest("dist"))
  );
}

export function babel() {
  return gulp
    .src("app/scripts.babel/**/*.js")
    .pipe(
      $.babel({
        presets: ["es2015"],
      })
    )
    .pipe(gulp.dest("app/scripts"));
}

export function clean() {
  return del([".tmp", "dist"]);
}

export const watch = gulp.series(lint, babel, () => {
  $.livereload.listen();

  gulp.watch(
    [
      "app/*.html",
      "app/scripts/**/*.js",
      "app/images/**/*",
      "app/styles/**/*",
      "app/_locales/**/*.json",
    ],
    $.livereload.reload
  );

  gulp.watch("app/scripts.babel/**/*.js", gulp.series((lint, babel)));
  gulp.watch("bower.json", gulp.series(wireBowerDep));
});

export function size() {
  return gulp.src("dist/**/*").pipe($.size({ title: "build", gzip: true }));
}

export function wireBowerDep() {
  return gulp
    .src("app/*.html")
    .pipe(
      wiredep({
        ignorePath: /^(\.\.\/)*\.\./,
      })
    )
    .pipe(gulp.dest("app"));
}

export function buildPackage() {
  var manifest = require("./dist/manifest.json");
  return gulp
    .src("dist/**")
    .pipe($.zip("source detector-" + manifest.version + ".zip"))
    .pipe(gulp.dest("package"));
}

const buildAll = gulp.series(
  lint,
  babel,
  chromeManifest,
  [html, images, extras],
  size
);
const build = gulp.series(clean, buildAll);

export default build;
