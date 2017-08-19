var jsToCss = require('postcss-js/parser');
var postcss = require('postcss');
var sugarss = require('sugarss');
var globby  = require('globby');
var vars    = require('postcss-simple-vars');
var path    = require('path');
var fs      = require('fs');
var isWindows = require('os').platform().indexOf('win32') !== -1;

function insideDefine(rule) {
    var parent = rule.parent;
    if ( !parent ) {
        return false;
    } else if ( parent.name === 'define-mixin' ) {
        return true;
    } else {
        return insideDefine(parent);
    }
}

function insertObject(rule, obj, processMixins) {
    var root = jsToCss(obj);
    root.each(function (node) {
        node.source = rule.source;
    });
    processMixins(root);
    rule.parent.insertBefore(rule, root);
}

function insertMixin(result, mixins, rule, processMixins, opts) {
    var name = rule.params.split(/\s/, 1)[0];
    var rest = rule.params.slice(name.length).trim();

    var params;
    if ( rest.trim() === '' ) {
        params = [];
    } else {
        params = postcss.list.comma(rest);
    }

    var meta  = mixins[name];
    var mixin = meta && meta.mixin;

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

        var proxy = postcss.root();
        for ( i = 0; i < mixin.nodes.length; i++ ) {
            var node = mixin.nodes[i].clone();
            delete node.raws.before;
            proxy.append( node );
        }

        if ( meta.args.length ) {
            vars({ only: values })(proxy);
        }
        if ( meta.content ) {
            proxy.walkAtRules('mixin-content', function (content) {
                if ( rule.nodes && rule.nodes.length > 0 ) {
                    content.replaceWith(rule.clone().nodes);
                } else {
                    content.remove();
                }
            });
        }
        processMixins(proxy);

        rule.parent.insertBefore(rule, proxy);

    } else if ( typeof mixin === 'object' ) {
        insertObject(rule, mixin, processMixins);

    } else if ( typeof mixin === 'function' ) {
        var args  = [rule].concat(params);
        rule.walkAtRules(function (atRule) {
            insertMixin(result, mixins, atRule, processMixins, opts);
        });
        var nodes = mixin.apply(this, args);
        if ( typeof nodes === 'object' ) {
            insertObject(rule, nodes, processMixins);
        }
    }

    if ( rule.parent ) rule.remove();
}

function defineMixin(result, mixins, rule) {
    var name  = rule.params.split(/\s/, 1)[0];
    var other = rule.params.slice(name.length).trim();

    var args = [];
    if ( other.length ) {
        args = postcss.list.comma(other).map(function (str) {
            var arg      = str.split(':', 1)[0];
            var defaults = str.slice(arg.length + 1);
            return [arg.slice(1).trim(), defaults.trim()];
        });
    }

    var content = false;
    rule.walkAtRules('mixin-content', function () {
        content = true;
        return false;
    });

    mixins[name] = { mixin: rule, args: args, content: content };
    rule.remove();
}

module.exports = postcss.plugin('postcss-mixins', function (opts) {
    if ( typeof opts === 'undefined' ) opts = { };

    var cwd    = process.cwd();
    var globs  = [];
    var mixins = { };

    if ( opts.mixinsDir ) {
        if ( !Array.isArray(opts.mixinsDir) ) {
            opts.mixinsDir = [opts.mixinsDir];
        }
        globs = opts.mixinsDir.map(function (dir) {
            return path.join(dir, '*.{js,json,css,sss,pcss}');
        });
    }

    if ( opts.mixinsFiles ) globs = globs.concat(opts.mixinsFiles);

    return function (css, result) {
        var processMixins = function (root) {
            root.walkAtRules(function (i) {
                if ( i.name === 'mixin' || i.name === 'add-mixin' ) {
                    if ( !insideDefine(i) ) {
                        insertMixin(result, mixins, i, processMixins, opts);
                    }
                } else if ( i.name === 'define-mixin' ) {
                    defineMixin(result, mixins, i);
                }
            });
        };

        var process = function () {
            if ( typeof opts.mixins === 'object' ) {
                for ( var i in opts.mixins ) {
                    mixins[i] = { mixin: opts.mixins[i] };
                }
            }
            processMixins(css);
        };

        if ( globs.length === 0 ) {
            process();
            return;
        }

        // Windows bug with { nocase: true } due to node-glob issue
        // https://github.com/isaacs/node-glob/issues/123
        return globby(globs, { nocase: !isWindows }).then(function (files) {
            return Promise.all(files.map(function (file) {
                var ext      = path.extname(file).toLowerCase();
                var name     = path.basename(file, path.extname(file));
                var relative = path.join(cwd, path.relative(cwd, file));
                result.messages.push({
                    type: 'dependency',
                    file: relative
                });
                return new Promise(function (resolve, reject) {
                    if ( ext === '.css' || ext === '.pcss' || ext === '.sss' ) {
                        fs.readFile(relative, function (err, contents) {
                            /* istanbul ignore if */
                            if ( err ) {
                                reject(err);
                                return;
                            }
                            var root;
                            if ( ext === '.sss' ) {
                                root = sugarss.parse(contents);
                            } else {
                                root = postcss.parse(contents);
                            }
                            root.walkAtRules('define-mixin', function (atrule) {
                                defineMixin(result, mixins, atrule);
                            });
                            resolve();
                        });
                    } else {
                        mixins[name] = { mixin: require(relative) };
                        resolve();
                    }
                });
            }));
        }).then(process);
    };
});
