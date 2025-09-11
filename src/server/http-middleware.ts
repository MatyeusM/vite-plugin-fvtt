import path from 'path'
import { context, FoundryVTTManifest } from 'src/context'
import { LibraryOptions, ResolvedConfig, ViteDevServer } from 'vite'
import pathUtils from 'src/utils/path-utils'
import loadLanguage from 'src/language/loader'
import { transform } from 'src/language/transformer'
import Logger from 'src/utils/logger'

export default function httpMiddlewareHook(server: ViteDevServer) {
  server.middlewares.use((req, res, next) => {
    const config = context.config as ResolvedConfig

    // This is a defensive check to make sure we don't handle requests
    // that don't belong to our module or system.
    if (!pathUtils.isFoundryVTTUrl(req.url ?? '')) {
      next()
      return
    }

    // Get the filenames from the resolved config, as they are now finalized.
    const cssFileName = (config.build.lib as LibraryOptions).cssFileName
    const cssEntry = cssFileName ? pathUtils.localToFoundryVTTUrl(`${cssFileName}.css`) : null

    if (path.posix.normalize(req.url ?? '') === cssEntry) {
      Logger.info(`Blocking CSS entry to ${req.url}`)
      res.setHeader('Content-Type', 'text/css')
      res.end('/* The cake is in another castle. */')
      return
    }

    const languages = (context.manifest as FoundryVTTManifest).languages.filter(
      lang => pathUtils.localToFoundryVTTUrl(lang.path) === path.posix.normalize(req.url ?? ''),
    )

    if (languages.length === 1) {
      const lang = languages[0].lang
      const language = loadLanguage(lang)
      const jsonData = transform(language)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(jsonData, null, 2))
      return
    }
    next()
  })
}
