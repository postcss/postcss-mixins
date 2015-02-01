var postcss = require('postcss');
var expect  = require('chai').expect;

var mixins = require('../');

var test = function (input, output, opts) {
    expect(postcss(mixins(opts)).process(input).css).to.eql(output);
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
                none: function (rule) { }
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

    it('uses variables in CSS mixins', function () {
        test('@define-mixin color $color { color: $color $other; } ' +
             'a { @mixin color black; }',
             'a { color: black $other; }');
    });

});
