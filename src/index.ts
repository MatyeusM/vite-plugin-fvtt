import fs from 'fs-extra'
import posix from 'path/posix'
import { LibraryOptions, Plugin, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import loadEnv from 'src/config/env'
import loadManifest from 'src/config/foundryvtt-manifest'
import createPartialViteConfig from 'src/config/vite-options'
import loadLanguage, { getLocalLanguageFiles } from 'src/language/loader'
import { transform } from 'src/language/transformer'
import validateI18nBuild from 'src/language/validator'
import setupDevServer from 'src/server'
import jsToInject from 'src/server/hmr-client'
import logger from 'src/utils/logger'
import path from 'src/utils/path-utils'
import { compileManifestPacks } from './packs/compile-packs'

export default function foundryVTTPlugin(): Plugin {
  context.env = loadEnv()

  return {
    name: 'vite-plugin-fvtt',
    config(config) {
      context.manifest = loadManifest(config) ?? undefined
      return createPartialViteConfig(config)
    },
    configResolved(config) {
      context.config = config
    },
    async writeBundle() {
      if (!context.config) return
      const outDir = path.getOutDir()
      const candidates = ['system.json', 'module.json']

      for (const file of candidates) {
        const src = posix.resolve(file)
        if (!path.getOutDirFile(file) && fs.existsSync(src)) {
          this.addWatchFile(src)
          const dest = posix.join(outDir, file)
          await fs.copy(src, dest)
          logger.info(`Copied ${file} >>> ${dest}`)
        }
      }

      const languages = context.manifest?.languages ?? []
      if (languages.length > 0) {
        for (const language of languages) {
          if (path.getOutDirFile(language.path)) continue
          getLocalLanguageFiles(language.lang).forEach(langFile => this.addWatchFile(langFile))
          const languageDataRaw = loadLanguage(language.lang)
          const languageData = transform(languageDataRaw)
          fs.writeJSONSync(posix.join(outDir, language.path), languageData)
        }
      }

      await compileManifestPacks()
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
        const entryPath = posix.resolve((config.build.lib as LibraryOptions).entry as string)
        const viteId = `/@fs/${entryPath}`
        return `import '${viteId}';\n${jsToInject}`
      }
    },
    configureServer: setupDevServer,
  }
}
