/**
 * Shared harness for the per-version Foundry e2e suites.
 *
 * One suite per Foundry version lives in `foundry-v<version>.test.ts`; this module owns the
 * eligibility precheck and registers the suite. The per-version differences (login widget, sheet
 * template, i18n key) belong in those files, not here, because they are the things that drift apart
 * between Foundry releases.
 *
 * A single Foundry licence key means only one instance may run at a time, so `vitest.config.ts`
 * runs this directory with `fileParallelism: false`. Each suite starts its own instance through
 * `mise` and stops it again in teardown.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FoundrySession } from './session'
import type { VersionSpec } from './session'

const execFileAsync = promisify(execFile)

export const LOCAL_DIR = fileURLToPath(new URL('../../local/', import.meta.url))
/** Both systems ship one merged English file under public/, so a single path covers them. */
export const LANGUAGE_FILE = 'public/locale/en/config.json'

async function hasMise(): Promise<boolean> {
  try {
    await execFileAsync('mise', ['--version'])
    return true
  } catch {
    return false
  }
}

/**
 * The suites need a provisioned `local/`: the commercial Foundry build, a built system for the data
 * dir's symlink to point at, a licence key to boot with, and `mise` to launch it. When any of that
 * is missing the suite skips, which is what keeps CI green on a machine that never set Foundry up.
 */
async function eligibility(spec: VersionSpec): Promise<{ enabled: boolean; reason: string }> {
  const forced = process.env.FVTT_E2E_VERSION
  if (forced && forced !== spec.id) return { enabled: false, reason: `forced to ${forced}` }

  const systemDir = `${LOCAL_DIR}${spec.id}-system`
  const required = [
    `${LOCAL_DIR}${spec.foundryDir}`,
    `${systemDir}/dist`,
    `${LOCAL_DIR}data-${spec.id}/Config/license.json`,
    `${systemDir}/${spec.template}`,
    `${systemDir}/${LANGUAGE_FILE}`,
  ]
  const missing = required.filter(path => !existsSync(path))
  if (missing.length > 0) {
    const names = missing.map(path => path.replace(`${LOCAL_DIR}`, 'local/')).join(', ')
    return { enabled: false, reason: `not provisioned, missing ${names}` }
  }

  return (await hasMise())
    ? { enabled: true, reason: '' }
    : { enabled: false, reason: 'mise is not installed' }
}

export async function foundrySuite(spec: VersionSpec): Promise<void> {
  const { enabled, reason } = await eligibility(spec)
  const session = new FoundrySession(spec)
  const title = `Foundry ${spec.id} dev server (e2e)`

  describe.skipIf(!enabled)(`${title}${enabled ? '' : ` - skipped: ${reason}`}`, () => {
    beforeAll(() => session.start(), 300_000)
    afterAll(() => session.stop())

    it('serves the system through the dev server and renders a sheet from local templates', async () => {
      const actorName = await session.openSheet()
      // The window title comes from the sheet itself, so it proves the local template rendered.
      expect(await session.sheetTitle()).toContain(actorName)
      // The entry must come from the dev server, not from Foundry's installed copy.
      expect(await session.entryScriptSrc()).toBe(`${session.devUrl}/systems/shadowrun5e/bundle.js`)
      expect(session.consoleErrors).toEqual([])
    }, 180_000)

    it('hot-reloads handlebars templates without reloading the page', async () => {
      await session.swapTemplate()
      expect(await session.title()).toBe('hmr-probe')
      expect(session.consoleErrors).toEqual([])
    }, 120_000)

    it('hot-reloads language files without reloading the page', async () => {
      await session.swapLanguage()
      expect(await session.title()).toBe('i18n-probe')
      expect(session.consoleErrors).toEqual([])
    }, 120_000)
  })
}
