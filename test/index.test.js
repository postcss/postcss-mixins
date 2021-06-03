let { join } = require('path')
let postcss = require('postcss')

let mixins = require('../')

async function run(input, output, opts) {
  let result = await postcss([mixins(opts)]).process(input, { from: undefined })
  expect(result.css).toEqual(output)
  expect(result.warnings()).toHaveLength(0)
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

it('throws error on unknown mixin', async () => {
  let error = await catchError(() => run('@mixin A'))
  expect(error.message).toEqual(
    'postcss-mixins: <css input>:1:1: Undefined mixin A'
  )
})

it('throws error on brackets in mixin', async () => {
  let error = await catchError(() => run('@define-mixin a $p {}; @mixin a($p)'))
  expect(error.message).toEqual(
    'postcss-mixins: <css input>:1:24: Remove brackets from mixin. ' +
      'Like: @mixin name(1px) → @mixin name 1px'
  )
})

it('cans remove unknown mixin on request', async () => {
  await run('@mixin A; a{}', 'a{}', { silent: true })
})

it('supports functions mixins', async () => {
  await run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color(rule, color) {
        rule.replaceWith({ prop: 'color', value: color })
      }
    }
  })
})

it('removes mixin at-rule', async () => {
  await run('a { @mixin none; }', 'a { }', {
    mixins: {
      none() {}
    }
  })
})

it('converts object from function to nodes', async () => {
  await run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color(rule, color) {
        return { color }
      }
    }
  })
})

it('passes undefined on missed parameters', async () => {
  await run('a { @mixin test; @mixin test  ; }', 'a { }', {
    mixins: {
      test(rule, param1) {
        expect(param1).not.toBeDefined()
        return {}
      }
    }
  })
})

it('supports object mixins', async () => {
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

it('supports nested function mixins', async () => {
  await run(
    'a { color: black; @mixin parent { @mixin child; } }',
    'a { color: black; .parent { color: white } }',
    {
      mixins: {
        parent(mixin) {
          let rule = postcss.rule({ selector: '.parent' })
          if (mixin.nodes) {
            rule.append(mixin.nodes)
          }
          mixin.replaceWith(rule)
        },
        child() {
          return { color: 'white' }
        }
      }
    }
  )
})

it('throws on unknown mixin type', async () => {
  let error = await catchError(() =>
    run('@mixin a', '', {
      mixins: {
        a: 1
      }
    })
  )
  expect(error.message).toEqual('Wrong a mixin type number')
})

it('supports CSS mixins', async () => {
  await run(
    '@define-mixin black { color: black; } a { @mixin black; }',
    'a { color: black; }'
  )
})

it('uses variable', async () => {
  await run(
    '@define-mixin color $color { color: $color $other; } ' +
      'a { @mixin color black; }',
    'a { color: black $other; }'
  )
})

it('supports default value', async () => {
  await run(
    '@define-mixin c $color: black { color: $color; } a { @mixin c; }',
    'a { color: black; }'
  )
})

it('supports mixins with content', async () => {
  await run(
    '@define-mixin m { @media { @mixin-content; } } @mixin m { a {} }',
    '@media { a {} }'
  )
})

it('supports mixins with declarations content', async () => {
  await run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m { b: 2 } }',
    '.m { a: 1; b: 2 }'
  )
})

it('supports mixins with empty content', async () => {
  await run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m; }',
    '.m { a: 1; }'
  )
})

it('supports mixins with multiple content', async () => {
  await run(
    '@define-mixin m { @mixin-content; @mixin-content; } ' +
      '.m { @mixin m { a: 1 } }',
    '.m { a: 1; a: 1 }'
  )
})

it('supports object mixins with content', async () => {
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

it('uses variables', async () => {
  await run(
    '@define-mixin m $a, $b: b, $c: c { v: $a $b $c; } @mixin m 1, 2;',
    'v: 1 2 c;'
  )
})

it('loads mixins from dir', async () => {
  let result = await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: join(__dirname, 'mixins')
    }
  )
  expect(
    result.messages.sort((a, b) => {
      return a.file.localeCompare(b.file)
    })
  ).toEqual([
    {
      dir: 'test/mixins',
      type: 'dir-dependency',
      parent: ''
    }
  ])
})

it('loads mixins from dir with parent options', async () => {
  let parent = join(__dirname, 'a.js')
  let result = await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: join(__dirname, 'mixins'),
      parent: join(__dirname, 'a.js')
    }
  )
  expect(
    result.messages.sort((a, b) => {
      return a.file.localeCompare(b.file)
    })
  ).toEqual([
    {
      dir: 'test/mixins',
      type: 'dir-dependency',
      parent
    }
  ])
})

it('loads mixins from dirs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: [join(__dirname, 'mixins'), join(__dirname, 'other')]
  })
})

it('loads mixins from relative dir', async () => {
  await run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: 'test/mixins/'
    }
  )
})

it('loads mixins from relative dirs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: ['test/mixins', 'test/other']
  })
})

it('loads mixins from file glob', async () => {
  await run('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
    mixinsFiles: join(__dirname, 'mixins', '*.{js,json}')
  })
})

it('loads mixins from file globs', async () => {
  await run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsFiles: [
      join(__dirname, 'mixins', '*.!(json|css)'),
      join(__dirname, 'other', '*')
    ]
  })
})

it('coverts mixins values', async () => {
  let proccessor = postcss(
    mixins({
      mixins: {
        empty() {
          return { width: 0 }
        }
      }
    })
  )
  let result = await proccessor.process('a{ @mixin empty; }', { from: 'a.css' })
  expect(typeof result.root.first.first.value).toEqual('string')
})

it('supports nested mixins', async () => {
  await run(
    '@define-mixin a $a { a: $a; } ' +
      '@define-mixin b $b { @mixin a $b; } ' +
      '@mixin b 1;',
    'a: 1;'
  )
})

it('supports nested mixins in mixin-content', async () => {
  await run(
    '@define-mixin a { a: 1 } ' +
      '@define-mixin b { b { @mixin-content } } ' +
      '@mixin b { @mixin a }',
    'b { a: 1}'
  )
})

it('supports nested mixins on object mixins', async () => {
  await run('@define-mixin a { a: a; } @mixin b;', 'a: a;', {
    mixins: {
      b: {
        '@mixin a': {}
      }
    }
  })
})

it('supports default arguments in nested mixins', async () => {
  await run(
    '@define-mixin a $a: 1 { a: $a } ' +
      '@define-mixin b $b { @mixin a $b } ' +
      '@mixin b;',
    'a: 1;'
  )
})

it('works in sync mode on no option', () => {
  let input = '@define-mixin a { a: 1 }; @mixin a'
  let out = 'a: 1'
  expect(postcss(mixins()).process(input, { from: 'a.css' }).css).toEqual(out)
})

it('has @add-mixin alias', async () => {
  await run('@define-mixin a { a: 1 } @add-mixin a', 'a: 1')
})
