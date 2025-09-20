import fs from 'fs-extra'
import path from 'path'
import { build } from 'vite'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'

const TEST_DIR = path.resolve(__dirname, `.tmp-${Date.now().toString()}`)

// Mock `process.cwd()` to point to our test directory
// const originalCwd = process.cwd()
vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR)

beforeEach(async () => {
  await fs.ensureDir(TEST_DIR)
  const files = { ...JS, ...CSS, ...LANGUAGE }
  for (const [file, content] of Object.entries(files)) {
    await fs.outputFile(path.join(TEST_DIR, file), content)
  }
})

afterEach(async () => {
  await fs.remove(TEST_DIR)
  vi.restoreAllMocks()
})

describe('Vite Plugin Build Process (Fixture-Based)', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await fs.outputFile(
      path.join(TEST_DIR, 'public/system.json'),
      JSON.stringify(MANIFEST, null, 2),
    )
    await build(VITE_CONFIG)

    // Core JS + CSS checks
    expect(await fs.pathExists(path.join(TEST_DIR, 'dist', MANIFEST.esmodules[0]))).toBe(true)
    expect(await fs.pathExists(path.join(TEST_DIR, 'dist', MANIFEST.styles[0]))).toBe(true)

    // --- Language files ---
    const referenceLangPath = path.join(TEST_DIR, 'dist', 'i18n/en.json')
    const referenceLang = await fs.readJson(referenceLangPath)

    for (const language of MANIFEST.languages) {
      const langPath = path.join(TEST_DIR, 'dist', language.path)
      expect(await fs.pathExists(langPath)).toBe(true)

      const langJson = await fs.readJson(langPath)

      // Ensure all keys from reference are present
      for (const key of Object.keys(referenceLang)) {
        expect(langJson).toHaveProperty(key)
      }
    }
  })
})
