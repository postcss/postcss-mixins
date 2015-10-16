var postcss = require('postcss');
var expect  = require('chai').expect;
var path    = require('path');

var mixins = require('../');

var test = function (input, output, done, opts) {
    return postcss(mixins(opts)).process(input).then(function (result) {
        expect(result.css).to.eql(output);
        expect(result.warnings()).to.be.empty;
        done();
    });
};

describe('postcss-mixins', function () {

    it('throws error on unknown mixin', function () {
        test('@mixin A').catch(function (err) {
            expect(err.name).to.eql('Undefined mixin A');
        });
    });

    it('cans remove unknown mixin on request', function (done) {
        test('@mixin A; a{}', 'a{}', done, { silent: true });
    });

    it('supports functions mixins', function (done) {
        test('a { @mixin color black; }', 'a { color: black; }', done, {
            mixins: {
                color: function (rule, color) {
                    rule.replaceWith({ prop: 'color', value: color });
                }
            }
        });
    });

    it('removes mixin at-rule', function (done) {
        test('a { @mixin none; }', 'a { }', done, {
            mixins: {
                none: function () { }
            }
        });
    });

    it('converts object from function to nodes', function (done) {
        test('a { @mixin color black; }', 'a { color: black; }', done, {
            mixins: {
                color: function (rule, color) {
                    return { color: color };
                }
            }
        });
    });

    it('supports object mixins', function (done) {
        test('@mixin obj;',
            '@media screen {\n    b {\n        one: 1\n    }\n}', done, {
                mixins: {
                    obj: {
                        '@media screen': {
                            b: {
                                one: 1
                            }
                        }
                    }
                }
            });
    });

    it('supports CSS mixins', function (done) {
        test('@define-mixin black { color: black; } a { @mixin black; }',
             'a { color: black; }',
             done);
    });

    it('uses variable', function (done) {
        test('@define-mixin color $color { color: $color $other; } ' +
             'a { @mixin color black; }',
             'a { color: black $other; }',
             done);
    });

    it('supports default value', function (done) {
        test('@define-mixin c $color: black { color: $color; } a { @mixin c; }',
             'a { color: black; }',
             done);
    });

    it('supports mixins with content', function (done) {
        test('@define-mixin m { @media { @mixin-content; } } @mixin m { a {} }',
             '@media {\n    a {}\n}',
             done);
    });

    it('uses variables', function (done) {
        test('@define-mixin m $a, $b: b, $c: c { v: $a $b $c; } @mixin m 1, 2;',
             'v: 1 2 c;',
             done);
    });

    it('loads mixins from dir', function (done) {
        test(
            'a { @mixin a 1; @mixin b; @mixin d; }',
            'a { a: 1; b: 2; d: 4; }',
            done,
            {
                mixinsDir: path.join(__dirname, 'mixins')
            }
        );
    });

    it('loads mixins from relative dir', function (done) {
        test(
            'a { @mixin a 1; @mixin b; @mixin d; }',
            'a { a: 1; b: 2; d: 4; }',
            done,
            {
                mixinsDir: 'test/mixins/'
            }
        );
    });

    it('loads mixins from dirs', function (done) {
        test('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', done, {
            mixinsDir: [
                path.join(__dirname, 'mixins'),
                path.join(__dirname, 'other')
            ]
        });
    });

    it('loads mixins from dirs', function (done) {
        test('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', done, {
            mixinsDir: [
                'test/mixins',
                'test/other'
            ]
        });
    });

    it('loads mixins from file glob', function (done) {
        test('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', done, {
            mixinsFiles: path.join(__dirname, 'mixins', '*.{js,json}')
        });
    });

    it('loads mixins from file globs', function (done) {
        test('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', done, {
            mixinsFiles: [
                path.join(__dirname, 'mixins', '*.!(json|css)'),
                path.join(__dirname, 'other', '*')
            ]
        });
    });

    it('coverts mixins values', function (done) {
        var proccessor = postcss(mixins({
            mixins: {
                empty: function () {
                    return { width: 0 };
                }
            }
        }));
        proccessor.process('a{ @mixin empty; }').then(function (result) {
            expect(result.root.first.first.value).to.be.a('string');
            done();
        });
    });

    it('supports deprecated variables syntax', function (done) {
        postcss(mixins).process(
            '@define-mixin m $a $b $c { v: $a $b $c; } @mixin m 1 2 3;'
        ).then(function (result) {
            expect(result.css).to.eql('v: 1 2 3;');
            expect(result.warnings()).to.have.length(2);
            done();
        });
    });

});
