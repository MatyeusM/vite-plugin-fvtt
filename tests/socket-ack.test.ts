import fs from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import path from 'node:path'

import { Server as FakeFoundry, type Socket as UpstreamSocket } from 'socket.io'
import { io as browserIO, type Socket as BrowserSocket } from 'socket.io-client'
import { defineConfig, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import foundryVTT from '../src/index'
import { CSS, JS, LANGUAGE, MANIFEST } from './fixture-data'
import {
  createTestFiles,
  createTestServer,
  generateTemporaryDirectory,
  stopTestServer,
  writeManifest,
} from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()
const UPSTREAM_PORT = 32100
const DEV_PORT = UPSTREAM_PORT + 1

const testContext = {
  server: undefined as ViteDevServer | undefined,
  upstream: undefined as FakeFoundry | undefined,
  upstreamSocket: undefined as UpstreamSocket | undefined,
  browser: undefined as BrowserSocket | undefined,
}

async function startFakeUpstream(): Promise<void> {
  const http = createHttpServer()
  const upstream = new FakeFoundry(http)
  await new Promise<void>(resolve => {
    http.listen(UPSTREAM_PORT, () => resolve())
  })
  upstream.on('connection', socket => {
    testContext.upstreamSocket = socket
  })
  testContext.upstream = upstream
}

async function createProxyServer(): Promise<void> {
  const config = defineConfig({
    plugins: [await foundryVTT()],
    build: { lib: { entry: './src/main.js' } },
  })
  testContext.server = await createTestServer(config)
}

/** Recursive rather than a loop, to satisfy `no-await-in-loop`. */
async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 10_000
  if (condition()) return
  if (Date.now() > deadline) throw new Error('Timed out waiting for condition')
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 50)
  })
  return waitFor(condition)
}

async function connectBrowser(): Promise<void> {
  const browser = browserIO(`http://localhost:${DEV_PORT}`, { transports: ['websocket'] })
  await waitFor(() => browser.connected)
  testContext.browser = browser
}

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
  await createTestFiles(TEMPORARY_TEST_DIRECTORY, { ...JS, ...CSS, ...LANGUAGE })
  await writeManifest(MANIFEST, TEMPORARY_TEST_DIRECTORY, true)
  await fs.writeFile(
    path.join(TEMPORARY_TEST_DIRECTORY, '.env.foundryvtt'),
    'FOUNDRY_URL=localhost\nFOUNDRY_PORT=32100',
  )
  await startFakeUpstream()
  await createProxyServer()
  await connectBrowser()
  await waitFor(() => testContext.upstreamSocket !== undefined)
})

afterEach(async () => {
  testContext.browser?.close()
  testContext.upstream?.close()
  if (testContext.server) await stopTestServer(testContext.server)
  testContext.server = undefined
  testContext.upstream = undefined
  testContext.upstreamSocket = undefined
  testContext.browser = undefined
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true })
  vi.restoreAllMocks()
})

describe('socket proxy without ack', () => {
  it('forwards browser events with the original arguments', async () => {
    const received: Array<Array<unknown>> = []
    testContext.upstreamSocket?.onAny((...args: Array<unknown>) => {
      received.push(args)
    })
    testContext.browser?.emit('cursor-move', { x: 1, y: 2 })

    await waitFor(() => received.length === 1)
    expect(received[0]).toEqual(['cursor-move', { x: 1, y: 2 }])
  })

  it('forwards Foundry events with the original arguments', async () => {
    const received: Array<Array<unknown>> = []
    testContext.browser?.onAny((...args: Array<unknown>) => {
      received.push(args)
    })
    testContext.upstreamSocket?.emit('chat-message', { text: 'hello' })

    await waitFor(() => received.length === 1)
    expect(received[0]).toEqual(['chat-message', { text: 'hello' }])
  })
})

describe('socket proxy with ack', () => {
  it('delivers a browser-requested ack from Foundry', async () => {
    testContext.upstreamSocket?.on(
      'roll',
      (payload: unknown, acknowledge: (value: unknown) => void) => {
        acknowledge({ success: true, payload })
      },
    )
    const response = await new Promise<unknown>(resolve => {
      testContext.browser?.emit('roll', { dice: '1d20' }, (value: unknown) => {
        resolve(value)
      })
    })
    expect(response).toEqual({ success: true, payload: { dice: '1d20' } })
  })

  it('delivers a Foundry-requested ack from the browser', async () => {
    testContext.browser?.on('query', (payload: unknown, acknowledge: (value: unknown) => void) => {
      acknowledge({ echo: payload })
    })
    const response = await new Promise<unknown>(resolve => {
      testContext.upstreamSocket?.emit('query', { ping: 1 }, (value: unknown) => {
        resolve(value)
      })
    })
    expect(response).toEqual({ echo: { ping: 1 } })
  })
})
