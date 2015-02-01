var postcss = require('postcss');
var list    = require('postcss/lib/list');

var stringToAtRule = function (str, obj) {
    obj.name   = str.match(/^@([^\s]*)/)[1];
    obj.params = str.replace(/^@[^\s]*\s+/, '');
    return obj;
};

var objectToNodes = function (node, obj, source) {
    var name, value, decl, rule;
    for ( name in obj ) {
        value = obj[name];
        if ( typeof(value) == 'object' ) {
            if ( name[0] == '@' ) {
                rule = postcss.atRule(stringToAtRule(name, { source: source }));
            } else {
                rule = postcss.rule({ selector: name, source: source });
            }
            node.append(rule);
            if ( typeof(value) == 'object' ) objectToNodes(rule, value, source);
        } else {
            decl = postcss.decl({ prop: name, value: value, source: source });
            node.append(decl);
        }
    }
    return node;
};

var insertObject = function (rule, obj) {
    var root = objectToNodes(postcss.root(), obj, rule.source);
    rule.parent.insertBefore(rule, root);
};

var insertMixin = function (mixins, rule, opts) {
    var params = list.space(rule.params);
    var name   = params.shift();
    var mixin  = mixins[name];

    var root;

    if ( !mixin ) {
        if ( !opts.silent ) {
            throw rule.error('Undefined mixin ' + name);
        }

    } else if ( typeof(mixin) == 'object' ) {
        insertObject(rule, mixin, rule.source);

    } else if ( typeof(mixin) == 'function' ) {
        var args   = [rule].concat(params);
        var result = mixin.apply(this, args);
        if ( typeof(result) == 'object' ) {
            insertObject(rule, result, rule.source);
        }
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
    };
};

module.exports.postcss = function (css) {
    module.exports()(css);
};
