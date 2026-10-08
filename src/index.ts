import { type OutputBundle } from 'rolldown'
import { Plugin, ResolvedConfig, UserConfig } from 'vite'

import {
  generateBundle,
  collapseLoneOutputs,
  assertOverwriteManifest,
  type PluginContext,
} from '@/bundle'
import {
  createPartialViteConfig,
  loadEnvironment,
  loadManifest,
  normalizeOverwrite,
} from '@/config'
import { context, type OverwriteKind } from '@/context'
import validateI18nBuild from '@/language/validator'
import { compileManifestPacks } from '@/packs/compile-packs'
import setupDevelopmentServer, { devEntryImport } from '@/server'

export default async function foundryVTTPlugin({
  buildPacks = true,
  overwrite = [],
}: { buildPacks?: boolean; overwrite?: OverwriteKind | OverwriteKind[] } = {}): Promise<Plugin> {
  context.env = await loadEnvironment()
  context.overwrite = normalizeOverwrite(overwrite)
  return createPluginInstance(buildPacks)
}

function createPluginInstance(buildPacks: boolean): Plugin {
  class FoundryVTTPluginInstance implements Plugin {
    name = 'vite-plugin-fvtt'

    configureServer = setupDevelopmentServer

    async config(config: UserConfig) {
      context.manifest = (await loadManifest(config)) ?? undefined
      return createPartialViteConfig(config)
    }

    configResolved(config: ResolvedConfig) {
      context.config = config
      if (config.command === 'build') return assertOverwriteManifest()
    }

    // Post-order: only then are Vite's own emissions (css) visible in the bundle.
    generateBundle = {
      order: 'post' as const,
      handler: async function (this: PluginContext, _options: unknown, bundle: OutputBundle) {
        await generateBundle(this, bundle)
      },
    }

    async writeBundle(_options: unknown, bundle: OutputBundle) {
      await collapseLoneOutputs(bundle)
      if (buildPacks) await compileManifestPacks()
    }

    closeBundle() {
      const languages = context.manifest?.languages ?? []
      if (languages.length > 0 && context.config?.command === 'build') {
        validateI18nBuild()
      }
    }

    // all server behaviour
    load(id: string) {
      return devEntryImport(id)
    }
  }

  return new FoundryVTTPluginInstance()
}
