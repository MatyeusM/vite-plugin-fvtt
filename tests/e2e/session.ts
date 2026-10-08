/**
 * Browser driver for one Foundry version: boots the instance (with `--hotReload`), starts the dev
 * server, logs in, and opens sheets. File mutations go through `language.ts` and the watch build
 * through `WatchPhase`; anything version-specific comes from `VersionSpec`.
 */
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'

import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright'

import { languageValue, languageWith } from './language'
import {
  isUp,
  isWorldReady,
  kill,
  restoreWorldData,
  startDevServer,
  startFoundry,
  stopFoundry,
  waitUntil,
} from './proc'
import { LANGUAGE_FILE, LOCAL_DIR } from './support'
import { WatchPhase, type VersionSpec } from './watch'

/** Foundry refuses to run below 1366x768. */
const VIEWPORT = { width: 1600, height: 1000 }

export class FoundrySession {
  readonly devUrl: string
  readonly foundryUrl: string
  readonly systemDir: string
  readonly consoleErrors: string[] = []
  readonly watch: WatchPhase

  readonly #templatePath: string
  readonly #languagePath: string

  #foundry: ChildProcess | undefined
  #devServer: ChildProcess | undefined
  #browser: Browser
  #page: Page
  #originalTemplate = ''
  #originalLanguage = ''
  /** The committed value of the one key the sheet renders, so rollback can assert against it. */
  #originalLanguageValue = ''
  /** True when the developer started the instance, in which case teardown must not kill it. */
  #borrowed = false

  constructor(private readonly spec: VersionSpec) {
    const systemDir = `${LOCAL_DIR}${spec.id}-system/`
    this.foundryUrl = `http://localhost:${spec.port}`
    this.devUrl = `http://localhost:${spec.port + 1}`
    this.#templatePath = `${systemDir}${spec.template}`
    this.#languagePath = `${systemDir}${LANGUAGE_FILE}`
    this.watch = new WatchPhase(systemDir, spec.languageKey, LANGUAGE_FILE)
    this.systemDir = systemDir
  }

  async start(): Promise<void> {
    const [template, language] = await Promise.all([
      fs.readFile(this.#templatePath, 'utf8'),
      fs.readFile(this.#languagePath, 'utf8'),
    ])
    this.#originalTemplate = template
    this.#originalLanguage = language
    this.#originalLanguageValue = languageValue(language, this.spec.languageKey)

    // Reuse a developer-started instance instead of fighting it for the port. Only restore the
    // seed for an instance this suite boots itself: touching a running one's files would corrupt it.
    this.#borrowed = await isWorldReady(this.foundryUrl)
    if (!this.#borrowed) {
      await restoreWorldData(this.spec.id)
      this.#foundry = startFoundry(this.spec.id)
    }
    await waitUntil(
      async () => await isWorldReady(this.foundryUrl),
      'Foundry to finish launching the world',
      120_000,
    )

    this.#devServer = await startDevServer(this.systemDir)
    await waitUntil(async () => await isUp(this.devUrl), 'Vite dev server', 120_000)
    await this.#warmUpDevServer()

    this.#browser = await chromium.launch()
    this.#page = await this.#browser.newPage({ viewport: VIEWPORT })
    this.#page.on('console', message => this.#record(message))
    await this.login()
  }

  async stop(): Promise<void> {
    await this.watch.stop()
    await Promise.all([
      fs.writeFile(this.#templatePath, this.#originalTemplate),
      fs.writeFile(this.#languagePath, this.#originalLanguage),
    ])
    await this.#browser?.close()
    kill(this.#devServer)
    if (!this.#borrowed) await stopFoundry(this.#foundry, this.spec.id)
  }

  /**
   * Join, retrying until it sticks. Foundry starts listening before its startup IP discovery has
   * settled, and a join landing in that window authenticates and then throws inside
   * `getInvitationLinks`, leaving `game.ready` false forever. The beforeAll timeout bounds this.
   */
  async login(): Promise<void> {
    await this.#attemptJoin()
    if (await this.#joined()) return
    return this.login()
  }

  async #attemptJoin(): Promise<void> {
    await this.#page.goto(`${this.foundryUrl}/join`, { waitUntil: 'domcontentloaded' })
    await this.spec.selectUser(this.#page)
    await this.#page.locator('button[name="join"]').click()
    await this.#page.waitForURL(/\/game/u, { timeout: 120_000 })
  }

  async #joined(): Promise<boolean> {
    try {
      await this.#page.waitForFunction(() => Boolean(globalThis.game?.ready), undefined, {
        timeout: 20_000,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Reload the already-authenticated session and open a sheet. Through the dev server (`base` =
   * devUrl) templates resolve via the socket proxy; through Foundry itself (`base` = foundryUrl)
   * the system is served from watch-built `dist/`, which requires Foundry's `--hotReload`.
   */
  async openSheet(base: string = this.devUrl): Promise<string> {
    await this.#page.goto(`${base}/game`, { waitUntil: 'domcontentloaded' })
    await this.#waitForGame()

    const actorName = await this.#page.evaluate(async () => {
      const actor = game.actors?.contents[0]
      if (!actor) throw new Error('World has no actors to test with')
      await actor.sheet.render(true)
      return actor.name
    })

    // Ask the application itself rather than the DOM: v13 is AppV1 (.window-app) and v14 AppV2
    // (.application), so the class names differ.
    await this.#page.waitForFunction(
      () => Boolean(globalThis.game?.actors?.contents[0]?.sheet?.rendered),
      undefined,
      { timeout: 60_000 },
    )
    return actorName
  }

  /** The title Foundry renders from the sheet's document, so it proves the sheet itself rendered. */
  async sheetTitle(): Promise<string> {
    return (await this.#page.locator('.window-title').first().textContent()) ?? ''
  }

  /** The src of the system entry script, which must point at the dev server, not at Foundry. */
  async entryScriptSrc(): Promise<string> {
    const src = await this.#page.evaluate(() =>
      document.querySelector('script[src$="bundle.js"]')?.src?.toString(),
    )
    return src ?? ''
  }

  /** Surviving titles prove no full page reload happened. */
  async title(): Promise<string> {
    return await this.#page.title()
  }

  /**
   * A Foundry template part must render exactly one root element, so an HMR marker has to go
   * *inside* the existing root element rather than in front of it.
   */
  #withRootChild(child: string): string {
    const template = this.#originalTemplate
    const rootTag = template.match(/<([a-zA-Z][\w-]*)[^>]*>/u)?.[1]
    if (!rootTag) throw new Error('Template has no root element to inject into')
    const result = template.replace(
      new RegExp(`<${rootTag}([^>]*)>`, 'u'),
      `<${rootTag}$1>${child}`,
    )
    if (result === template) throw new Error(`Cannot inject into the <${rootTag}> root element`)
    return result
  }

  /** Write two successive template revisions, each of which must reach the open sheet. */
  async swapTemplate(): Promise<void> {
    await this.#mark('hmr-probe')
    const marker = 'fvtt-hmr-probe'
    const withMarker = this.#withRootChild(`<span id="${marker}">before</span>`)
    await fs.writeFile(this.#templatePath, withMarker)
    await this.#page.locator(`#${marker}`).waitFor({ state: 'visible', timeout: 30_000 })

    // Change it again to prove the first render wasn't just a fluke of the sheet opening.
    await fs.writeFile(
      this.#templatePath,
      withMarker.replace(`id="${marker}">before<`, `id="${marker}">after<`),
    )
    await this.#page
      .locator(`#${marker}`)
      .filter({ hasText: 'after' })
      .waitFor({ state: 'visible', timeout: 30_000 })
  }

  /**
   * Overwrite the one i18n key the open sheet renders, wait for the tab label to change, then roll
   * the file back and wait for the original text to return. Both directions prove the change
   * travelled over the socket rather than being picked up by a fresh page load.
   */
  async swapLanguage(): Promise<void> {
    await this.#mark('i18n-probe')
    await this.#writeLanguage('hmr')
    await this.#waitForLanguage('hmr')

    await fs.writeFile(this.#languagePath, this.#originalLanguage)
    await this.#waitForLanguage(this.#originalLanguageValue)
  }

  /**
   * Round-trip one i18n value through source -> watch rebuild -> `dist/`. No sheet assertion:
   * Foundry applies native language events only when the event path equals the manifest path, but
   * the server always prefixes the package dir, so package language events never match.
   */
  async rebuildLanguageViaWatch(): Promise<void> {
    await this.#writeLanguage('hmr-watch')
    await this.watch.waitForValue('hmr-watch')

    await fs.writeFile(this.#languagePath, this.#originalLanguage)
    await this.watch.waitForValue(this.#originalLanguageValue)
  }

  /**
   * Pull the entry graph and the locale through the dev server before the browser does, so Vite has
   * discovered and optimized the system's bare imports and the language file is registered with the
   * language tracker. Otherwise the first page load triggers a mid-test reload ("Outdated Optimize
   * Dep") that discards the rendered sheet.
   */
  async #warmUpDevServer(): Promise<void> {
    const base = `${this.devUrl}/systems/shadowrun5e`
    await Promise.all([fetch(`${base}/bundle.js`), fetch(`${base}/src/module/main.ts`)])
  }

  async #waitForGame(): Promise<void> {
    await this.#page.waitForFunction(() => Boolean(globalThis.game?.ready), undefined, {
      timeout: 120_000,
    })
  }

  /** A page reload would reset the title, so its survival proves the update came over the socket. */
  async #mark(title: string): Promise<void> {
    await this.#page.evaluate(value => {
      document.title = value
    }, title)
  }

  #record(message: ConsoleMessage): void {
    // Resource 404s are the system's own relative asset URLs, which resolve against the document
    // once Vite injects CSS as JS. Assert on real script errors instead.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
      this.consoleErrors.push(message.text())
  }

  async #writeLanguage(value: string): Promise<void> {
    await fs.writeFile(
      this.#languagePath,
      languageWith(this.#originalLanguage, this.spec.languageKey, value),
    )
  }

  async #waitForLanguage(value: string): Promise<void> {
    await waitUntil(
      async () =>
        (await this.#page.locator(this.spec.languageSelector).innerText()).trim() === value,
      `the sheet to render "${value}"`,
      30_000,
    )
  }
}
