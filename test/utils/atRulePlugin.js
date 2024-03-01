module.exports = (opts) => {
  return {
    postcssPlugin: 'at-rule-plugin',

    prepare() {
      return {
        AtRule(node) {
          if (node.params.includes(opts.from)) {
            node.params = node.params.replace(opts.from, opts.to)
          }
        }
      }
    }
  }
}

module.exports.postcss = true
