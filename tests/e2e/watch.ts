/**
 * Watch-phase driver: `vite build --watch` plus the `dist/` assertions. The browser driver owns
 * the page; this owns the build process, the sentinel that proves rebuilds do not empty `dist/`,
 * and the read of the rebuilt language file.
 */
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'

import type { Page } from 'playwright'

import { languageValue } from './language'
import { kill, startWatch, waitUntil } from './proc'

export interface VersionSpec {
  id: 'v13' | 'v14'
  /** Foundry install dir under local/. */
  foundryDir: string
  port: number
  /** Sheet template mutated by the hbs HMR test; always rendered on sheet open. */
  template: string
  /** i18n key whose value the actor sheet renders, mutated by the i18n HMR test. */
  languageKey: string
  /** Scoped to the open actor sheet so tab labels elsewhere on the page cannot match. */
  languageSelector: string
  /** v13 offers a <select> of users, v14 an <input>. */
  selectUser: (page: Page) => Promise<void>
}

export class WatchPhase {
  /** A file Vite never emits, so its survival proves watch rebuilds do not empty `dist/`. */
  readonly #sentinelPath: string
  readonly #distLanguagePath: string
  #child: ChildProcess | undefined

  constructor(
    private readonly systemDir: string,
    private readonly languageKey: string,
    languageFile: string,
  ) {
    this.#sentinelPath = `${systemDir}dist/watch-keep.txt`
    this.#distLanguagePath = `${systemDir}${languageFile.replace('public/', 'dist/')}`
  }

  /**
   * Plant the sentinel before the first watch build, so its survival proves even the initial
   * build did not empty `dist/`. The plugin defaults `emptyOutDir` to false in watch mode.
   */
  async start(): Promise<void> {
    await fs.writeFile(this.#sentinelPath, 'watch-keep')
    this.#child = await startWatch(this.systemDir)
  }

  async stop(): Promise<void> {
    kill(this.#child)
    this.#child = undefined
    await fs.rm(this.#sentinelPath, { force: true })
  }

  async sentinelExists(): Promise<boolean> {
    try {
      await fs.stat(this.#sentinelPath)
      return true
    } catch {
      return false
    }
  }

  async waitForValue(value: string): Promise<void> {
    await waitUntil(
      async () => (await this.readValue()) === value,
      `dist language to become "${value}"`,
      120_000,
    )
  }

  async readValue(): Promise<string> {
    try {
      return languageValue(await fs.readFile(this.#distLanguagePath, 'utf8'), this.languageKey)
    } catch {
      return ''
    }
  }
}
