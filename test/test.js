var postcss = require('postcss');
var expect  = require('chai').expect;
var path    = require('path');

var mixins = require('../');

var test = function (input, output, opts) {
    var result = postcss(mixins(opts)).process(input);
    expect(result.css).to.eql(output);
    expect(result.warnings()).to.be.empty;
};

describe('postcss-mixins', function () {

    it('throws error on unknown mixin', function () {
        expect(function () {
            test('@mixin A');
        }).to.throw('Undefined mixin A');
    });

    it('cans remove unknown mixin on request', function () {
        test('@mixin A; a{}', 'a{}', { silent: true });
    });

    it('supports functions mixins', function () {
        test('a { @mixin color black; }', 'a { color: black; }', {
            mixins: {
                color: function (rule, color) {
                    rule.replaceWith({ prop: 'color', value: color });
                }
            }
        });
    });

    it('removes mixin at-rule', function () {
        test('a { @mixin none; }', 'a { }', {
            mixins: {
                none: function () { }
            }
        });
    });

    it('converts object from function to nodes', function () {
        test('a { @mixin color black; }', 'a { color: black; }', {
            mixins: {
                color: function (rule, color) {
                    return { color: color };
                }
            }
        });
    });

    it('supports object mixins', function () {
        test('@mixin obj;',
             '@media screen {\n    b {\n        one: 1\n    }\n}', {
            mixins: {
                obj: {
                    '@media screen': {
                        'b': {
                            one: 1
                        }
                    }
                }
            }
        });
    });

    it('supports CSS mixins', function () {
        test('@define-mixin black { color: black; } a { @mixin black; }',
             'a { color: black; }');
    });

    it('uses variable', function () {
        test('@define-mixin color $color { color: $color $other; } ' +
             'a { @mixin color black; }',
             'a { color: black $other; }');
    });

    it('supports default value', function () {
        test('@define-mixin c $color: black { color: $color; } a { @mixin c; }',
             'a { color: black; }');
    });

    it('supports mixins with content', function () {
        test('@define-mixin m { @media { @mixin-content; } } @mixin m { a {} }',
             '@media {\n    a {}\n}');
    });

    it('uses variables', function () {
        test('@define-mixin m $a, $b: b, $c: c { v: $a $b $c; } @mixin m 1, 2;',
             'v: 1 2 c;');
    });

    it('loads mixins from dir', function () {
        test('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
            mixinsDir: path.join(__dirname, 'mixins')
        });
    });

    it('loads mixins from dirs', function () {
        test('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
            mixinsDir: [
                path.join(__dirname, 'mixins'),
                path.join(__dirname, 'other')
            ]
        });
    });

    it('coverts mixins values', function () {
        var proccessor = postcss(mixins({
            mixins: {
                empty: function () {
                    return { width: 0 };
                }
            }
        }));
        var result = proccessor.process('a{ @mixin empty; }');
        expect(result.root.first.first.value).to.be.a('string');
    });

    it('supports deprecated variables syntax', function () {
        var result = postcss(mixins).process(
            '@define-mixin m $a $b $c { v: $a $b $c; } @mixin m 1 2 3;');
        expect(result.css).to.eql('v: 1 2 3;');
        expect(result.warnings()).to.have.length(2);
    });

    it('supports mixin keyword naming', function () {
        test(
            '@mixin black { color: black; } a { @include black; }',
            'a { color: black; }',
            {
                defineKeyword: 'mixin',
                usageKeyword: 'include'
            }
        );
    });

});
