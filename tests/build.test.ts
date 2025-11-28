import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import { FoundryVTTManifest } from '../src/context'
import {
  createTestFiles,
  expectCoreFilesExist,
  expectLanguagesToBeWellFormed,
  writeManifest,
} from './test-utilities'

const TEST_DIR = path.resolve(__dirname, `.tmp-${Date.now().toString()}`)

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR)
  const files = { ...JS, ...CSS, ...LANGUAGE }
  await createTestFiles(TEST_DIR, files)
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true })
  vi.restoreAllMocks()
})

describe('Vite Plugin Build Process', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await writeManifest(MANIFEST, TEST_DIR)
    const result = await build(VITE_CONFIG)
    expect(result).toBeDefined()

    await expectCoreFilesExist(TEST_DIR, MANIFEST as FoundryVTTManifest)
    await expectLanguagesToBeWellFormed(TEST_DIR, MANIFEST as FoundryVTTManifest)
  })
})

describe('Vite Plugin Build Process (Alternate Module Path)', () => {
  it('should generate all required files with the correct content and structure', async () => {
    await writeManifest(MANIFEST, TEST_DIR, false)
    const result = await build(VITE_CONFIG)
    expect(result).toBeDefined()

    await expectCoreFilesExist(TEST_DIR, MANIFEST as FoundryVTTManifest, false)
    await expectLanguagesToBeWellFormed(TEST_DIR, MANIFEST as FoundryVTTManifest)
  })
})
