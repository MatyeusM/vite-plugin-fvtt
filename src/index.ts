import path from 'node:path'
import { LibraryOptions, Plugin, ResolvedConfig } from 'vite'
import { context } from '@/context'
import loadEnvironment from '@/config/environment'
import loadManifest from '@/config/foundryvtt-manifest'
import createPartialViteConfig from '@/config/vite-options'
import loadLanguage, { getLocalLanguageFiles } from '@/language/loader'
import { transform } from '@/language/transformer'
import validateI18nBuild from '@/language/validator'
import { compileManifestPacks } from '@/packs/compile-packs'
import setupDevelopmentServer from '@/server'
import jsToInject from '@/server/hmr-client'
import * as FsUtilities from '@/utils/fs-utilities'
import * as PathUtilities from '@/utils/path-utilities'

export default async function foundryVTTPlugin({ buildPacks = true } = {}): Promise<Plugin> {
  context.env = await loadEnvironment()

  return {
    name: 'vite-plugin-fvtt',
    async config(config) {
      context.manifest = (await loadManifest(config)) ?? undefined
      return createPartialViteConfig(config)
    },
    configResolved(config) {
      context.config = config
    },
    async generateBundle() {
      const manifestCandidates = ['system.json', 'module.json']

      for (const file of manifestCandidates) {
        const source = path.resolve(file)
        if (
          !(await PathUtilities.getPublicDirectoryFile(file)) &&
          (await FsUtilities.fileExists(source))
        ) {
          this.addWatchFile(source)
          const manifest = await FsUtilities.readJson(source)
          this.emitFile({
            type: 'asset',
            fileName: file,
            source: JSON.stringify(manifest, undefined, 2),
          })
        }
      }

      const languages = context.manifest?.languages ?? []
      if (languages.length > 0) {
        for (const language of languages) {
          if (await PathUtilities.getPublicDirectoryFile(language.path)) continue
          getLocalLanguageFiles(language.lang).then(langFiles => {
            for (const file of langFiles) this.addWatchFile(file)
          })
          const languageDataRaw = await loadLanguage(language.lang)
          const languageData = transform(languageDataRaw)
          this.emitFile({
            type: 'asset',
            fileName: path.join(language.path),
            source: JSON.stringify(languageData, undefined, 2),
          })
        }
      }
    },
    async writeBundle() {
      if (buildPacks) await compileManifestPacks()
    },
    closeBundle() {
      const languages = context.manifest?.languages ?? []
      if (languages.length > 0 && context.config?.command === 'build') {
        validateI18nBuild()
      }
    },
    // all server behaviour
    load(id) {
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
    },
    configureServer: setupDevelopmentServer,
  }
}
