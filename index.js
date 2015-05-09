var postcss = require('postcss');
var vars    = require('postcss-simple-vars');
var path    = require('path');
var fs      = require('fs');

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

var insertMixin = function (mixins, rule, opts) {
    var params = postcss.list.space(rule.params);
    var name   = params.shift();
    var meta   = mixins[name];
    var mixin  = meta && meta.mixin;

    if ( !meta ) {
        if ( !opts.silent ) {
            throw rule.error('Undefined mixin ' + name);
        }

    } else if ( mixin.name === 'define-mixin' ) {
        var names   = meta.names;
        var values  = { };
        var present = false;
        for ( var i = 0; i < names.length; i++ ) {
            present = true;
            values[ names[i] ] = params[i] || '';
        }

        var clones = [];
        for ( i = 0; i < mixin.nodes.length; i++ ) {
            clones.push( mixin.nodes[i].clone() );
        }

        if ( present ) {
            var proxy = postcss.rule({ nodes: clones });
            vars({ only: values })(proxy);
        }

        rule.parent.insertBefore(rule, clones);

    } else if ( typeof mixin === 'object' ) {
        insertObject(rule, mixin, rule.source);

    } else if ( typeof mixin === 'function' ) {
        var args   = [rule].concat(params);
        var result = mixin.apply(this, args);
        if ( typeof result === 'object' ) {
            insertObject(rule, result, rule.source);
        }
    }

    if ( rule.parent ) rule.removeSelf();
};

var defineMixin = function (mixins, rule) {
    var names = rule.params.split(/\s/);
    var name  = names.shift();

    names = names.map(function (i) {
        return i.slice(1);
    });

    mixins[name] = { mixin: rule, names: names };
    rule.removeSelf();
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

    if ( typeof opts.mixins === 'object' ) {
        for ( i in opts.mixins ) mixins[i] = { mixin: opts.mixins[i] };
    }

    return function (css) {
        css.eachAtRule(function (rule) {

            if ( rule.name === 'mixin' ) {
                insertMixin(mixins, rule, opts);
            } else if ( rule.name === 'define-mixin' ) {
                defineMixin(mixins, rule);
            }

        });
    };
});
