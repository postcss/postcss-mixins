var postcss = require('postcss');
var path    = require('path');

var mixins = require('../');

function run(input, output, opts = { }) {
    return postcss([ mixins(opts) ]).process(input)
        .then( result => {
            expect(result.css).toEqual(output);
            expect(result.warnings().length).toBe(0);
        });
}

it('supports nested function mixins', () => {
    return run(
        'a { color: black; @mixin parent { @mixin child; } }',
        'a { color: black; .parent { color: white } }',
        {
            mixins: {
                parent: (mixin) => {
                    var rule = postcss.rule({ selector: '.parent' });
                    if ( mixin.nodes ) {
                        rule.append(mixin.nodes);
                    }
                    mixin.replaceWith(rule);
                },
                child: () => {
                    return {
                        color: 'white'
                    };
                }
            }
        });
});

it('throws error on unknown mixin', () => {
    return postcss(mixins).process('@mixin A').catch(err => {
        expect(err.reason).toEqual('Undefined mixin A');
    });
});

it('cans remove unknown mixin on request', () => {
    return run('@mixin A; a{}', 'a{}', { silent: true });
});

it('supports functions mixins', () => {
    return run('a { @mixin color black; }', 'a { color: black; }', {
        mixins: {
            color: (rule, color) => {
                rule.replaceWith({ prop: 'color', value: color });
            }
        }
    });
});

it('removes mixin at-rule', () => {
    return run('a { @mixin none; }', 'a { }', {
        mixins: {
            none: () => { }
        }
    });
});

it('converts object from function to nodes', () => {
    return run('a { @mixin color black; }', 'a { color: black; }', {
        mixins: {
            color: (rule, color) => {
                return { color: color };
            }
        }
    });
});

it('passes undefined on missed parameters', () => {
    return run('a { @mixin test; @mixin test  ; }', 'a { }', {
        mixins: {
            test: (rule, param1) => {
                expect(param1).not.toBeDefined();
                return { };
            }
        }
    });
});

it('supports object mixins', () => {
    return run('@mixin obj;',
        '@media screen {\n    b {\n        one: 1\n    }\n}', {
            mixins: {
                obj: {
                    '@media screen': {
                        b: {
                            one: '1'
                        }
                    }
                }
            }
        });
});

it('supports CSS mixins', () => {
    return run('@define-mixin black { color: black; } a { @mixin black; }',
                  'a { color: black; }');
});

it('uses variable', () => {
    return run('@define-mixin color $color { color: $color $other; } ' +
                  'a { @mixin color black; }',
                  'a { color: black $other; }');
});

it('supports default value', () => {
    return run('@define-mixin c $color: black { color: $color; } ' +
                  'a { @mixin c; }',
                  'a { color: black; }');
});

it('supports mixins with content', () => {
    return run('@define-mixin m { @media { @mixin-content; } } ' +
                  '@mixin m { a {} }',
                  '@media {\n    a {}\n}');
});

it('supports mixins with declarations content', () => {
    return run('@define-mixin m { a: 1; @mixin-content; } ' +
                  '.m { @mixin m { b: 2 } }',
                  '.m { a: 1; b: 2 }');
});

it('supports mixins with empty content', () => {
    return run('@define-mixin m { a: 1; @mixin-content; } ' +
                  '.m { @mixin m; }',
                  '.m { a: 1; }');
});

it('uses variables', () => {
    return run('@define-mixin m $a, $b: b, $c: c { v: $a $b $c; }' +
                  '@mixin m 1, 2;',
                  'v: 1 2 c;');
});

it('loads mixins from dir', () => {
    return run(
        'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
        'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
        {
            mixinsDir: path.join(__dirname, 'mixins')
        }
    );
});

it('loads mixins from dirs', () => {
    return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsDir: [
            path.join(__dirname, 'mixins'),
            path.join(__dirname, 'other')
        ]
    });
});


it('loads mixins from relative dir', () => {
    return run(
        'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
        'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
        {
            mixinsDir: 'test/mixins/'
        }
    );
});

it('loads mixins from relative dirs', () => {
    return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsDir: ['test/mixins', 'test/other']
    });
});

it('loads mixins from file glob', () => {
    return run('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
        mixinsFiles: path.join(__dirname, 'mixins', '*.{js,json}')
    });
});

it('loads mixins from file globs', () => {
    return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsFiles: [
            path.join(__dirname, 'mixins', '*.!(json|css)'),
            path.join(__dirname, 'other', '*')
        ]
    });
});

it('coverts mixins values', () => {
    var proccessor = postcss(mixins({
        mixins: {
            empty: () => {
                return { width: 0 };
            }
        }
    }));
    return proccessor.process('a{ @mixin empty; }').then(result => {
        expect(typeof result.root.first.first.value).toEqual('string');
    });
});

it('supports nested mixins', () => {
    return run('@define-mixin a $a { a: $a; } ' +
                  '@define-mixin b $b { @mixin a $b; } ' +
                  '@mixin b 1;',
                  'a: 1;');
});

it('supports nested mixins in mixin-content', () => {
    return run('@define-mixin a { a: 1 } ' +
                  '@define-mixin b { b { @mixin-content } } ' +
                  '@mixin b { @mixin a }',
                  'b {\n    a: 1\n}');
});

it('supports nested mixins on object mixins', () => {
    return run('@define-mixin a { a: a; } @mixin b;', 'a: a;', {
        mixins: {
            b: {
                '@mixin a': { }
            }
        }
    });
});

it('supports default arguments in nested mixins', () => {
    return run('@define-mixin a $a: 1 { a: $a } ' +
                  '@define-mixin b $b { @mixin a $b } ' +
                  '@mixin b;',
                  'a: 1;');
});

it('works in sync mode on no option', () => {
    var input = '@define-mixin a { a: 1 }; @mixin a';
    var output = 'a: 1';
    expect(postcss(mixins()).process(input).css).toEqual(output);
});


it('cans remove unknown mixin on request', () => {
    return run('@define-mixin a { a: 1 } @add-mixin a', 'a: 1');
});
