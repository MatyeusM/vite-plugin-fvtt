import path from 'node:path'

import { LibraryOptions, ResolvedConfig, ViteDevServer } from 'vite'

import { context, FoundryVTTManifest } from '@/context'
import loadLanguage from '@/language/loader'
import { transform } from '@/language/transformer'
import * as Logger from '@/utils/logger'
import * as PathUtils from '@/utils/path-utilities'

function shouldBlockCss(requestUrl: string): boolean {
  const config = context.config as ResolvedConfig
  const cssEntryName = (config.build.lib as LibraryOptions).cssFileName
  const cssEntry = cssEntryName ? PathUtils.localToFoundryVTTUrl(`${cssEntryName}.css`) : undefined
  const cssFileName = context.manifest?.styles[0] ?? 'styles/bundle.css'
  const cssFile = cssFileName ? PathUtils.localToFoundryVTTUrl(cssFileName) : undefined

  const normalizedPath = path.posix.normalize(requestUrl)
  return normalizedPath === cssEntry || normalizedPath === cssFile
}

interface ClosableResponse {
  setHeader: (name: string, value: string) => void
  end: (chunk: string) => void
  statusCode: number
}

function handleLanguageRequest(lang: string, response: ClosableResponse) {
  loadLanguage(lang)
    .then(language => {
      const jsonData = transform(language)
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(jsonData, undefined, 2))
      return jsonData
    })
    .catch((error: unknown) => {
      Logger.error(error)
      response.statusCode = 500
      response.end('Internal Server Error')
    })
}

export default function httpMiddlewareHook(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const requestUrl = request.url ?? ''
    if (!PathUtils.isFoundryVTTUrl(requestUrl)) {
      next()
      return
    }

    if (shouldBlockCss(requestUrl)) {
      Logger.info(`Blocking CSS entry to ${request.url}`)
      response.setHeader('Content-Type', 'text/css')
      response.end('/* The cake is in another castle. */')
      return
    }

    const normalizedUrl = path.posix.normalize(requestUrl)
    const languages = (context.manifest as FoundryVTTManifest).languages.filter(
      lang => PathUtils.localToFoundryVTTUrl(lang.path) === normalizedUrl,
    )

    if (languages.length !== 1) {
      next()
      return
    }

    handleLanguageRequest(languages[0].lang, response)
  })
}
