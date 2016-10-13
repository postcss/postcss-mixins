import postcss from 'postcss';
import path    from 'path';
import test    from 'ava';

import mixins from '../';

function run(t, input, output, opts) {
    return postcss(mixins(opts)).process(input).then(result => {
        t.deepEqual(result.css, output);
        t.deepEqual(result.warnings().length, 0);
    });
}

test('throws error on unknown mixin', t => {
    return postcss(mixins).process('@mixin A').catch(err => {
        t.deepEqual(err.reason, 'Undefined mixin A');
    });
});

test('cans remove unknown mixin on request', t => {
    return run(t, '@mixin A; a{}', 'a{}', { silent: true });
});

test('supports functions mixins', t => {
    return run(t, 'a { @mixin color black; }', 'a { color: black; }', {
        mixins: {
            color: (rule, color) => {
                rule.replaceWith({ prop: 'color', value: color });
            }
        }
    });
});

test('removes mixin at-rule', t => {
    return run(t, 'a { @mixin none; }', 'a { }', {
        mixins: {
            none: () => { }
        }
    });
});

test('converts object from function to nodes', t => {
    return run(t, 'a { @mixin color black; }', 'a { color: black; }', {
        mixins: {
            color: (rule, color) => {
                return { color: color };
            }
        }
    });
});

test('passes undefined on missed parameters', t => {
    return run(t, 'a { @mixin test; @mixin test  ; }', 'a { }', {
        mixins: {
            test: (rule, param1) => {
                t.deepEqual(typeof param1, 'undefined');
                return { };
            }
        }
    });
});

test('supports object mixins', t => {
    return run(t, '@mixin obj;',
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

test('supports CSS mixins', t => {
    return run(t, '@define-mixin black { color: black; } a { @mixin black; }',
                  'a { color: black; }');
});

test('uses variable', t => {
    return run(t, '@define-mixin color $color { color: $color $other; } ' +
                  'a { @mixin color black; }',
                  'a { color: black $other; }');
});

test('supports default value', t => {
    return run(t, '@define-mixin c $color: black { color: $color; } ' +
                  'a { @mixin c; }',
                  'a { color: black; }');
});

test('supports mixins with content', t => {
    return run(t, '@define-mixin m { @media { @mixin-content; } } ' +
                  '@mixin m { a {} }',
                  '@media {\n    a {}\n}');
});

test('supports mixins with declarations content', t => {
    return run(t, '@define-mixin m { a: 1; @mixin-content; } ' +
                  '.m { @mixin m { b: 2 } }',
                  '.m { a: 1; b: 2 }');
});

test('supports mixins with empty content', t => {
    return run(t, '@define-mixin m { a: 1; @mixin-content; } ' +
                  '.m { @mixin m; }',
                  '.m { a: 1; }');
});

test('uses variables', t => {
    return run(t, '@define-mixin m $a, $b: b, $c: c { v: $a $b $c; }' +
                  '@mixin m 1, 2;',
                  'v: 1 2 c;');
});

test('loads mixins from dir', t => {
    return run(t,
        'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
        'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
        {
            mixinsDir: path.join(__dirname, 'mixins')
        }
    );
});

test('loads mixins from relative dir', t => {
    return run(t,
        'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
        'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
        {
            mixinsDir: 'mixins/'
        }
    );
});

test('loads mixins from dirs', t => {
    return run(t, 'a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsDir: [
            path.join(__dirname, 'mixins'),
            path.join(__dirname, 'other')
        ]
    });
});

test('loads mixins from relative dirs', t => {
    return run(t, 'a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsDir: ['mixins', 'other']
    });
});

test('loads mixins from file glob', t => {
    return run(t, 'a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
        mixinsFiles: path.join(__dirname, 'mixins', '*.{js,json}')
    });
});

test('loads mixins from file globs', t => {
    return run(t, 'a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
        mixinsFiles: [
            path.join(__dirname, 'mixins', '*.!(json|css)'),
            path.join(__dirname, 'other', '*')
        ]
    });
});

test('coverts mixins values', t => {
    var proccessor = postcss(mixins({
        mixins: {
            empty: () => {
                return { width: 0 };
            }
        }
    }));
    return proccessor.process('a{ @mixin empty; }').then(result => {
        t.deepEqual(typeof result.root.first.first.value, 'string');
    });
});

test('supports nested mixins', t => {
    return run(t, '@define-mixin a $a { a: $a; } ' +
                  '@define-mixin b $b { @mixin a $b; } ' +
                  '@mixin b 1;',
                  'a: 1;');
});

test('supports nested mixins in mixin-content', t => {
    return run(t, '@define-mixin a { a: 1 } ' +
                  '@define-mixin b { b { @mixin-content } } ' +
                  '@mixin b { @mixin a }',
                  'b {\n    a: 1\n}');
});

test('supports nested mixins on object mixins', t => {
    return run(t, '@define-mixin a { a: a; } @mixin b;', 'a: a;', {
        mixins: {
            b: {
                '@mixin a': { }
            }
        }
    });
});

test('supports default arguments in nested mixins', t => {
    return run(t, '@define-mixin a $a: 1 { a: $a } ' +
                  '@define-mixin b $b { @mixin a $b } ' +
                  '@mixin b;',
                  'a: 1;');
});

test('works in sync mode on no option', t => {
    let input = '@define-mixin a { a: 1 }; @mixin a';
    let output = 'a: 1';
    t.deepEqual(postcss(mixins()).process(input).css, output);
});

test('supports renaming mixin rules through options', t => {
    let input = '@set a { color: blue; } @use a;';
    let output = 'color: blue;';
    t.deepEqual(postcss(mixins({
        rules: {
            mixin: 'use',
            defineMixin: 'set'
        }
    })).process(input).css, output);
});
