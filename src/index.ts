import path from 'node:path'

import { LibraryOptions, Plugin, ResolvedConfig, UserConfig } from 'vite'

import { generateBundle, type PluginContext } from '@/bundle'
import { createPartialViteConfig, loadEnvironment, loadManifest } from '@/config'
import { context } from '@/context'
import validateI18nBuild from '@/language/validator'
import { compileManifestPacks } from '@/packs/compile-packs'
import setupDevelopmentServer from '@/server'
import jsToInject from '@/server/hmr-client'

export default async function foundryVTTPlugin({ buildPacks = true } = {}): Promise<Plugin> {
  context.env = await loadEnvironment()

  class FoundryVTTPluginInstance implements Plugin {
    name = 'vite-plugin-fvtt'

    configureServer = setupDevelopmentServer

    async config(config: UserConfig) {
      context.manifest = (await loadManifest(config)) ?? undefined
      return createPartialViteConfig(config)
    }

    configResolved(config: ResolvedConfig) {
      context.config = config
    }

    async generateBundle(this: PluginContext) {
      await generateBundle(this)
    }

    async writeBundle() {
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
      const config = context.config as ResolvedConfig
      const output = config.build.rollupOptions?.output
      let jsFileName: string | undefined
      if (Array.isArray(output)) jsFileName = String(output[0].entryFileNames)
      else if (output) jsFileName = String(output.entryFileNames)

      if (id === jsFileName || id === `/${jsFileName}`) {
        const entryPath = path.resolve((config.build.lib as LibraryOptions).entry as string)
        const viteId = `/@fs/${entryPath}`
        return `import '${viteId}';\n${jsToInject}`
      }
    }
  }

  return new FoundryVTTPluginInstance()
}
