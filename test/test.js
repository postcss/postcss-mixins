import postcss from 'postcss';
import path    from 'path';
import test    from 'ava';

import mixins from '../';

function run(t, input, output, opts) {
    return postcss(mixins(opts)).process(input).then(result => {
        t.same(result.css, output);
        t.same(result.warnings().length, 0);
    });
}

test('throws error on unknown mixin', t => {
    return postcss(mixins).process('@mixin A').catch(err => {
        t.same(err.reason, 'Undefined mixin A');
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

test('supports object mixins', t => {
    return run(t, '@mixin obj;',
        '@media screen {\n    b {\n        one: 1\n    }\n}', {
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

test('uses variables', t => {
    return run(t, '@define-mixin m $a, $b: b, $c: c { v: $a $b $c; }' +
                  '@mixin m 1, 2;',
                  'v: 1 2 c;');
});

test('loads mixins from dir', t => {
    return run(t,
        'a { @mixin a 1; @mixin b; @mixin d; }',
        'a { a: 1; b: 2; d: 4; }',
        {
            mixinsDir: path.join(__dirname, 'mixins')
        }
    );
});

test('loads mixins from relative dir', t => {
    return run(t,
        'a { @mixin a 1; @mixin b; @mixin d; }',
        'a { a: 1; b: 2; d: 4; }',
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
        t.same(typeof result.root.first.first.value, 'string');
    });
});

test('supports deprecated variables syntax', t => {
    return postcss(mixins).process(
        '@define-mixin m $a $b $c { v: $a $b $c; } @mixin m 1 2 3;'
    ).then(result => {
        t.same(result.css, 'v: 1 2 3;');
        t.same(result.warnings().length, 2);
    });
});
