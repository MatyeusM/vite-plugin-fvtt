/**
 * End-to-end smoke test against a real Foundry VTT instance driven through the Vite dev server.
 *
 * Runs as part of `vitest run`, and skips itself unless a usable instance is up:
 *   mise run -C local start-v14
 *   pnpm run test -- --run
 *
 * Only one Foundry instance may run at a time (single license), so the suite targets whichever
 * version is actually listening, or the one named by `FVTT_E2E_VERSION`. The dev server is started
 * and stopped here; Foundry itself is managed by `mise`.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface FoundryVersion {
  id: string
  /** Foundry install dir under local/. */
  foundryDir: string
  port: number
  /** Sheet template the marker is injected into; always rendered on sheet open. */
  template: string
  /** v13 uses a <select> for the user, v14 an <input>. */
  selectUser: (page: Page) => Promise<void>
}

const LOCAL_DIR = new URL('../../local/', import.meta.url).pathname

const VERSIONS: Record<string, FoundryVersion> = {
  v13: {
    id: 'v13',
    foundryDir: 'foundry-v13',
    port: 30013,
    template: 'public/templates/actor/character.hbs',
    async selectUser(page) {
      const select = page.locator('select[name="userid"]')
      // v13 populates the user list asynchronously over the socket.
      await select
        .locator('option', { hasText: 'Gamemaster' })
        .waitFor({ state: 'attached', timeout: 60_000 })
      await select.selectOption({ label: 'Gamemaster' })
    },
  },
  v14: {
    id: 'v14',
    foundryDir: 'foundry-v14',
    port: 30014,
    template: 'public/templates/v2/actor/header.hbs',
    async selectUser(page) {
      await page.locator('#join-username').fill('Gamemaster')
    },
  },
}

function isProvisioned(version: FoundryVersion): boolean {
  return (
    existsSync(`${LOCAL_DIR}${version.foundryDir}`) &&
    existsSync(`${LOCAL_DIR}data-${version.id}/Data/systems/shadowrun5e`) &&
    existsSync(`${LOCAL_DIR}${version.id}-system/${version.template}`)
  )
}

async function isListening(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/`)
    return response.status < 500
  } catch {
    return false
  }
}

/** The version under test: an explicit override, else whichever instance is up. */
const requested = VERSIONS[process.env.FVTT_E2E_VERSION ?? '']
const detected =
  (await Promise.all(
    Object.values(VERSIONS).map(
      async v => [v, (await isListening(v.port)) && isProvisioned(v)] as const,
    ),
  ).then(results => results.find(([, ok]) => ok)?.[0])) ?? null
const version = requested ?? detected
const isEnabled = Boolean(version) && (requested ? await isListening(requested.port) : true)

const foundryUrl = `http://localhost:${version?.port ?? 0}`
const devUrl = `http://localhost:${version ? version.port + 1 : 0}`
const systemDir = version ? `${LOCAL_DIR}${version.id}-system/` : ''
const templatePath = version ? `${systemDir}${version.template}` : ''
const HMR_MARKER = 'fvtt-hmr-probe'

let devServer: ChildProcess | undefined
let browser: Browser | undefined
let originalTemplate = ''
let page: Page
let consoleErrors: string[] = []

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.status < 500
  } catch {
    return false
  }
}

/** Recursive rather than a loop, to satisfy `no-await-in-loop`. */
async function waitUntilReachable(url: string, deadline: number, label: string): Promise<void> {
  if (await isUp(url)) return
  if (Date.now() > deadline) throw new Error(`${label} never became reachable at ${url}`)
  await delay(500)
  return waitUntilReachable(url, deadline, label)
}

function startDevServer(): Promise<ChildProcess> {
  const child = spawn('npx', ['vite'], { cwd: systemDir, detached: true })
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server did not report ready')), 120_000)
    const onData = (chunk: Buffer): void => {
      const text = String(chunk)
      process.stderr.write(text)
      if (/ready in|error/iu.test(text)) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
  })
  return ready.then(() => child)
}

/**
 * Pull the entry graph through the dev server so Vite discovers and optimizes the system's bare
 * imports *before* the browser does. Otherwise the first page load triggers a mid-test reload
 * ("Outdated Optimize Dep") which discards the rendered sheet.
 */
async function warmUpDevServer(): Promise<void> {
  const base = `${devUrl}/systems/shadowrun5e`
  await fetch(`${base}/bundle.js`)
  await fetch(`${base}/src/module/main.ts`)
}

async function loginToFoundry(): Promise<void> {
  await page.goto(`${foundryUrl}/join`, { waitUntil: 'domcontentloaded' })
  await version.selectUser(page)
  await page.locator('button[name="join"]').click()
  await page.waitForURL(/\/game/u, { timeout: 120_000 })
  await page.waitForFunction(() => Boolean(globalThis.game?.ready), undefined, { timeout: 120_000 })
}

/**
 * Reload the already-authenticated session through the dev server and open a sheet. Templates can
 * only resolve if the dev server's socket proxy authenticated upstream and intercepted the
 * `template` events with files from `public/templates`.
 */
async function openSheetThroughDevServer(): Promise<void> {
  await page.goto(`${devUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.game?.ready), undefined, { timeout: 120_000 })

  const actorName = await page.evaluate(async () => {
    const actor = game.actors?.contents[0]
    if (!actor) throw new Error('World has no actors to test with')
    await actor.sheet.render(true)
    return actor.name
  })

  // Ask the application itself rather than the DOM: v13 is AppV1 (.window-app) and v14 AppV2
  // (.application), so the class names differ.
  await page.waitForFunction(
    () => Boolean(globalThis.game?.actors?.contents[0]?.sheet?.rendered),
    undefined,
    { timeout: 60_000 },
  )
  expect(await page.locator('.window-title').first().textContent()).toContain(actorName)
}

async function setup(): Promise<void> {
  originalTemplate = await fs.readFile(templatePath, 'utf8')
  await waitUntilReachable(foundryUrl, Date.now() + 30_000, 'Foundry')

  devServer = await startDevServer()
  await waitUntilReachable(devUrl, Date.now() + 120_000, 'Vite dev server')
  await warmUpDevServer()

  browser = await chromium.launch()
  // Foundry refuses to run below 1366x768.
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('console', (message: ConsoleMessage) => {
    // Resource 404s are the system's own relative asset URLs, which resolve against the document
    // once Vite injects CSS as JS. Assert on real script errors instead.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
      consoleErrors.push(message.text())
  })
  await loginToFoundry()
}

async function teardown(): Promise<void> {
  if (originalTemplate) await fs.writeFile(templatePath, originalTemplate)
  await browser?.close()
  if (devServer?.pid) process.kill(-devServer.pid, 'SIGTERM')
}

describe.skipIf(!isEnabled)(`Foundry ${version?.id ?? 'none'} dev server (e2e)`, () => {
  beforeAll(setup, 240_000)
  afterAll(teardown)

  it('serves the system through the dev server and renders a sheet from local templates', async () => {
    await openSheetThroughDevServer()

    // The system entry must come from the dev server, not from Foundry's installed copy.
    expect(await page.evaluate(() => document.querySelector('script[src$="bundle.js"]')?.src)).toBe(
      `${devUrl}/systems/shadowrun5e/bundle.js`,
    )
    expect(consoleErrors).toEqual([])
  }, 180_000)

  it('hot-reloads handlebars templates without reloading the page', async () => {
    await page.evaluate(() => {
      document.title = 'hmr-probe'
    })

    // A Foundry template part must render exactly one root element, so the marker has to go
    // *inside* the existing root element rather than in front of it.
    const rootTag = originalTemplate.match(/<([a-zA-Z][\w-]*)[^>]*>/u)?.[1]
    expect(rootTag).toBeTruthy()
    const withMarker = originalTemplate.replace(
      new RegExp(`<${rootTag}([^>]*)>`, 'u'),
      `<${rootTag}$1><span id="${HMR_MARKER}">before</span>`,
    )
    expect(withMarker).not.toBe(originalTemplate)
    await fs.writeFile(templatePath, withMarker)
    await page.locator(`#${HMR_MARKER}`).waitFor({ state: 'visible', timeout: 30_000 })

    // Change it again to prove the first render wasn't just a fluke of the sheet opening.
    await fs.writeFile(
      templatePath,
      withMarker.replace(`id="${HMR_MARKER}">before<`, `id="${HMR_MARKER}">after<`),
    )
    await page
      .locator(`#${HMR_MARKER}`)
      .filter({ hasText: 'after' })
      .waitFor({ state: 'visible', timeout: 30_000 })

    // The surviving title proves no full page reload happened.
    expect(await page.title()).toBe('hmr-probe')
    expect(consoleErrors).toEqual([])
  }, 120_000)
})
