var postcss = require('postcss');
var list    = require('postcss/lib/list');

var insertMixin = function (mixins, rule, opts) {
    var params = list.space(rule.params);
    var name   = params.shift();
    var mixin  = mixins[name];

    if ( !mixin ) {
        if ( !opts.silent ) {
            throw rule.error('Undefined mixin ' + name);
        }
    } else if ( typeof(mixin) == 'function' ) {
        var args = [rule].concat(params);
        mixin.apply(this, args);
    }

    if ( rule.parent ) rule.removeSelf();
};

module.exports = function (opts) {
    if ( typeof(opts) == 'undefined' ) opts = { };

    var mixins = { };
    if ( typeof(opts.mixins) == 'object' ) {
        for ( var i in opts.mixins ) mixins[i] = opts.mixins[i];
    }

    return function (css) {
        css.eachAtRule(function (rule) {

            if ( rule.name == 'mixin' ) {
                insertMixin(mixins, rule, opts);
            }

        });
    }
};

module.exports.postcss = function (css) {
    module.exports()(css);
};
