import fs from 'node:fs/promises'
import path from 'node:path'

import { build, defineConfig } from 'vite'
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest'

import { syncHotReloadFlags } from '../src/bundle'
import foundryVTT from '../src/index'
import * as FsUtilities from '../src/utils/fs-utilities'
import { CSS, JS } from './fixture-data'
import { createTestFiles, generateTemporaryDirectory } from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

const FLAGGED_MANIFEST = {
  id: 'test-id',
  esmodules: ['scripts/index.js'],
  styles: ['styles/test.css'],
  languages: [{ lang: 'en', name: 'English', path: 'locale/en/config.json' }],
  flags: { hotReload: { extensions: ['hbs'], paths: ['templates'] }, other: true },
}

const DETECT_MANIFEST = {
  id: 'test-id',
  esmodules: ['scripts/index.js'],
  languages: [{ lang: 'en', name: 'English', path: 'locale/en/config.json' }],
}

const LOCALE_FILE = { 'public/locale/en/config.json': JSON.stringify({ hello: 'Hello' }) }

async function distManifest(): Promise<Record<string, unknown>> {
  const manifest = await FsUtilities.readJson<Record<string, unknown>>(
    path.join(TEMPORARY_TEST_DIRECTORY, 'dist', 'system.json'),
  )
  if (!manifest) throw new Error('dist manifest is missing')
  return manifest
}

async function buildWatchOnce(): Promise<Record<string, unknown>> {
  // Programmatic builds ignore argv, so only our own watch check sees this; the build itself
  // stays a one-shot run instead of hanging in a watcher.
  process.argv.push('--watch')
  try {
    await build(
      defineConfig({ plugins: [foundryVTT()], build: { lib: { entry: './src/main.js' } } }),
    )
  } finally {
    process.argv.pop()
  }
  return await distManifest()
}

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
})

afterEach(async () => {
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('syncHotReloadFlags', () => {
  it('adds detected directories on watch when missing', () => {
    const manifest: Record<string, unknown> = { id: 'test-id' }
    syncHotReloadFlags(manifest, true, ['templates', 'locale/en', 'templates/actor'])
    expect(manifest.flags).toEqual({
      hotReload: { extensions: ['css', 'hbs', 'html', 'json'], paths: ['locale/en', 'templates'] },
    })
  })

  it('watches the package root when content sits there', () => {
    const manifest: Record<string, unknown> = { id: 'test-id' }
    syncHotReloadFlags(manifest, true, ['templates', ''])
    expect(manifest.flags).toEqual({
      hotReload: { extensions: ['css', 'hbs', 'html', 'json'], paths: [''] },
    })
  })

  it('preserves explicit flags on watch', () => {
    const manifest = JSON.parse(JSON.stringify(FLAGGED_MANIFEST)) as Record<string, unknown>
    syncHotReloadFlags(manifest, true, ['templates'])
    expect(manifest.flags).toEqual(FLAGGED_MANIFEST.flags)
  })
})

describe('manifest flags in builds', () => {
  it('strips hotReload on build but keeps other flags', async () => {
    await createTestFiles(TEMPORARY_TEST_DIRECTORY, {
      ...JS,
      ...CSS,
      ...LOCALE_FILE,
      'system.json': JSON.stringify(FLAGGED_MANIFEST),
    })
    await build(
      defineConfig({ plugins: [foundryVTT()], build: { lib: { entry: './src/main.js' } } }),
    )

    const manifest = await distManifest()
    expect(manifest.flags).toEqual({ other: true })
  })

  it('detects template and language directories on watch builds', async () => {
    await createTestFiles(TEMPORARY_TEST_DIRECTORY, {
      ...JS,
      ...CSS,
      ...LOCALE_FILE,
      'system.json': JSON.stringify(DETECT_MANIFEST),
      'public/templates/sheet.hbs': '<div></div>\n',
      'public/templates/actor/deep.hbs': '<span></span>\n',
    })
    const manifest = await buildWatchOnce()
    expect(manifest.flags).toEqual({
      hotReload: { extensions: ['css', 'hbs', 'html', 'json'], paths: ['locale/en', 'templates'] },
    })
  })
})
