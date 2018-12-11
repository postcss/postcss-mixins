var postcss = require('postcss')
var path = require('path')

var mixins = require('../')

function run (input, output, opts) {
  return postcss([mixins(opts)])
    .process(input, { from: undefined })
    .then(function (result) {
      expect(result.css).toEqual(output)
      expect(result.warnings()).toHaveLength(0)
      return result
    })
}

it('throws error on unknown mixin', function () {
  return postcss(mixins)
    .process('@mixin A', { from: undefined })
    .catch(function (err) {
      expect(err.reason).toEqual('Undefined mixin A')
    })
})

it('cans remove unknown mixin on request', function () {
  return run('@mixin A; a{}', 'a{}', { silent: true })
})

it('supports functions mixins', function () {
  return run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color: function (rule, color) {
        rule.replaceWith({ prop: 'color', value: color })
      }
    }
  })
})

it('removes mixin at-rule', function () {
  return run('a { @mixin none; }', 'a { }', {
    mixins: {
      none: function () { }
    }
  })
})

it('converts object from function to nodes', function () {
  return run('a { @mixin color black; }', 'a { color: black; }', {
    mixins: {
      color: function (rule, color) {
        return { color: color }
      }
    }
  })
})

it('passes undefined on missed parameters', function () {
  return run('a { @mixin test; @mixin test  ; }', 'a { }', {
    mixins: {
      test: function (rule, param1) {
        expect(param1).not.toBeDefined()
        return { }
      }
    }
  })
})

it('supports object mixins', function () {
  return run(
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

it('supports nested function mixins', function () {
  return run(
    'a { color: black; @mixin parent { @mixin child; } }',
    'a { color: black; .parent { color: white } }',
    {
      mixins: {
        parent: function (mixin) {
          var rule = postcss.rule({ selector: '.parent' })
          if (mixin.nodes) {
            rule.append(mixin.nodes)
          }
          mixin.replaceWith(rule)
        },
        child: function () {
          return {
            color: 'white'
          }
        }
      }
    })
})

it('throws on unknown mixin type', function (done) {
  var opts = {
    mixins: {
      a: 1
    }
  }
  return postcss([mixins(opts)])
    .process('@mixin a', { from: undefined })
    .catch(function (e) {
      expect(e.message).toEqual('Wrong a mixin type number')
      done()
    })
})

it('supports CSS mixins', function () {
  return run(
    '@define-mixin black { color: black; } a { @mixin black; }',
    'a { color: black; }'
  )
})

it('uses variable', function () {
  return run(
    '@define-mixin color $color { color: $color $other; } ' +
            'a { @mixin color black; }',
    'a { color: black $other; }'
  )
})

it('supports default value', function () {
  return run(
    '@define-mixin c $color: black { color: $color; } a { @mixin c; }',
    'a { color: black; }'
  )
})

it('supports mixins with content', function () {
  return run(
    '@define-mixin m { @media { @mixin-content; } } @mixin m { a {} }',
    '@media { a {} }'
  )
})

it('supports mixins with declarations content', function () {
  return run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m { b: 2 } }',
    '.m { a: 1; b: 2 }'
  )
})

it('supports mixins with empty content', function () {
  return run(
    '@define-mixin m { a: 1; @mixin-content; } .m { @mixin m; }',
    '.m { a: 1; }'
  )
})

it('supports mixins with multiple content', function () {
  return run(
    '@define-mixin m { @mixin-content; @mixin-content; } ' +
            '.m { @mixin m { a: 1 } }',
    '.m { a: 1; a: 1 }'
  )
})

it('supports object mixins with content', function () {
  return run(
    '@mixin obj { b {} }',
    'a { b {}\n}',
    {
      mixins: {
        obj: {
          a: {
            '@mixin-content': { }
          }
        }
      }
    }
  )
})

it('uses variables', function () {
  return run(
    '@define-mixin m $a, $b: b, $c: c { v: $a $b $c; } @mixin m 1, 2;',
    'v: 1 2 c;'
  )
})

it('loads mixins from dir', function () {
  return run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: path.join(__dirname, 'mixins')
    }
  ).then(function (result) {
    expect(
      result.messages.sort(function (a, b) {
        return a.file.localeCompare(b.file)
      })
    ).toEqual([
      {
        file: path.join(__dirname, 'mixins/a.js'),
        type: 'dependency',
        parent: ''
      },
      {
        file: path.join(__dirname, 'mixins/b.json'),
        type: 'dependency',
        parent: ''
      },
      {
        file: path.join(__dirname, 'mixins/c.CSS'),
        type: 'dependency',
        parent: ''
      },
      {
        file: path.join(__dirname, 'mixins/d.sss'),
        type: 'dependency',
        parent: ''
      },
      {
        file: path.join(__dirname, 'mixins/e.pcss'),
        type: 'dependency',
        parent: ''
      }
    ])
  })
})

it('loads mixins from dir with parent options', function () {
  var parent = path.join(__dirname, 'a.js')
  return run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: path.join(__dirname, 'mixins'),
      parent: path.join(__dirname, 'a.js')
    }
  ).then(function (result) {
    // Array could have files sorted in non-alphabetical order.
    // Check array length, and that it contains all required items,
    // regardless they order within array.
    expect(result.messages).toHaveLength(5)
    expect(result.messages).toEqual(
      expect.arrayContaining([
        {
          file: path.join(__dirname, 'mixins/a.js'),
          type: 'dependency',
          parent: parent
        },
        {
          file: path.join(__dirname, 'mixins/b.json'),
          type: 'dependency',
          parent: parent
        },
        {
          file: path.join(__dirname, 'mixins/c.CSS'),
          type: 'dependency',
          parent: parent
        },
        {
          file: path.join(__dirname, 'mixins/d.sss'),
          type: 'dependency',
          parent: parent
        },
        {
          file: path.join(__dirname, 'mixins/e.pcss'),
          type: 'dependency',
          parent: parent
        }
      ])
    )
  })
})

it('loads mixins from dirs', function () {
  return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: [
      path.join(__dirname, 'mixins'),
      path.join(__dirname, 'other')
    ]
  })
})

it('loads mixins from relative dir', function () {
  return run(
    'a { @mixin a 1; @mixin b; @mixin c; @mixin d; @mixin e; }',
    'a { a: 1; b: 2; c: 3; d: 4; e: 5; }',
    {
      mixinsDir: 'test/mixins/'
    }
  )
})

it('loads mixins from relative dirs', function () {
  return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsDir: ['test/mixins', 'test/other']
  })
})

it('loads mixins from file glob', function () {
  return run('a { @mixin a 1; @mixin b; }', 'a { a: 1; b: 2; }', {
    mixinsFiles: path.join(__dirname, 'mixins', '*.{js,json}')
  })
})

it('loads mixins from file globs', function () {
  return run('a { @mixin a 1; @mixin c; }', 'a { a: 1; c: 3; }', {
    mixinsFiles: [
      path.join(__dirname, 'mixins', '*.!(json|css)'),
      path.join(__dirname, 'other', '*')
    ]
  })
})

it('coverts mixins values', function () {
  var proccessor = postcss(mixins({
    mixins: {
      empty: function () {
        return { width: 0 }
      }
    }
  }))
  return proccessor
    .process('a{ @mixin empty; }', { from: undefined })
    .then(function (result) {
      expect(typeof result.root.first.first.value).toEqual('string')
    })
})

it('supports nested mixins', function () {
  return run(
    '@define-mixin a $a { a: $a; } ' +
            '@define-mixin b $b { @mixin a $b; } ' +
            '@mixin b 1;',
    'a: 1;'
  )
})

it('supports nested mixins in mixin-content', function () {
  return run(
    '@define-mixin a { a: 1 } ' +
            '@define-mixin b { b { @mixin-content } } ' +
            '@mixin b { @mixin a }',
    'b { a: 1}'
  )
})

it('supports nested mixins on object mixins', function () {
  return run('@define-mixin a { a: a; } @mixin b;', 'a: a;', {
    mixins: {
      b: {
        '@mixin a': { }
      }
    }
  })
})

it('supports default arguments in nested mixins', function () {
  return run(
    '@define-mixin a $a: 1 { a: $a } ' +
            '@define-mixin b $b { @mixin a $b } ' +
            '@mixin b;',
    'a: 1;'
  )
})

it('works in sync mode on no option', function () {
  var input = '@define-mixin a { a: 1 }; @mixin a'
  var output = 'a: 1'
  expect(
    postcss(mixins()).process(input, { from: undefined }).css
  ).toEqual(output)
})

it('has @add-mixin alias', function () {
  return run('@define-mixin a { a: 1 } @add-mixin a', 'a: 1')
})
