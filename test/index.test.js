let { deepStrictEqual, equal } = require('node:assert')
let { join } = require('node:path')
let { test } = require('node:test')
let postcss = require('postcss')

let mixins = require('../')

async function run(input, output, opts) {
  let result = await postcss([mixins(opts)]).process(input, { from: undefined })
  equal(result.css, output)
  equal(result.warnings().length, 0)
  return result
}

async function catchError(fn) {
  let error
  try {
    await fn()
  } catch (e) {
    error = e
  }
  return error
}

test('throws error on unknown mixin', async () => {
  let error = await catchError(() => run('@mixin A'))
  equal(error.message, 'postcss-mixins: <css input>:1:1: Undefined mixin A')
})

test('throws error on brackets in mixin', async () => {
  let error = await catchError(() => run('@define-mixin a $p {}; @mixin a($p)'))
  equal(
    error.message,
    'postcss-mixins: <css input>:1:24: Remove brackets from mixin. ' +
      'Like: @mixin name(1px) → @mixin name 1px'
  )
})

test('does not throw error on brackets in at-rules inside function mixins', async () => {
  await run(
    '@mixin a { @supports (max(0px)) { color: black; } }',
    '.a { @supports (max(0px)) { color: black; } }',
    {
      mixins: {
        a() {
          return { '.a': { '@mixin-content': {} } }
        }
      }
    }
  )
})

test('cans remove unknown mixin on request', async () => {
  await run('@mixin A; a{}', 'a{}', { silent: true })
})

test('supports functions mixins', async () => {
  await run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color(rule, color) {
        rule.replaceWith({ prop: 'color', value: color })
      }
    }
  })
})

test('removes mixin at-rule', async () => {
  await run('a { @mixin none; }', 'a { }', {
    mixins: {
      none() {}
    }
  })
})

test('converts object from function to nodes', async () => {
  await run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color(rule, color) {
        return { color }
      }
    }
  })
})

test('passes undefined on missed parameters', async () => {
  await run('a { @mixin test; @mixin test  ; }', 'a { }', {
    mixins: {
      test(rule, param1) {
        equal(typeof param1, 'undefined')
        return {}
      }
    }
  })
})

test('supports object mixins', async () => {
  await run(
    '@mixin obj;',
    '@media screen {\n    b {\n        one: 1\n    }\n}',
    {
      mixins: {
        obj: {
          '@media screen': {
            b: {
              one: '1'
            }
          }
        }
      }
    }
  )
})

test('supports nested function mixins', async () => {
  await run(
    'a { color: black; @mixin parent { @mixin child; } }',
    'a { color: black; .parent { color: white } }',
    {
      mixins: {
        child() {
          return { color: 'white' }
        },
        parent(mixin) {
          let rule = postcss.rule({ selector: '.parent' })
          if (mixin.nodes) {
            rule.append(mixin.nodes)
          }
          mixin.replaceWith(rule)
        }
      }
    }
  )
})

test('throws on unknown mixin type', async () => {
  let error = await catchError(() =>
    run('@mixin a', '', {
      mixins: {
        a: 1
      }
    })
  )
  equal(error.message, 'Wrong a mixin type number')
})

test('supports CSS mixins', async () => {
  await run(
    '@define-mixin black { color: black; } a { @mixin black; }',
    'a { color: black; }'
  )
})

test('uses variable', async () => {
  await run(
    '@define-mixin color $color { color: $color $other; } ' +
      'a { @mixin color black; }',
    'a { color: black $other; }'
  )
})

test('supports default value', async () => {
  await run(
    '@define-mixin c $color: black { color: $color; } a { @mixin c; }',
    'a { color: black; }'
  )
})

test('supports mixins with content', async () => {
  await run(
    '@define-mixin m { @media { @mixin-content; } } @mixin m { a {} }',
    '@media { a {} }'
  )
})

test('supports mixins with declarations content', async () => {
  await run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m { b: 2 } }',
    '.m { a: 1; b: 2 }'
  )
})

test('supports mixins with empty content', async () => {
  await run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m; }',
    '.m { a: 1; }'
  )
})

test('supports mixins with multiple content', async () => {
  await run(
    '@define-mixin m { @mixin-content; @mixin-content; } ' +
      '.m { @mixin m { a: 1 } }',
    '.m { a: 1; a: 1 }'
  )
})

test('supports object mixins with content', async () => {
  await run('@mixin obj { b {} }', 'a { b {}\n}', {
    mixins: {
      obj: {
        a: {
          '@mixin-content': {}
        }
      }
    }
  })
})

test('uses variables', async () => {
  await run(
    '@define-mixin m $a, $b: b, $c: c { v: $a $b $c; } @mixin m 1, 2;',
    'v: 1 2 c;'
  )
})

test('loads mixins from dir', async () => {
  let result = await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: join(__dirname, 'mixins')
    }
  )
  deepStrictEqual(
    result.messages.sort((a, b) => a.file && a.file.localeCompare(b.file)),
    [
      {
        file: join(__dirname, 'mixins/a.js'),
        parent: '',
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/b.json'),
        parent: '',
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/c.CSS'),
        parent: '',
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/d.sss'),
        parent: '',
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/e.pcss'),
        parent: '',
        type: 'dependency'
      },
      {
        dir: join(__dirname, 'mixins'),
        glob: '*.{js,cjs,mjs,json,css,sss,pcss}',
        parent: '',
        type: 'dir-dependency'
      }
    ]
  )
})

test('loads mixins from dir with parent options', async () => {
  let parent = join(__dirname, 'a.js')
  let result = await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: join(__dirname, 'mixins'),
      parent: join(__dirname, 'a.js')
    }
  )
  deepStrictEqual(
    result.messages.sort((a, b) => a.file && a.file.localeCompare(b.file)),
    [
      {
        file: join(__dirname, 'mixins/a.js'),
        parent,
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/b.json'),
        parent,
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/c.CSS'),
        parent,
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/d.sss'),
        parent,
        type: 'dependency'
      },
      {
        file: join(__dirname, 'mixins/e.pcss'),
        parent,
        type: 'dependency'
      },
      {
        dir: join(__dirname, 'mixins'),
        glob: '*.{js,cjs,mjs,json,css,sss,pcss}',
        parent: '',
        type: 'dir-dependency'
      }
    ]
  )
})

test('loads mixins from dirs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: [join(__dirname, 'mixins'), join(__dirname, 'other')]
  })
})

test('loads mixins from relative dir', async () => {
  await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: 'test/mixins/'
    }
  )
})

test('loads mixins from relative dirs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: ['test/mixins', 'test/other']
  })
})

test('loads mixins from file glob', async () => {
  await run('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
    mixinsFiles: join(__dirname, 'mixins', '*.{js,json}')
  })
})

test('loads mixins from file globs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsFiles: [
      join(__dirname, 'mixins', '*.!(json|css)'),
      join(__dirname, 'other', '*')
    ]
  })
})

test('loads mixins with dependencies', async () => {
  let result = await run('a { @mixin f; }', 'a { g: 5; }', {
    mixinsFiles: join(__dirname, 'deps', 'f.js')
  })
  deepStrictEqual(
    result.messages.sort((a, b) => a.file && a.file.localeCompare(b.file)),
    [
      {
        file: join(__dirname, 'deps/f.js'),
        parent: '',
        type: 'dependency'
      },
      {
        file: join(__dirname, 'deps/g.js'),
        parent: join(__dirname, 'deps/f.js'),
        type: 'dependency'
      }
    ]
  )
})

test('coverts mixins values', async () => {
  let processor = postcss(
    mixins({
      mixins: {
        empty() {
          return { width: 0 }
        }
      }
    })
  )
  let result = await processor.process('a{ @mixin empty; }', { from: 'a.css' })
  equal(typeof result.root.first.first.value, 'string')
})

test('supports nested mixins', async () => {
  await run(
    '@define-mixin a $a { a: $a; } ' +
      '@define-mixin b $b { @mixin a $b; } ' +
      '@mixin b 1;',
    'a: 1;'
  )
})

test('supports nested mixins in mixin-content', async () => {
  await run(
    '@define-mixin a { a: 1 } ' +
      '@define-mixin b { b { @mixin-content } } ' +
      '@mixin b { @mixin a }',
    'b { a: 1}'
  )
})

test('supports nested mixins on object mixins', async () => {
  await run('@define-mixin a { a: a; } @mixin b;', 'a: a;', {
    mixins: {
      b: {
        '@mixin a': {}
      }
    }
  })
})

test('supports default arguments in nested mixins', async () => {
  await run(
    '@define-mixin a $a: 1 { a: $a } ' +
      '@define-mixin b $b { @mixin a $b } ' +
      '@mixin b;',
    'a: 1;'
  )
})

test('works in sync mode on no option', () => {
  let input = '@define-mixin a { a: 1 }; @mixin a'
  let out = 'a: 1'
  equal(postcss(mixins()).process(input, { from: 'a.css' }).css, out)
})

test('has @add-mixin alias', async () => {
  await run('@define-mixin a { a: 1 } @add-mixin a', 'a: 1')
})

test('treats single-arg content as a single argument', async () => {
  await run(
    '@define-mixin a $x, $y { a: $x; b: $y; } ' +
      '@mixin a single-arg(1, 2), 3;',
    'a: 1, 2;\nb: 3;'
  )
})

test('throws error when single-arg does not have start parenthesis', async () => {
  let error = await catchError(() =>
    run('@define-mixin a $p {}; @mixin a single-arg 1, 2);')
  )

  equal(
    error.message,
    'postcss-mixins: <css input>:1:24: ' +
      'Content of single-arg must be wrapped in brackets: single-arg 1'
  )
})

test('throws error when single-arg does not have end parenthesis', async () => {
  let error = await catchError(() =>
    run('@define-mixin a $p {}; @mixin a single-arg(1, 2;')
  )

  equal(
    error.message,
    'postcss-mixins: <css input>:1:24: ' +
      'Content of single-arg must be wrapped in brackets: single-arg(1, 2;'
  )
})

test('ignores whitespaces outside of single-arg parentheses', async () => {
  await run(
    '@define-mixin a $x, $y { a: $x; b: $y; } ' +
      '@mixin a single-arg   (1, 2)   , 3;',
    'a: 1, 2;\nb: 3;'
  )
})

test('can replace multiple single-arg contents', async () => {
  await run(
    '@define-mixin a $x, $y { a: $x; b: $y; } ' +
      '@mixin a single-arg(1, 2), single-arg(3, 4);',
    'a: 1, 2;\nb: 3, 4;'
  )
})

test('can replace multiple single-arg contents inside single declaration', async () => {
  await run(
    '@define-mixin a $x, $y { a: $x, $y; } ' +
      '@mixin a single-arg(1, 2), single-arg(3, 4);',
    'a: 1, 2, 3, 4;'
  )
})

test('can replace single-arg contents with nested parentheses', async () => {
  await run(
    '@define-mixin a $x { a: $x } ' + '@mixin a single-arg(1, (2), 3);',
    'a: 1, (2), 3;'
  )
})

test('handles single-arg inside rules', async () => {
  await run(
    '@define-mixin a $x, $y { .s { a: $x; b: $y; } } ' +
      '@mixin a single-arg(1, 2), 3;',
    '.s { a: 1, 2; b: 3; }'
  )
})

test('passes single-arg to the nested mixin', async () => {
  await run(
    '@define-mixin a $p { a: $p; } ' +
      '@define-mixin b $x, $y { @mixin a $x; b: $y; } ' +
      '@mixin b single-arg(1, 2), 3;',
    'a: 1, 2;\nb: 3;'
  )
})

test('passes single-arg to the nested function mixin', async () => {
  await run('@mixin b single-arg(1, 2), 3;', 'a: 1, 2;\nb: 3;', {
    mixins: {
      a(rule, p) {
        return { a: p }
      },
      b(rule, x, y) {
        return { ['@mixin a ' + x]: {}, b: y }
      }
    }
  })
})
