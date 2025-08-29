import fs from 'fs-extra'
import path from 'path/posix'
import { LibraryOptions, Plugin, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import loadEnv from 'src/config/env'
import loadManifest from 'src/config/foundryvtt-manifest'
import createPartialViteConfig from 'src/config/vite-options'
import jsToInject from 'src/server/hmr-client'
import setupDevServer from './server'
import validateI18nBuild from './language/validator'

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
      const outDir = path.resolve(process.cwd(), context.config.build.outDir)
      const candidates = ['system.json', 'module.json']

      for (const file of candidates) {
        const src = path.resolve(process.cwd(), file)
        if (await fs.pathExists(src)) {
          const dest = path.join(outDir, file)
          await fs.copy(src, dest)
          console.log(`Copied ${file} >>> ${dest}`)
        }
      }

      const languages = context.manifest.languages
      if (languages.length > 0) {
        buildI18n(context.manifest.languages, context.config)
        validateI18nBuild()
      }
    },
    // all server behaviour
    load(id) {
      const config = context.config as ResolvedConfig
      const jsFileName = (config.build.lib as LibraryOptions).fileName as string
      if (id === jsFileName || id === `/${jsFileName}`) {
        const entryPath = path.resolve((config.build.lib as LibraryOptions).entry as string)
        const viteId = `/@fs/${entryPath}`
        return `import '${viteId}';\n${jsToInject}`
      }
    },
    configureServer: setupDevServer,
  }
}
