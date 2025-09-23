import path from 'path'
import { LibraryOptions, Plugin, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import loadEnv from 'src/config/env'
import loadManifest from 'src/config/foundryvtt-manifest'
import createPartialViteConfig from 'src/config/vite-options'
import loadLanguage, { getLocalLanguageFiles } from 'src/language/loader'
import { transform } from 'src/language/transformer'
import validateI18nBuild from 'src/language/validator'
import { compileManifestPacks } from 'src/packs/compile-packs'
import setupDevServer from 'src/server'
import jsToInject from 'src/server/hmr-client'
import FsUtils from 'src/utils/fs-utils'
import PathUtils from 'src/utils/path-utils'

export default async function foundryVTTPlugin(options = { buildPacks: true }): Promise<Plugin> {
  context.env = await loadEnv()

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
        const src = path.resolve(file)
        if (!PathUtils.getPublicDirFile(file) && (await FsUtils.fileExists(src))) {
          this.addWatchFile(src)
          const manifest = await FsUtils.readJson(src)
          this.emitFile({
            type: 'asset',
            fileName: file,
            source: JSON.stringify(manifest, null, 2),
          })
        }
      }

      const languages = context.manifest?.languages ?? []
      if (languages.length > 0) {
        for (const language of languages) {
          if (await PathUtils.getPublicDirFile(language.path)) continue
          getLocalLanguageFiles(language.lang).then(langFiles => {
            langFiles.forEach(file => this.addWatchFile(file))
          })
          const languageDataRaw = await loadLanguage(language.lang)
          const languageData = transform(languageDataRaw)
          this.emitFile({
            type: 'asset',
            fileName: path.join(language.path),
            source: JSON.stringify(languageData, null, 2),
          })
        }
      }
    },
    async writeBundle() {
      if (options.buildPacks) await compileManifestPacks()
    },
    closeBundle() {
      const languages = context.manifest?.languages ?? []
      if (languages.length > 0) {
        validateI18nBuild()
      }
    },
    // all server behaviour
    load(id) {
      const config = context.config as ResolvedConfig
      const jsFileName = (config.build.rollupOptions?.output as any)!.entryFileNames
      if (id === jsFileName || id === `/${jsFileName}`) {
        const entryPath = path.resolve((config.build.lib as LibraryOptions).entry as string)
        const viteId = `/@fs/${entryPath}`
        return `import '${viteId}';\n${jsToInject}`
      }
    },
    configureServer: setupDevServer,
  }
}
