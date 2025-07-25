import type { PluginCreator, AtRule } from 'postcss'

declare interface MixinOutput {
  [key: string]: string | MixinOutput
}

declare interface Mixin {
  (mixinAtRule: AtRule, ...args: string[])
}

declare type Mixins = Record<string, MixinOutput | Mixin>

declare const mixins: PluginCreator<{
  mixins?: Mixins
  mixinsDir?: string | string[]
  mixinsFiles?: string | string[]
  silent?: boolean
}>

export = mixins
