import fs from 'fs-extra'
import { Server as SocketServer } from 'socket.io'
import { io as ClientIO } from 'socket.io-client'
import { handlebarsTracker } from 'src/server/trackers/handlebars-tracker'
import { HttpServer, ViteDevServer } from 'vite'
import { context, ENVOptions } from 'src/context'
import pathUtils from 'src/utils/path-utils'

export default function socketProxy(server: ViteDevServer) {
  const env = context.env as ENVOptions
  const ioProxy = new SocketServer(server.httpServer as HttpServer, { path: '/socket.io' })

  ioProxy.on('connection', socket => {
    const upstream = ClientIO(`http://${env.foundryUrl}:${env.foundryPort}`, {
      transports: ['websocket'],
      upgrade: false,
      query: socket.handshake.query,
    })

    // Browser >>> Foundry [intercept templating calls]
    socket.onAny((event, ...args) => {
      const maybeAck = typeof args[args.length - 1] === 'function' ? args.pop() : null

      if (event === 'template') {
        const localPath = pathUtils.foundryVTTUrlToLocal(args[0])
        if (localPath) {
          if (maybeAck) maybeAck({ html: fs.readFileSync(localPath, 'utf8'), success: true })
          handlebarsTracker.addFile(args[0], localPath)
          return
        }
      }

      upstream.emit(event, ...args, (response: unknown) => {
        if (maybeAck) maybeAck(response)
      })
    })

    // Foundry >>> Browser [just forward]
    upstream.onAny((event, ...args) => {
      const lastArg = args[args.length - 1]
      const maybeAck = typeof lastArg === 'function' ? args.pop() : null
      socket.emit(event, ...args, (response: unknown) => {
        if (maybeAck) maybeAck(response)
      })
    })
  })
}
