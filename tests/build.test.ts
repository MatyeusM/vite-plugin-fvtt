import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import * as FsUtilities from '../src/utils/fs-utilities'
import { FoundryVTTManifest } from '../src/context'
import { flattenKeys } from '../src/language/transformer'

const TEST_DIR = path.resolve(__dirname, `.tmp-${Date.now().toString()}`)

async function outputFileExists(relativeFilePath: string): Promise<boolean> {
  return await FsUtilities.fileExists(path.join(TEST_DIR, 'dist', relativeFilePath))
}

async function expectCoreFilesExist(manifest: FoundryVTTManifest, isSystem = true): Promise<void> {
  expect(await outputFileExists(isSystem ? 'system.json' : 'module.json')).toBe(true)
  expect(await outputFileExists(manifest.esmodules[0])).toBe(true)
  expect(await outputFileExists(manifest.styles[0])).toBe(true)
}

async function loadLanguage(languagePath: string): Promise<Record<string, unknown> | undefined> {
  const language = await FsUtilities.readJson<Record<string, unknown>>(languagePath)
  expect(!!language).toBe(true)
  if (!language) return
  return flattenKeys(language)
}

async function expectLanguagesToBeWellFormed(manifest: FoundryVTTManifest): Promise<void> {
  expect(await outputFileExists('i18n/en.json')).toBe(true)
  const referenceLanguagePath = path.join(TEST_DIR, 'dist', 'i18n/en.json')
  const referenceLanguageJSON = loadLanguage(referenceLanguagePath)

  for (const language of manifest.languages) {
    expect(await outputFileExists(language.path)).toBe(true)
    const languagePath = path.join(TEST_DIR, 'dist', language.path)
    const languageJSON = loadLanguage(languagePath)

    // Ensure all keys from reference are present
    for (const key of Object.keys(referenceLanguageJSON)) {
      expect(languageJSON).toHaveProperty(key)
    }
  }
}

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

    await expectCoreFilesExist(MANIFEST as FoundryVTTManifest)
    await expectLanguagesToBeWellFormed(MANIFEST as FoundryVTTManifest)
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

    await expectCoreFilesExist(MANIFEST as FoundryVTTManifest, false)
    await expectLanguagesToBeWellFormed(MANIFEST as FoundryVTTManifest)
  })
})
