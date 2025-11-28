import path from 'node:path'
import { context, FoundryVTTManifest } from 'src/context'
import { LibraryOptions, ResolvedConfig, ViteDevServer } from 'vite'
import loadLanguage from 'src/language/loader'
import { transform } from 'src/language/transformer'
import * as Logger from 'src/utils/logger'
import * as PathUtils from 'src/utils/path-utilities'

export default function httpMiddlewareHook(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const config = context.config as ResolvedConfig

    // This is a defensive check to make sure we don't handle requests
    // that don't belong to our module or system.
    if (!PathUtils.isFoundryVTTUrl(request.url ?? '')) {
      next()
      return
    }

    // Get the filenames from the resolved config, as they are now finalized.
    const cssEntryName = (config.build.lib as LibraryOptions).cssFileName
    const cssEntry = cssEntryName
      ? PathUtils.localToFoundryVTTUrl(`${cssEntryName}.css`)
      : undefined
    const cssFileName = context.manifest?.styles[0] ?? 'styles/bundle.css'
    const cssFile = cssFileName ? PathUtils.localToFoundryVTTUrl(`${cssFileName}`) : undefined

    const normalizedPath = path.posix.normalize(request.url ?? '')

    if (normalizedPath === cssEntry || normalizedPath == cssFile) {
      Logger.info(`Blocking CSS entry to ${request.url}`)
      response.setHeader('Content-Type', 'text/css')
      response.end('/* The cake is in another castle. */')
      return
    }

    const languages = (context.manifest as FoundryVTTManifest).languages.filter(
      lang => PathUtils.localToFoundryVTTUrl(lang.path) === path.posix.normalize(request.url ?? ''),
    )

    if (languages.length === 1) {
      const lang = languages[0].lang
      const language = await loadLanguage(lang)
      const jsonData = transform(language)
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(jsonData, undefined, 2))
      return
    }
    next()
  })
}
