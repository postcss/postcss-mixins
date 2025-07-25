import type { PluginCreator, AtRule } from 'postcss'

export type MixinOutput = Record<string, string | MixinOutput>

export interface Mixin {
  (mixinAtRule: AtRule, ...args: string[])
}

export type Mixins = Record<string, MixinOutput | Mixin>

declare const mixins: PluginCreator<{
  mixins: Mixins
  mixinsDir?: string | string[]
  mixinsFiles?: string | string[]
  silent?: boolean
}>

export default mixins
