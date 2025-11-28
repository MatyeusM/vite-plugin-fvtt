import fs from 'node:fs/promises'
import path from 'node:path'
import { ViteDevServer, InlineConfig, createServer } from 'vite'
import { expect } from 'vitest'
import * as FsUtilities from '../src/utils/fs-utilities'
import { FoundryVTTManifest } from '../src/context'
import { flattenKeys } from '../src/language/transformer'
import packageJson from '../package.json' assert { type: 'json' }

export async function outputFileExists(
  testDirectory: string,
  relativeFilePath: string,
): Promise<boolean> {
  return await FsUtilities.fileExists(path.join(testDirectory, 'dist', relativeFilePath))
}

export async function loadLanguage(
  languagePath: string,
): Promise<Record<string, unknown> | undefined> {
  const language = await FsUtilities.readJson<Record<string, unknown>>(languagePath)
  expect(!!language).toBe(true)
  if (!language) return
  return flattenKeys(language)
}

export async function expectCoreFilesExist(
  testDirectory: string,
  manifest: FoundryVTTManifest,
  isSystem = true,
): Promise<void> {
  expect(await outputFileExists(testDirectory, isSystem ? 'system.json' : 'module.json')).toBe(true)
  expect(await outputFileExists(testDirectory, manifest.esmodules[0])).toBe(true)
  expect(await outputFileExists(testDirectory, manifest.styles[0])).toBe(true)
}

export async function expectLanguagesToBeWellFormed(
  testDirectory: string,
  manifest: FoundryVTTManifest,
): Promise<void> {
  expect(await outputFileExists(testDirectory, 'i18n/en.json')).toBe(true)
  const referenceLanguagePath = path.join(testDirectory, 'dist', 'i18n/en.json')
  const referenceLanguageJSON = await loadLanguage(referenceLanguagePath)

  for (const language of manifest.languages) {
    expect(await outputFileExists(testDirectory, language.path)).toBe(true)
    const languagePath = path.join(testDirectory, 'dist', language.path)
    const languageJSON = await loadLanguage(languagePath)

    // Ensure all keys from reference are present
    if (referenceLanguageJSON && languageJSON) {
      for (const key of Object.keys(referenceLanguageJSON)) {
        expect(languageJSON).toHaveProperty(key)
      }
    }
  }
}

export async function createTestFiles(
  testDirectory: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(testDirectory, file)
    const directory = path.dirname(fullPath)
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }
}

export async function fetchFromDevelopmentServer(
  url: string,
): Promise<{ status: number; headers: Headers; text: string }> {
  const response = await fetch(`http://localhost:30001${url}`)
  const text = await response.text()
  return { status: response.status, headers: response.headers, text }
}

export async function createTestServer(
  config: InlineConfig,
  port: number | undefined = undefined,
): Promise<ViteDevServer> {
  const server = await createServer({
    ...config,
    server: { port },
    configFile: false,
    logLevel: 'error',
  })
  await server.listen()
  return server
}

export async function stopTestServer(server: ViteDevServer): Promise<void> {
  await server.close()
}

export async function writeManifest(
  manifest,
  testDirectory: string,
  isSystem: boolean = true,
): Promise<void> {
  const outputFile = isSystem ? 'public/system.json' : 'public/module.json'
  const outputPath = path.join(testDirectory, outputFile)
  return await fs.writeFile(outputPath, JSON.stringify(manifest, undefined, 2), 'utf8')
}

export async function expectDistributionEntries(testDirectory): Promise<void> {
  await expect(fs.access(path.join(testDirectory, packageJson.main))).resolves.not.toThrow()
  await expect(fs.access(path.join(testDirectory, packageJson.types))).resolves.not.toThrow()
}

export function isOnlyCssComments(text: string) {
  // remove all block comments
  const stripped = text.replaceAll(/\/\*[\s\S]*?\*\//g, '')

  // remove whitespace
  const payload = stripped.trim()

  return payload.length === 0
}
