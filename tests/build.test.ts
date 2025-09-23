import fs from 'fs/promises'
import path from 'path'
import { build } from 'vite'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import FsUtils from '../src/utils/fs-utils'

const TEST_DIR = path.resolve(__dirname, `.tmp-${Date.now().toString()}`)

// Mock `process.cwd()` to point to our test directory
// const originalCwd = process.cwd()
vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR)

beforeEach(async () => {
  const files = { ...JS, ...CSS, ...LANGUAGE }
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(TEST_DIR, file)
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true })
  vi.restoreAllMocks()
})

describe('Vite Plugin Build Process (Fixture-Based)', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, 'public/system.json'),
      JSON.stringify(MANIFEST, null, 2),
      'utf8',
    )
    await build(VITE_CONFIG)

    // --- Core JS + CSS checks ---
    expect(await FsUtils.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.esmodules[0]))).toBe(true)
    expect(await FsUtils.fileExists(path.join(TEST_DIR, 'dist', MANIFEST.styles[0]))).toBe(true)

    // --- Language files ---
    const referenceLangPath = path.join(TEST_DIR, 'dist', 'i18n/en.json')
    const referenceLang = await FsUtils.readJson<any>(referenceLangPath)

    for (const language of MANIFEST.languages) {
      const langPath = path.join(TEST_DIR, 'dist', language.path)
      expect(await FsUtils.fileExists(langPath)).toBe(true)

      const langJson = await FsUtils.readJson<any>(langPath)

      // Ensure all keys from reference are present
      for (const key of Object.keys(referenceLang)) {
        expect(langJson).toHaveProperty(key)
      }
    }
  })
})
