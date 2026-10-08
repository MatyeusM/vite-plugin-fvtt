import fs from 'node:fs/promises'
import path from 'node:path'

import { build, defineConfig, type Plugin } from 'vite'
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest'

import foundryVTT from '../src/index'
import * as FsUtilities from '../src/utils/fs-utilities'
import { CSS, JS } from './fixture-data'
import { createTestFiles, generateTemporaryDirectory, outputFileExists } from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

const SINGLE_MANIFEST = {
  id: 'test-id',
  esmodules: ['scripts/index.js'],
  styles: ['styles/test.css'],
}

const MULTI_SOURCES = {
  'src/main.js': `import './main.css';\nimport('./feature.js');\nconsole.log('main');\n`,
  'src/main.css': 'body { color: red; }\n',
  'src/feature.js': `import './feature.css';\nconsole.log('feature');\n`,
  'src/feature.css': '.feature { color: blue; }\n',
}

async function buildWith(
  files: Record<string, string>,
  plugins: Plugin[],
  buildOptions: Record<string, unknown> = {},
): Promise<void> {
  await createTestFiles(TEMPORARY_TEST_DIRECTORY, files)
  await build(
    defineConfig({ plugins, build: { lib: { entry: './src/main.js' }, ...buildOptions } }),
  )
}

async function distFiles(extension: string): Promise<string[]> {
  const entries = await fs.readdir(path.join(TEMPORARY_TEST_DIRECTORY, 'dist'), { recursive: true })
  return (entries as string[]).filter(file => file.endsWith(extension)).toSorted()
}

async function distManifest(): Promise<{ esmodules: string[]; styles: string[] }> {
  const manifest = await FsUtilities.readJson<{ esmodules: string[]; styles: string[] }>(
    path.join(TEMPORARY_TEST_DIRECTORY, 'dist', 'system.json'),
  )
  if (!manifest) throw new Error('dist manifest is missing')
  return manifest
}

async function readDist(relativeFilePath: string): Promise<string> {
  return await fs.readFile(path.join(TEMPORARY_TEST_DIRECTORY, 'dist', relativeFilePath), 'utf8')
}

async function expectOnlyEntryListed(
  manifest: { esmodules: string[] },
  emittedJs: string[],
): Promise<void> {
  // The dynamically imported child loads itself; only the entry is listed.
  expect(manifest.esmodules).toHaveLength(1)
  const entryJs = manifest.esmodules[0]
  expect(await readDist(entryJs)).toContain('main')
  expect(emittedJs).toHaveLength(2)
  const childJs = emittedJs.find(file => file !== entryJs) as string
  expect(await readDist(childJs)).toContain('feature')
}

async function expectOnlyEntryCssListed(
  manifest: { styles: string[] },
  emittedCss: string[],
): Promise<void> {
  // Only the entry's css is listed; the auto-loaded child css is not.
  expect(emittedCss).toHaveLength(2)
  expect(manifest.styles).toHaveLength(1)
  expect(emittedCss).toContain(manifest.styles[0])
  expect(await readDist(manifest.styles[0])).toContain('body{')
  const childCss = emittedCss.find(file => file !== manifest.styles[0]) as string
  expect(await readDist(childCss)).toContain('.feature{')
}

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
})

afterEach(async () => {
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('overwrite option', () => {
  it('keeps manifest names when a single css and js are emitted', async () => {
    await buildWith(
      { ...JS, ...CSS, 'system.json': JSON.stringify(SINGLE_MANIFEST) },
      [foundryVTT({ overwrite: ['css', 'js'] })],
      { sourcemap: true },
    )

    await expect(distManifest()).resolves.toEqual(SINGLE_MANIFEST)
    expect(await outputFileExists(TEMPORARY_TEST_DIRECTORY, 'scripts/index.js')).toBe(true)
    expect(await outputFileExists(TEMPORARY_TEST_DIRECTORY, 'styles/test.css')).toBe(true)
  })

  it('lets vite name outputs and rewrites the manifest when multiple are emitted', async () => {
    await buildWith(
      { ...MULTI_SOURCES, 'system.json': JSON.stringify(SINGLE_MANIFEST) },
      [foundryVTT({ overwrite: ['css', 'js'] })],
      { cssCodeSplit: true },
    )

    const manifest = await distManifest()
    expect(manifest.styles[0]).not.toBe('styles/test.css')
    await expectOnlyEntryListed(manifest, await distFiles('.js'))
    await expectOnlyEntryCssListed(manifest, await distFiles('.css'))
  })

  it('fails fast when the manifest lives in public/', async () => {
    await expect(
      buildWith(
        {
          ...JS,
          ...CSS,
          'public/system.json': JSON.stringify({ id: 'test-id', esmodules: ['scripts/index.js'] }),
        },
        [foundryVTT({ overwrite: 'css' })],
      ),
    ).rejects.toThrow(/overwrite/u)
  })

  it('fails fast on unknown overwrite values', async () => {
    await expect(foundryVTT({ overwrite: ['scss' as never] })).rejects.toThrow(/overwrite/u)
  })
})
