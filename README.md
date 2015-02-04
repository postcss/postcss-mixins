# PostCSS Mixins [![Build Status](https://travis-ci.org/postcss/postcss-mixins.svg)](https://travis-ci.org/postcss/postcss-mixins)

<img align="right" width="135" height="95" src="http://postcss.github.io/postcss/logo-leftp.png" title="Philosopher’s stone, logo of PostCSS">

[PostCSS] plugin for mixins.

Note, that you must set this plugin before [postcss-simple-vars]
and [postcss-nested].

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

[PostCSS]:             https://github.com/postcss/postcss
[postcss-nested]:      https://github.com/postcss/postcss-nested
[postcss-simple-vars]: https://github.com/postcss/postcss-simple-vars

## Usage

Without options:

```js
postcss([ require('postcss-mixins') ])
```

With options:

```js
postcss([
    require('postcss-mixins')({ mixinsDir: __dirname + '/mixins/' })
])
```

See [PostCSS] docs for examples for your environment.

## Mixins

### CSS Mixin

Simple template defined directly in CSS to prevent repeating yourself.

See [postcss-simple-vars] docs for arguments syntax.

You can use it with [postcss-nested] plugin:

```css
@define-mixin icon $name {
    padding-left: 16px;
    &::after {
        position: absolute;
        top: 0;
        left: 0;
        content: "";
        background-url: url(/icons/$(name).png);
    }
}

.search {
    @mixin icon search;
}
```

Unlike Sass, PostCSS has no `if` or `for` statements. If you need some
complicated logic, you should use function mixin.

[postcss-nested]:      https://github.com/postcss/postcss-nested
[postcss-simple-vars]: https://github.com/postcss/postcss-simple-vars

### Function Mixin

This type of mixin gives you full power of JavaScript.
You can define this mixins in `mixins` option.

This type is ideal for CSS hacks or business logic.

First argument will be `@mixin` node, that called this mixin.
You can insert your declarations or rule before or after this node.
Other arguments will be taken from at-rule parameters.

See [PostCSS API] about nodes API.

```js
require('postcss-mixins')({
    mixins: {
        icons: function (mixin, dir) {
            fs.readdirSync('/images/' + dir).forEach(function (file) {
                var icon = file.replace(/\.svg$/, '');
                var rule = postcss.rule('.icon.icon-' + icon);
                rule.append({
                    prop:  'background',
                    value: 'url(' + dir + '/' + file ')'
                });
                mixin.insertBefore(rule);
            });
        }
    }
});
```

```css
@mixin icons signin;
```

```css
.icon.icon-back { background: url(signin/back.svg) }
.icon.icon-secret { background: url(signin/secret.svg) }
```

You can also return object if you doesn’t want to create each node manually:

```js
require('postcss-mixins')({
    mixins: {
        hidpi: function (path) {
            return {
                '&': {
                    background: 'url(' + path + ')'
                },
                '@media (min-resolution: 120dpi)': {
                    '&': {
                        background: 'url(' + path + '@2x)'
                    }
                }
            }
        }
    }
}
```

Or you can use object instead of function:

```js
require('postcss-mixins')({
    mixins: {
        clearfix: {
            '&::after': {
                content: '""',
                display: 'table',
                clear: 'both'
            }
        }
    }
}
```

[PostCSS API]: https://github.com/postcss/postcss#write-own-processor

## Options

Call plugin function to set options:

```js
.pipe(postcss([ require('postcss-mixins')({ mixins: { … } }) ]))
```

### `mixins`

Object of function mixins.

### `mixinsDir`

Autoload all mixins from this dirs. Mixin name will be taken from file name.=

```js
// gulpfile.js

require('postcss-mixins')({
  mixinsDir: 'mixins/'
})

// mixins/clearfix.js

module.exports = {
    '&::after': {
        content: '""',
        display: 'table',
        clear: 'both'
    }
}
```

### `silent`

Remove unknown mixins and do not throw a error. Default is `false`.
