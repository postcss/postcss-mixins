# PostCSS Mixins [![Build Status][ci-img]][ci]

<img align="right" width="135" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo-leftp.svg">

[PostCSS] plugin for mixins.

Note, that you must set this plugin before [postcss-simple-vars]
and [postcss-nested].

```css
@define-mixin icon $network, $color: blue {
    .icon.is-$(network) {
        color: $color;
        @mixin-content;
    }
    .icon.is-$(network):hover {
        color: white;
        background: $color;
    }
}

@mixin icon twitter {
    background: url(twt.png);
}
@mixin icon youtube, red {
    background: url(youtube.png);
}
```

```css
.icon.is-twitter {
    color: blue;
    background: url(twt.png);
}
.icon.is-twitter:hover {
    color: white;
    background: blue;
}
.icon.is-youtube {
    color: red;
    background: url(youtube.png);
}
.icon.is-youtube:hover {
    color: white;
    background: red;
}
```

[postcss-utilities] collection is better for `clearfix` and other popular hacks.
For simple cases you can use [postcss-define-property].

[postcss-define-property]: https://github.com/daleeidd/postcss-define-property
[postcss-utilities]:       https://github.com/ismamz/postcss-utilities
[postcss-simple-vars]:     https://github.com/postcss/postcss-simple-vars
[postcss-nested]:          https://github.com/postcss/postcss-nested
[PostCSS]:                 https://github.com/postcss/postcss
[ci-img]:                  https://travis-ci.org/postcss/postcss-mixins.svg
[ci]:                      https://travis-ci.org/postcss/postcss-mixins

## Usage

```js
postcss([ require('postcss-mixins') ])
```

See [PostCSS] docs for examples for your environment.

[PostCSS API]: https://github.com/postcss/postcss/blob/master/docs/api.md


### CSS Mixin

Simple template defined directly in CSS to prevent repeating yourself.

See [postcss-simple-vars] docs for arguments syntax.

You can use it with [postcss-nested] plugin:

```css
@define-mixin icon $name {
    padding-left: 16px;
    &::after {
        content: "";
        background: url(/icons/$(name).png);
    }
}

.search {
    @mixin icon search;
}
```

Unlike Sass, PostCSS has no `if` or `while` statements. If you need some
complicated logic, you should use function mixin.

[postcss-nested]:      https://github.com/postcss/postcss-nested
[postcss-simple-vars]: https://github.com/postcss/postcss-simple-vars


### Function Mixin

This type of mixin gives you full power of JavaScript.
You can define this mixins in `mixins` option.

This type is ideal for CSS hacks or business logic.

Also you should use function mixin if you need to change property names
in mixin, because [postcss-simple-vars] doesn’t support variables
in properties yet.

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
                var rule = postcss.rule({ selector: '.icon.icon-' + icon });
                rule.append({
                    prop:  'background',
                    value: 'url(' + dir + '/' + file + ')'
                });
                mixin.replaceWith(rule);
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

You can also return an object if you don’t want to create each node manually:

```js
require('postcss-mixins')({
    mixins: {
        image: function (mixin, path) {
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
});
```

Mixin body will be in `mixin.nodes`:

```js
var postcss = require('postcss');

require('postcss-mixins')({
    mixins: {
        hover: function (mixin) {
            let rule = postcss.rule({ selector: '&:hover, &.hover' });
            rule.append(mixin.nodes);
            mixin.replaceWith(rule);
        }
    }
});
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
});
```

### Mixin Content

`@mixin-context` at-rule will be replaced with mixin `@mixin` children.
For exampel, CSS mxins:

```SCSS
@define-mixin isIE {
    .isIE & {
        @mixin-content;
    }
}
```

or JS mixins:

```js
require('postcss-mixins')({
    mixins: {
        isIe: function () {
            '@mixin-content': {},
        }
    }
});
```

could be used like this:

```scss
.foo {
    color: blue;

    @mixin isIE {
        color: red;
    }
}

// output
.foo { color: blue; }
.isIE .foo { color: red; }
```


### Migration from Sass

If you need to use Sass and PostCSS mixins together
(for example, while migration), you could use `@add-mixin`,
instead of `@mixin`. Just put PostCSS after Sass.

```sass
// Legacy SCSS
@mixin old {
    …
}
@include old;

// New code
@define-mixin new {
    …
}
@add-mixin new;
```

## Options

Call plugin function to set options:

```js
postcss([ require('postcss-mixins')({ mixins: { … } }) ])
```

### `mixins`

Type: `Object`

Object of function mixins.

### `mixinsDir`

Type: `string|string[]`

Autoload all mixins from one or more dirs. Mixin name will be taken from file
name.

```js
// gulpfile.js

require('postcss-mixins')({
    mixinsDir: path.join(__dirname, 'mixins')
})

// mixins/clearfix.js

module.exports = {
    '&::after': {
        content: '""',
        display: 'table',
        clear: 'both'
    }
}

// mixins/size.pcss

@define-mixin size $size {
    width: $size;
    height: $size;
}

// mixins/circle.sss

@define-mixin circle $size
  border-radius: 50%
  width: $size
  height: $size
```

### `mixinsFiles`

Type: `string|string[]`

Similar to [`mixinsDir`](#mixinsdir); except, you can provide
[fast-glob](https://github.com/mrmlnc/fast-glob) syntax to target or not target
specific files.

```js
require('postcss-mixins')({
    mixinsFiles: path.join(__dirname, 'mixins', '!(*.spec.js)')
})
```

### `silent`

Remove unknown mixins and do not throw a error. Default is `false`.
