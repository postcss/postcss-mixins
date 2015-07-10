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
            test('@include A');
        }).to.throw('Undefined mixin A');
    });

    it('cans remove unknown mixin on request', function () {
        test('@include A; a{}', 'a{}', { silent: true });
    });

    it('supports functions mixins', function () {
        test('a { @include color black; }', 'a { color: black; }', {
            mixins: {
                color: function (rule, color) {
                    rule.replaceWith({ prop: 'color', value: color });
                }
            }
        });
    });

    it('removes mixin at-rule', function () {
        test('a { @include none; }', 'a { }', {
            mixins: {
                none: function () { }
            }
        });
    });

    it('converts object from function to nodes', function () {
        test('a { @include color black; }', 'a { color: black; }', {
            mixins: {
                color: function (rule, color) {
                    return { color: color };
                }
            }
        });
    });

    it('supports object mixins', function () {
        test('@include obj;',
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
        test('@mixin black { color: black; } a { @include black; }',
             'a { color: black; }');
    });

    it('uses variable', function () {
        test('@mixin color $color { color: $color $other; } ' +
             'a { @include color black; }',
             'a { color: black $other; }');
    });

    it('supports default value', function () {
        test('@mixin c $color: black { color: $color; } a { @include c; }',
             'a { color: black; }');
    });

    it('supports mixins with content', function () {
        test('@mixin m { @media { @content; } } @include m { a {} }',
             '@media {\n    a {}\n}');
    });

    it('uses variables', function () {
        test('@mixin m $a, $b: b, $c: c { v: $a $b $c; } @include m 1, 2;',
             'v: 1 2 c;');
    });

    it('loads mixins from dir', function () {
        test('a { @include a 1; @include b; }', 'a { a: 1; b: 2; }', {
            mixinsDir: path.join(__dirname, 'mixins')
        });
    });

    it('loads mixins from dirs', function () {
        test('a { @include a 1; @include c; }', 'a { a: 1; c: 3; }', {
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
        var result = proccessor.process('a{ @include empty; }');
        expect(result.root.first.first.value).to.be.a('string');
    });

    it('supports deprecated variables syntax', function () {
        var result = postcss(mixins).process(
            '@mixin m $a $b $c { v: $a $b $c; } @include m 1 2 3;');
        expect(result.css).to.eql('v: 1 2 3;');
        expect(result.warnings()).to.have.length(2);
    });

});
