# Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## 6.1
* Pass `dependency` message for every loaded mixin files for `postcss-loader`.

## 6.0.1
* Fix multiple `@mixin-content` usage.

## 6.0
* Use PostCSS 6.0.

## 5.4.1
* Fix support nested function mixins (by Lam Tran).

## 5.4
* Add `add-mixin` alias for `@mixin` for Sass migration process.

## 5.3
* Do not use asynchronous API if it is unnecessary.
* Use SugarSS 0.2.

## 5.2
* Add `.pcss` extension support in `mixinsDir`.

## 5.1
* Add SugarSS support in `mixinsDir`.

## 5.0.1
* Use globby 6 and PostCSS 5.1.

## 5.0
* Use `postcss-simple-vars` 3.0 with special syntax for comment variables
  and nested variables support.

## 4.0.2
* Fix default argument values in function mixins.

## 4.0.1
* Fix Windows support for `mixinsFiles` and `mixinsDir` (by Hugo Agbonon).

## 4.0.0
* Remove space-separated parameters. They were depreacted in 0.3.

## 3.0.2
* Fix `@mixin-content` usage with empty body.

## 3.0.1
* Fix default arguments in nested mixins.
* Fix `@mixin-content` for declarations content.

## 3.0
* Add nested mixins support.
* Use `postcss-js` to convert objects into CSS in JS mixins.
* Case insensitive mixin file search.

## 2.1.1
* Async CSS mixin files loading (by Jed Mao).

## 2.1
* Add CSS files support for mixins from dir (by Jed Mao).

## 2.0
* `mixinsDir` loads JSON mixins too (by Jed Mao).

## 1.0.2
* Do not throw error on missed mixin dir (by Bogdan Chadkin).
* Use async plugin API (by Bogdan Chadkin).

## 1.0.1
* Fix using relative URL in `mixinsDir` (by Bogdan Chadkin).

## 1.0
* Use PostCSS 5.0 API.

## 0.4
* Add `mixinsFiles` option (by Jed Mao).

## 0.3
* Change syntax to comma separated arguments.
  Use: `@mixin name 1, 2` instead of `@mixin name 1 2`.
* Add default value for arguments.

## 0.2
* Add block mixins support.
* Support PostCSS 4.1 API.
* Convert all JS mixins values to string.

## 0.1.1
* Use `postcss-simple-vars` 0.2.

## 0.1
* Initial release.
