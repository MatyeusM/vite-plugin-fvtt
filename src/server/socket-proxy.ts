import { Server as SocketServer } from 'socket.io'
import { io as ClientIO } from 'socket.io-client'
import { HttpServer, ViteDevServer } from 'vite'
import { context, ENVOptions } from 'src/context'
import { handlebarsTracker } from 'src/server/trackers/handlebars-tracker'
import * as PathUtilities from 'src/utils/path-utilities'
import * as FsUtilities from 'src/utils/fs-utilities'

export default function socketProxy(server: ViteDevServer) {
  const environment = context.env as ENVOptions
  const ioProxy = new SocketServer(server.httpServer as HttpServer, { path: '/socket.io' })

  ioProxy.on('connection', socket => {
    const upstream = ClientIO(`http://${environment.foundryUrl}:${environment.foundryPort}`, {
      transports: ['websocket'],
      upgrade: false,
      query: socket.handshake.query,
    })

    // Browser >>> Foundry [intercept templating calls]
    socket.onAny(async (event, ...parameters) => {
      const maybeAck = typeof parameters.at(-1) === 'function' ? parameters.pop() : undefined

      if (event === 'template') {
        const localPath = await PathUtilities.foundryVTTUrlToLocal(parameters[0])
        if (localPath) {
          const html = await FsUtilities.readFile(localPath)
          if (maybeAck) maybeAck({ html, success: true })
          handlebarsTracker.addFile(parameters[0], localPath)
          return
        }
      }

      upstream.emit(event, ...parameters, (response: unknown) => {
        if (maybeAck) maybeAck(response)
      })
    })

    // Foundry >>> Browser [just forward]
    upstream.onAny((event, ...parameters) => {
      const lastArgument = parameters.at(-1)
      const maybeAck = typeof lastArgument === 'function' ? parameters.pop() : undefined
      socket.emit(event, ...parameters, (response: unknown) => {
        if (maybeAck) maybeAck(response)
      })
    })
  })
}
