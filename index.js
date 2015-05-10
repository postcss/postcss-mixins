var postcss = require('postcss');
var vars    = require('postcss-simple-vars');
var path    = require('path');
var fs      = require('fs');

var RE_PARAMETER_DECLARATION = (/\$(.+?)(?::\s*(.+?))?(?:,|\s+|$)/);

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
        var values    = { };
        var variables = meta.variableList;
        Object.keys(meta.variableList).forEach(function(index) {
            values[variables[index].name] = params[index] || variables[index].defaultValue || '';
        });

        var clones = [];
        for (var i = 0; i < mixin.nodes.length; i++ ) {
            clones.push( mixin.nodes[i].clone() );
        }

        var proxy = postcss.rule({ nodes: clones });
        if ( variables.length ) {
            vars({ only: values })(proxy);
        }
        if ( meta.content ) {
            proxy.eachAtRule('mixin-content', function (place) {
                place.replaceWith(rule.nodes);
            });
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
    var parameterString = names.join(' ');

    var variableList = [];
    var parameterRegex = new RegExp(RE_PARAMETER_DECLARATION.source, 'g');
    var matches;
    while ((matches = parameterRegex.exec(parameterString)) !== null) {
        // javascript RegExp has a bug when the match has length 0
        if (matches.index === parameterRegex.lastIndex) {
            ++parameterRegex.lastIndex;
        }

        var variableName = matches[1];
        var variableDefaultValue = matches[2] !== undefined ? matches[2].trim() : undefined;

        variableList.push({
            name: variableName,
            defaultValue: variableDefaultValue
        });
    }


    var content = false;
    rule.eachAtRule('mixin-content', function () {
        content = true;
        return false;
    });

    mixins[name] = { mixin: rule, variableList: variableList, content: content };
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
