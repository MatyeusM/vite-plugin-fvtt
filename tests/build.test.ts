import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import * as FsUtilities from '../src/utils/fs-utilities'

const TEST_DIR = path.resolve(__dirname, `.tmp-${Date.now().toString()}`)

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR)

  const files = { ...JS, ...CSS, ...LANGUAGE }
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(TEST_DIR, file)
    const directory = path.dirname(fullPath)
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true })
  vi.restoreAllMocks()
})

describe('Vite Plugin Build Process', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, 'public/system.json'),
      JSON.stringify(MANIFEST, undefined, 2),
      'utf8',
    )
    await build(VITE_CONFIG)

    // --- Core JS + CSS checks + Manifest Check ---
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist/system.json'))).toBe(true)
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.esmodules[0]))).toBe(
      true,
    )
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.styles[0]))).toBe(true)

    // --- Language files ---
    const referenceLangPath = path.join(TEST_DIR, 'dist', 'i18n/en.json')
    const referenceLang = await FsUtilities.readJson<Record<string, unknown>>(referenceLangPath)
    expect(!!referenceLang).toBe(true)
    if (!referenceLang) return

    for (const language of MANIFEST.languages) {
      const langPath = path.join(TEST_DIR, 'dist', language.path)
      expect(await FsUtilities.fileExists(langPath)).toBe(true)

      const langJson = await FsUtilities.readJson<Record<string, unknown>>(langPath)

      // Ensure all keys from reference are present
      for (const key of Object.keys(referenceLang)) {
        expect(langJson).toHaveProperty(key)
      }
    }
  })
})

describe('Vite Plugin Build Process (Alternate Module Path)', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, 'module.json'),
      JSON.stringify(MANIFEST, undefined, 2),
      'utf8',
    )
    await build(VITE_CONFIG)

    // --- Core JS + CSS checks + Manifest Check ---
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist/module.json'))).toBe(true)
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.esmodules[0]))).toBe(
      true,
    )
    expect(await FsUtilities.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.styles[0]))).toBe(true)

    // --- Language files ---
    const referenceLangPath = path.join(TEST_DIR, 'dist', 'i18n/en.json')
    const referenceLang = await FsUtilities.readJson<Record<string, unknown>>(referenceLangPath)
    expect(!!referenceLang).toBe(true)
    if (!referenceLang) return

    for (const language of MANIFEST.languages) {
      const langPath = path.join(TEST_DIR, 'dist', language.path)
      expect(await FsUtilities.fileExists(langPath)).toBe(true)

      const langJson = await FsUtilities.readJson<Record<string, unknown>>(langPath)

      // Ensure all keys from reference are present
      for (const key of Object.keys(referenceLang)) {
        expect(langJson).toHaveProperty(key)
      }
    }
  })
})
