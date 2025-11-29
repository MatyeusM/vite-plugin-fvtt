import fs from 'node:fs/promises'
import { build } from 'vite'
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import { createTestFiles, generateTemporaryDirectory, writeManifest } from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

const BuildTestCases = [
  { description: 'System Manifest Build', isSystem: true },
  { description: 'Module Manifest Build', isSystem: false },
]

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
  const files = { ...JS, ...CSS, ...LANGUAGE }
  await createTestFiles(TEMPORARY_TEST_DIRECTORY, files)
})

afterEach(async () => {
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true })
  vi.restoreAllMocks()
})

describe('Vite Plugin Build Process', () => {
  it.each(BuildTestCases)(
    'should generate all required files for $description',
    async ({ isSystem }) => {
      await writeManifest(MANIFEST, TEMPORARY_TEST_DIRECTORY, isSystem)

      const result = await build(VITE_CONFIG)
      expect(result).toBeDefined()
      expect(TEMPORARY_TEST_DIRECTORY).toHaveCoreFiles(MANIFEST, isSystem)
      expect(TEMPORARY_TEST_DIRECTORY).toHaveWellFormedLanguages(MANIFEST)
    },
  )
})
