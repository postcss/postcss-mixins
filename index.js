var postcss = require('postcss');
var vars    = require('postcss-simple-vars');
var path    = require('path');
var fs      = require('fs');
var glob    = require('glob');

var stringToAtRule = function (str, obj) {
    obj.name   = str.match(/^@([^\s]*)/)[1];
    obj.params = str.replace(/^@[^\s]*\s+/, '');
    return obj;
};

var objectToNodes = function (node, obj, source) {
    var name, value, decl, rule;
    for ( name in obj ) {
        value = obj[name];
        if ( typeof value === 'object' ) {
            if ( name[0] === '@' ) {
                rule = postcss.atRule(stringToAtRule(name, { source: source }));
            } else {
                rule = postcss.rule({ selector: name, source: source });
            }
            node.append(rule);
            if ( typeof value === 'object' ) objectToNodes(rule, value, source);
        } else {
            decl = postcss.decl({
                prop:   name,
                value:  value.toString(),
                source: source
            });
            node.append(decl);
        }
    }
    return node;
};

var insertObject = function (rule, obj) {
    var root = objectToNodes(postcss.root(), obj, rule.source);
    rule.parent.insertBefore(rule, root);
};

var insertMixin = function (result, mixins, rule, opts) {
    var name   = rule.params.split(/\s/, 1)[0];
    var params = rule.params.slice(name.length).trim();
    if ( params.indexOf(',') === -1 ) {
        params = postcss.list.space(params);
        if ( params.length > 1 ) {
            result.warn('Space argument separation is depreacted and ' +
                        'will be removed in next version. Use comma.',
                        { node: rule });
        }
    } else {
        params = postcss.list.comma(params);
    }

    var meta   = mixins[name];
    var mixin  = meta && meta.mixin;

    if ( !meta ) {
        if ( !opts.silent ) {
            throw rule.error('Undefined mixin ' + name);
        }

    } else if ( mixin.name === 'define-mixin' ) {
        var i;
        var values = { };
        for ( i = 0; i < meta.args.length; i++ ) {
            values[meta.args[i][0]] = params[i] || meta.args[i][1];
        }

        var clones = [];
        for ( i = 0; i < mixin.nodes.length; i++ ) {
            clones.push( mixin.nodes[i].clone() );
        }

        var proxy = postcss.rule({ nodes: clones });
        if ( meta.args.length ) {
            vars({ only: values })(proxy);
        }
        if ( meta.content ) {
            proxy.walkAtRules('mixin-content', function (place) {
                place.replaceWith(rule.nodes);
            });
        }

        rule.parent.insertBefore(rule, clones);

    } else if ( typeof mixin === 'object' ) {
        insertObject(rule, mixin, rule.source);

    } else if ( typeof mixin === 'function' ) {
        var args  = [rule].concat(params);
        var nodes = mixin.apply(this, args);
        if ( typeof nodes === 'object' ) {
            insertObject(rule, nodes, rule.source);
        }
    }

    if ( rule.parent ) rule.remove();
};

var defineMixin = function (result, mixins, rule) {
    var name  = rule.params.split(/\s/, 1)[0];
    var other = rule.params.slice(name.length).trim();

    var args = [];
    if ( other.length ) {
        if ( other.indexOf(',') === -1 && other.indexOf(':') === -1 ) {
            args = other.split(/\s/).map(function (str) {
                return [str.slice(1), ''];
            });
            if ( args.length > 1 ) {
                result.warn('Space argument separation is depreacted and ' +
                            'will be removed in next version. Use comma.',
                            { node: rule });
            }

        } else {
            args = postcss.list.comma(other).map(function (str) {
                var arg      = str.split(':', 1)[0];
                var defaults = str.slice(arg.length + 1);
                return [arg.slice(1).trim(), defaults.trim()];
            });
        }
    }

    var content = false;
    rule.walkAtRules('mixin-content', function () {
        content = true;
        return false;
    });

    mixins[name] = { mixin: rule, args: args, content: content };
    rule.remove();
};

module.exports = postcss.plugin('postcss-mixins', function (opts) {
    if ( typeof opts === 'undefined' ) opts = { };

    var i;
    var mixins = { };

    if ( opts.mixinsDir ) {
        var dirs = opts.mixinsDir;
        if ( !(dirs instanceof Array) ) dirs = [dirs];

        for ( i = 0; i < dirs.length; i++ ) {
            var dir   = dirs[i];
            var files = fs.readdirSync(dir);
            for ( var j = 0; j < files.length; j++ ) {
                var file = path.join(dir, files[j]);
                if ( path.extname(file) === '.js' ) {
                    var name = path.basename(file, '.js');
                    mixins[name] = { mixin: require(file) };
                }
            }
        }
    }

    if ( opts.mixinsFiles ) {
        var globs = opts.mixinsFiles;
        if ( !(globs instanceof Array) ) globs = [globs];

        globs.forEach(function (pattern) {
            glob.sync(pattern).forEach(function (file2) {
                var name2 = path.basename(file2, path.extname(file2));
                mixins[name2] = { mixin: require(file2) };
            });
        });
    }

    if ( typeof opts.mixins === 'object' ) {
        for ( i in opts.mixins ) mixins[i] = { mixin: opts.mixins[i] };
    }

    return function (css, result) {
        css.walkAtRules(function (rule) {

            if ( rule.name === 'mixin' ) {
                insertMixin(result, mixins, rule, opts);
            } else if ( rule.name === 'define-mixin' ) {
                defineMixin(result, mixins, rule);
            }

        });
    };
});
