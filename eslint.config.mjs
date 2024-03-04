import loguxConfig from '@logux/eslint-config'

export default [
  ...loguxConfig,
  {
    rules: {
      'n/global-require': 'off'
    }
  }
]
