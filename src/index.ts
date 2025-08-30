import fs from 'fs-extra'
import posix from 'path/posix'
import { LibraryOptions, Plugin, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import loadEnv from 'src/config/env'
import loadManifest from 'src/config/foundryvtt-manifest'
import createPartialViteConfig from 'src/config/vite-options'
import jsToInject from 'src/server/hmr-client'
import setupDevServer from 'src/server'
import validateI18nBuild from 'src/language/validator'
import loadLanguage from 'src/language/loader'
import path from 'src/utils/path-utils'
import { transform } from './language/transformer'
import logger from 'src/utils/logger'

export default function foundryVTTPlugin(): Plugin {
  context.env = loadEnv()

  return {
    name: 'vite-plugin-foundryvtt',
    config(config) {
      context.manifest = loadManifest(config)
      return createPartialViteConfig(config)
    },
    configResolved(config) {
      context.config = config
    },
    async closeBundle() {
      if (context.config?.mode !== 'production') return
      const outDir = posix.resolve(process.cwd(), context.config.build.outDir)
      const candidates = ['system.json', 'module.json']

      for (const file of candidates) {
        const src = posix.resolve(process.cwd(), file)
        if (await fs.pathExists(src)) {
          const dest = posix.join(outDir, file)
          await fs.copy(src, dest)
          logger.info(`Copied ${file} >>> ${dest}`)
        }
      }

      const languages = context.manifest?.languages ?? []
      if (languages.length > 0) {
        for (const language of languages) {
          if (path.getOutDirFile(language.path) !== '') continue
          const languageDataRaw = loadLanguage(language.lang)
          const languageData = transform(languageDataRaw)
          fs.writeJSONSync(posix.join(path.getOutDir(), language.path), languageData)
        }
        validateI18nBuild()
      }
    },
    // all server behaviour
    load(id) {
      const config = context.config as ResolvedConfig
      const jsFileName = (config.build.lib as LibraryOptions).fileName as string
      if (id === jsFileName || id === `/${jsFileName}`) {
        const entryPath = posix.resolve((config.build.lib as LibraryOptions).entry as string)
        const viteId = `/@fs/${entryPath}`
        return `import '${viteId}';\n${jsToInject}`
      }
    },
    configureServer: setupDevServer,
  }
}
