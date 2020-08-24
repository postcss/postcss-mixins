let { join, basename, extname, relative } = require('path')
let { promisify } = require('util')
let { platform } = require('os')
let jsToCss = require('postcss-js/parser')
let postcss = require('postcss')
let sugarss = require('sugarss')
let globby = require('globby')
let vars = require('postcss-simple-vars')
let fs = require('fs')

let readFile = promisify(fs.readFile)

let IS_WIN = platform().includes('win32')

function insideDefine (rule) {
  let parent = rule.parent
  if (!parent) {
    return false
  } else if (parent.name === 'define-mixin') {
    return true
  } else {
    return insideDefine(parent)
  }
}

function processMixinContent (rule, from) {
  rule.walkAtRules('mixin-content', content => {
    if (from.nodes && from.nodes.length > 0) {
      content.replaceWith(from.clone().nodes)
    } else {
      content.remove()
    }
  })
}

function insertObject (rule, obj, processMixins) {
  let root = jsToCss(obj)
  root.each(node => {
    node.source = rule.source
  })
  processMixins(root)
  processMixinContent(root, rule)
  rule.parent.insertBefore(rule, root)
}

function insertMixin (result, mixins, rule, processMixins, opts) {
  let name = rule.params.split(/\s/, 1)[0]
  let rest = rule.params.slice(name.length).trim()

  let params
  if (rest.trim() === '') {
    params = []
  } else {
    params = postcss.list.comma(rest)
  }

  let meta = mixins[name]
  let mixin = meta && meta.mixin

  if (!meta) {
    if (!opts.silent) {
      throw rule.error('Undefined mixin ' + name)
    }
  } else if (mixin.name === 'define-mixin') {
    let i
    let values = {}
    for (i = 0; i < meta.args.length; i++) {
      values[meta.args[i][0]] = params[i] || meta.args[i][1]
    }

    let proxy = postcss.root()
    for (i = 0; i < mixin.nodes.length; i++) {
      let node = mixin.nodes[i].clone()
      delete node.raws.before
      proxy.append(node)
    }

    if (meta.args.length) {
      proxy = postcss([vars({ only: values })]).process(proxy).root
    }

    if (meta.content) processMixinContent(proxy, rule)
    processMixins(proxy)

    rule.parent.insertBefore(rule, proxy)
  } else if (typeof mixin === 'object') {
    insertObject(rule, mixin, processMixins)
  } else if (typeof mixin === 'function') {
    let args = [rule].concat(params)
    rule.walkAtRules(atRule => {
      insertMixin(result, mixins, atRule, processMixins, opts)
    })
    let nodes = mixin(...args)
    if (typeof nodes === 'object') {
      insertObject(rule, nodes, processMixins)
    }
  } else {
    throw new Error('Wrong ' + name + ' mixin type ' + typeof mixin)
  }

  if (rule.parent) rule.remove()
}

function defineMixin (result, mixins, rule) {
  let name = rule.params.split(/\s/, 1)[0]
  let other = rule.params.slice(name.length).trim()

  let args = []
  if (other.length) {
    args = postcss.list.comma(other).map(str => {
      let arg = str.split(':', 1)[0]
      let defaults = str.slice(arg.length + 1)
      return [arg.slice(1).trim(), defaults.trim()]
    })
  }

  let content = false
  rule.walkAtRules('mixin-content', () => {
    content = true
    return false
  })

  mixins[name] = { mixin: rule, args, content }
  rule.remove()
}

module.exports = (opts = {}) => {
  if (typeof opts === 'undefined') opts = {}

  let cwd = process.cwd()
  let globs = []

  if (opts.mixinsDir) {
    if (!Array.isArray(opts.mixinsDir)) {
      opts.mixinsDir = [opts.mixinsDir]
    }
    globs = opts.mixinsDir.map(dir => join(dir, '*.{js,json,css,sss,pcss}'))
  }

  if (opts.mixinsFiles) globs = globs.concat(opts.mixinsFiles)

  return {
    postcssPlugin: 'postcss-mixins',
    prepare (result) {
      let mixins = {}

      return {
        Root (css) {
          function processMixins (root) {
            root.walkAtRules(i => {
              if (i.name === 'mixin' || i.name === 'add-mixin') {
                if (!insideDefine(i)) {
                  insertMixin(result, mixins, i, processMixins, opts)
                }
              } else if (i.name === 'define-mixin') {
                defineMixin(result, mixins, i)
              }
            })
          }

          function process () {
            if (typeof opts.mixins === 'object') {
              for (let i in opts.mixins) {
                mixins[i] = { mixin: opts.mixins[i] }
              }
            }
            processMixins(css)
          }

          if (globs.length === 0) {
            process()
            return
          }

          // Windows bug with { nocase: true } due to node-glob issue
          // https://github.com/isaacs/node-glob/issues/123
          return globby(globs, { caseSensitiveMatch: IS_WIN })
            .then(files => {
              return Promise.all(
                files.map(async file => {
                  let ext = extname(file).toLowerCase()
                  let name = basename(file, extname(file))
                  let rel = join(cwd, relative(cwd, file))
                  let parent = ''
                  if (opts.parent) {
                    parent = opts.parent
                  }
                  result.messages.push({
                    type: 'dependency',
                    file: rel,
                    parent
                  })
                  if (ext === '.css' || ext === '.pcss' || ext === '.sss') {
                    let content = await readFile(rel)
                    let root
                    if (ext === '.sss') {
                      root = sugarss.parse(content, { from: rel })
                    } else {
                      root = postcss.parse(content, { from: rel })
                    }
                    root.walkAtRules('define-mixin', atrule => {
                      defineMixin(result, mixins, atrule)
                    })
                  } else {
                    mixins[name] = { mixin: require(rel) }
                  }
                })
              )
            })
            .then(process)
        }
      }
    }
  }
}
module.exports.postcss = true
