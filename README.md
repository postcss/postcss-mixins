# PostCSS Mixins [![Build Status](https://travis-ci.org/postcss/postcss-mixins.svg)](https://travis-ci.org/postcss/postcss-mixins)

<img align="right" width="135" height="95" src="http://postcss.github.io/postcss/logo-leftp.png" title="Philosopher’s stone, logo of PostCSS">

[PostCSS] plugin for mixins.

```css
@define-mixin icon $network $color {
    .icon.is-$(network) {
        color: $color;
    }
    .icon.is-$(network):hover {
        color: white;
        background: $color;
    }
}

@mixin icon twitter blue;
@mixin icon youtube red;
```

```css
.icon.is-twitter {
    color: blue;
}
.icon.is-twitter:hover {
    color: white;
    background: blue;
}
.icon.is-youtube {
    color: red;
}
.icon.is-youtube:hover {
    color: white;
    background: red;
}
```

[PostCSS]: https://github.com/postcss/postcss


## Usage

See [PostCSS] docs for source map options and other special cases.

[PostCSS]: https://github.com/postcss/postcss

### Grunt

```js
grunt.initConfig({
    postcss: {
        options: {
            processors: [ require('postcss-mixins').postcss ]
        },
        dist: {
            src: 'css/*.css'
        }
    }
});

grunt.loadNpmTasks('grunt-postcss');
```

### Gulp

```js
var postcss = require('gulp-postcss');

gulp.task('css', function () {
     return gulp.src('./src/*.css')
        .pipe(postcss([ require('postcss-mixins') ]))
        .pipe(gulp.dest('./dest'));
});
```
