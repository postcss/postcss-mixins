let { join, basename, extname, relative } = require('path')
let { readFileSync } = require('fs')
let { platform } = require('os')
let { parse } = require('postcss-js')
let sugarss = require('sugarss')
let vars = require('postcss-simple-vars')
let glob = require('fast-glob')

let MIXINS_GLOB = '*.{js,json,css,sss,pcss}'
let IS_WIN = platform().includes('win32')

function addMixin(helpers, mixins, rule, file) {
  let name = rule.params.split(/\s/, 1)[0]
  let other = rule.params.slice(name.length).trim()

  let args = []
  if (other.length) {
    args = helpers.list.comma(other).map(str => {
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
  if (file) mixins[name].file = file
  rule.remove()
}

function processModulesForHotReloadRecursively(module, helpers) {
  let moduleId = module.id
  module.children.forEach(childModule => {
    helpers.result.messages.push({
      type: 'dependency',
      file: childModule.id,
      parent: moduleId
    })
    processModulesForHotReloadRecursively(childModule, helpers)
  })
  delete require.cache[moduleId]
}

function loadGlobalMixin(helpers, globs) {
  let cwd = process.cwd()
  let files = glob.sync(globs, { caseSensitiveMatch: IS_WIN })
  let mixins = {}
  files.forEach(i => {
    let ext = extname(i).toLowerCase()
    let name = basename(i, extname(i))
    let path = join(cwd, relative(cwd, i))
    if (ext === '.css' || ext === '.pcss' || ext === '.sss') {
      let content = readFileSync(path)
      let root
      if (ext === '.sss') {
        root = sugarss.parse(content, { from: path })
      } else {
        root = helpers.parse(content, { from: path })
      }
      root.walkAtRules('define-mixin', atrule => {
        addMixin(helpers, mixins, atrule, path)
      })
    } else {
      try {
        mixins[name] = { mixin: require(path), file: path }
        let module = require.cache[require.resolve(path)]
        if (module) {
          processModulesForHotReloadRecursively(module, helpers)
        }
      } catch {}
    }
  })
  return mixins
}

function addGlobalMixins(helpers, local, global, parent) {
  for (let name in global) {
    helpers.result.messages.push({
      type: 'dependency',
      file: global[name].file,
      parent: parent || ''
    })
    local[name] = global[name]
  }
}

function watchNewMixins(helpers, mixinsDirs) {
  let uniqueDirsPath = Array.from(new Set(mixinsDirs))
  for (let dir of uniqueDirsPath) {
    helpers.result.messages.push({
      type: 'dir-dependency',
      dir,
      glob: MIXINS_GLOB,
      parent: ''
    })
  }
}

function processMixinContent(rule, from) {
  rule.walkAtRules('mixin-content', content => {
    if (from.nodes && from.nodes.length > 0) {
      content.replaceWith(from.clone().nodes)
    } else {
      content.remove()
    }
  })
}

function insertObject(rule, obj) {
  let root = parse(obj)
  root.each(node => {
    node.source = rule.source
  })
  processMixinContent(root, rule)
  rule.parent.insertBefore(rule, root)
}

function insertMixin(helpers, mixins, rule, opts) {
  let name = rule.params.split(/\s/, 1)[0]
  let rest = rule.params.slice(name.length).trim()

  if (name.includes('(')) {
    throw rule.error(
      'Remove brackets from mixin. Like: @mixin name(1px) → @mixin name 1px'
    )
  }

  let params
  if (rest.trim() === '') {
    params = []
  } else {
    params = helpers.list.comma(rest)
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

    let proxy = new helpers.Root()
    for (i = 0; i < mixin.nodes.length; i++) {
      let node = mixin.nodes[i].clone()
      delete node.raws.before
      proxy.append(node)
    }

    if (meta.args.length) {
      proxy = helpers.postcss([vars({ only: values })]).process(proxy).root
    }

    if (meta.content) processMixinContent(proxy, rule)

    rule.parent.insertBefore(rule, proxy)
  } else if (typeof mixin === 'object') {
    insertObject(rule, mixin)
  } else if (typeof mixin === 'function') {
    let args = [rule].concat(params)
    rule.walkAtRules(atRule => {
      if (atRule.name === 'add-mixin' || atRule.name === 'mixin') {
        insertMixin(helpers, mixins, atRule, opts)
      }
    })
    let nodes = mixin(...args)
    if (typeof nodes === 'object') {
      insertObject(rule, nodes)
    }
  } else {
    throw new Error('Wrong ' + name + ' mixin type ' + typeof mixin)
  }

  if (rule.parent) rule.remove()
}

module.exports = (opts = {}) => {
  let loadFrom = []
  if (opts.mixinsDir) {
    if (!Array.isArray(opts.mixinsDir)) {
      opts.mixinsDir = [opts.mixinsDir]
    }
    loadFrom = opts.mixinsDir.map(dir => join(dir, MIXINS_GLOB))
  }
  if (opts.mixinsFiles) loadFrom = loadFrom.concat(opts.mixinsFiles)
  loadFrom = loadFrom.map(path => path.replace(/\\/g, '/'))

  return {
    postcssPlugin: 'postcss-mixins',

    prepare() {
      let mixins = {}

      if (typeof opts.mixins === 'object') {
        for (let i in opts.mixins) {
          mixins[i] = { mixin: opts.mixins[i] }
        }
      }

      return {
        Once(root, helpers) {
          if (loadFrom.length > 0) {
            try {
              let global = loadGlobalMixin(helpers, loadFrom)
              addGlobalMixins(helpers, mixins, global, opts.parent)
            } catch {}
          }
        },
        AtRule: {
          'define-mixin': (node, helpers) => {
            addMixin(helpers, mixins, node)
            node.remove()
          },
          'mixin': (node, helpers) => {
            insertMixin(helpers, mixins, node, opts)
          },
          'add-mixin': (node, helpers) => {
            insertMixin(helpers, mixins, node, opts)
          }
        },
        OnceExit(_, helpers) {
          if (opts.mixinsDir && opts.mixinsDir.length > 0) {
            watchNewMixins(helpers, opts.mixinsDir)
          }
        }
      }
    }
  }
}
module.exports.postcss = true
