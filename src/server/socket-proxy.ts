import { Server as SocketServer, type Socket as ServerSocket } from 'socket.io'
import { io as ClientIO, type Socket as ClientSocket } from 'socket.io-client'
import { HttpServer, ViteDevServer } from 'vite'

import { context, ENVOptions } from '@/context'
import { handlebarsTracker } from '@/server/trackers/handlebars-tracker'
import * as FsUtilities from '@/utils/fs-utilities'
import * as Logger from '@/utils/logger'
import * as PathUtilities from '@/utils/path-utilities'

type Acknowledge = (...response: unknown[]) => void

function createUpstream(upstreamUrl: string, socket: ServerSocket): ClientSocket {
  // Foundry VTT 14.366+ authenticates via the session cookie instead of the query param.
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(socket.handshake.headers)) {
    if (typeof value === 'string') headers[name] = value
  }

  const upstream = ClientIO(upstreamUrl, {
    transports: ['websocket'],
    upgrade: false,
    query: socket.handshake.query,
    extraHeaders: headers,
  })

  let warnedAboutUnreachable = false
  upstream.on('connect_error', error => {
    if (warnedAboutUnreachable) return
    warnedAboutUnreachable = true
    Logger.warn(`Cannot reach Foundry VTT at ${upstreamUrl} — is it running? (${error.message})`)
  })
  upstream.on('connect', () => {
    warnedAboutUnreachable = false
  })
  return upstream
}

async function tryServeLocalTemplate(
  requestPath: string,
  acknowledge?: Acknowledge,
): Promise<boolean> {
  const localPath = await PathUtilities.foundryVTTUrlToLocal(requestPath)
  if (!localPath) return false

  try {
    const html = await FsUtilities.readFile(localPath)
    if (acknowledge) acknowledge({ html, success: true })
    handlebarsTracker.addFile(requestPath, localPath)
    return true
  } catch (error) {
    Logger.warn(`Failed to read local template "${localPath}", forwarding to Foundry: ${error}`)
    return false
  }
}

export default function socketProxy(server: ViteDevServer) {
  const environment = context.env as ENVOptions
  const ioProxy = new SocketServer(server.httpServer as HttpServer, { path: '/socket.io' })

  ioProxy.on('connection', socket => {
    const upstreamUrl = `http://${environment.foundryUrl}:${environment.foundryPort}`
    const upstream = createUpstream(upstreamUrl, socket)

    // Browser >>> Foundry [intercept templating calls]
    socket.onAny(async (event, ...parameters) => {
      const maybeAck = typeof parameters.at(-1) === 'function' ? parameters.pop() : undefined

      if (event === 'template' && (await tryServeLocalTemplate(parameters[0], maybeAck))) return

      // An ack callback with no timeout lives on the sender until the other side acks. Broadcast
      // events are never acked, so always passing one piles callbacks up over a long dev session
      // (and hands handlers an argument they never sent).
      if (maybeAck) {
        const acknowledge = maybeAck as Acknowledge
        upstream.emit(event, ...parameters, (response: unknown) => acknowledge(response))
      } else {
        upstream.emit(event, ...parameters)
      }
    })

    // Foundry >>> Browser [just forward]
    upstream.onAny((event, ...parameters) => {
      const lastArgument = parameters.at(-1)
      const maybeAck = typeof lastArgument === 'function' ? parameters.pop() : undefined
      if (maybeAck) {
        const acknowledge = maybeAck as Acknowledge
        socket.emit(event, ...parameters, (response: unknown) => acknowledge(response))
      } else {
        socket.emit(event, ...parameters)
      }
    })

    // Clean up the upstream connection to avoid potential leak
    socket.on('disconnect', () => {
      upstream.close()
    })
  })
}
