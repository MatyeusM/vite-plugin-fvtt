import fs from 'fs-extra'
import { context, FoundryVTTManifest } from 'src/context'
import { buildExpectedSrcPath, buildLanguage } from '../i18n/transformer.mjs'
import { languageTracker } from 'src/server/trackers/language-tracker'
import { LibraryOptions, ResolvedConfig, ViteDevServer } from 'vite'
import path from 'src/utils/path-utils'

export default function httpMiddlewareHook(server: ViteDevServer) {
  server.middlewares.use((req, res, next) => {
    const config = context.config as ResolvedConfig

    // This is a defensive check to make sure we don't handle requests
    // that don't belong to our module or system.
    if (path.isFoundryVTTUrl(req.url ?? '')) {
      next()
      return
    }

    // Get the filenames from the resolved config, as they are now finalized.
    const cssFileName = (config.build.lib as LibraryOptions).cssFileName
    const cssEntry = cssFileName ? path.localToFoundryVTTUrl(`${cssFileName}.css`) : null

    if (path.normalize(req.url ?? '') === cssEntry) {
      res.setHeader('Content-Type', 'text/css')
      res.end('/* The cake is in another castle. */')
      return
    }

    const languages = (context.manifest as FoundryVTTManifest).languages.filter(
      lang => path.localToFoundryVTTUrl(lang.path) === path.normalize(req.url ?? ''),
    )

    if (languages.length === 1) {
      const language = languages[0]
      const localPublicPath = path.posix.join(config.publicDir, language.path)
      const expectedSrcPath = buildExpectedSrcPath(config, language)
      if (!fs.existsSync(localPublicPath)) {
        res.setHeader('Content-Type', 'application/json')
        res.end(buildLanguage(expectedSrcPath, language.lang))
      } else {
        languageTracker.addFile(language.lang, localPublicPath)
      }
    }
    next()
  })
}
