import { ViteDevServer } from 'vite'
import { handlebarsTracker } from './trackers/handlebars-tracker'
import { languageTracker } from './trackers/language-tracker'
import httpMiddleware from './http-middleware'
import socketProxy from './socket-proxy'

export default function setupDevServer(server: ViteDevServer) {
  // initialize the tracking of templates && language files
  handlebarsTracker.initialize(server)
  languageTracker.initialize(server)
  // Virtualize http calls: css entry points & language files
  httpMiddleware(server)
  // Serve templates from our files
  socketProxy(server)
}
