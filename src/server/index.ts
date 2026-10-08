import path from 'node:path'

import { type LibraryOptions, type ResolvedConfig, type ViteDevServer } from 'vite'

import { context } from '@/context'
import { forcedEntryFileName } from '@/utils/path-utilities'

import jsToInject from './hmr-client'
import httpMiddleware from './http-middleware'
import socketProxy from './socket-proxy'
import { handlebarsTracker } from './trackers/handlebars-tracker'
import { languageTracker } from './trackers/language-tracker'

export default function setupDevelopmentServer(server: ViteDevServer) {
  // initialize the tracking of templates && language files
  handlebarsTracker.initialize(server)
  languageTracker.initialize(server)
  // Virtualize http calls: css entry points & language files
  httpMiddleware(server)
  // Serve templates from our files
  socketProxy(server)
}

/** Map the built entry id to the source entry plus the HMR client for the dev server. */
export function devEntryImport(id: string): string | undefined {
  const config = context.config as ResolvedConfig
  const output = config.build.rollupOptions?.output
  const entryFileNames = Array.isArray(output) ? output[0]?.entryFileNames : output?.entryFileNames
  // The entry pattern can be a function when output options are overridden.
  const jsFileName =
    typeof entryFileNames === 'function' ? forcedEntryFileName() : String(entryFileNames)

  if (id === jsFileName || id === `/${jsFileName}`) {
    const entryPath = path.resolve((config.build.lib as LibraryOptions).entry as string)
    const viteId = `/@fs/${entryPath}`
    return `import '${viteId}';\n${jsToInject}`
  }
  return undefined
}
