// tests/test-utilities.ts
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ViteDevServer, InlineConfig, createServer } from 'vite'
import { expect } from 'vitest'
import * as FsUtilities from '../src/utils/fs-utilities'
import { flattenKeys } from '../src/language/transformer'
import packageJson from '../package.json' assert { type: 'json' }
import { Manifest } from './fixture-data'

// --- File System Utilities ---

export function generateTemporaryDirectory(prefix: string = ''): string {
  return prefix
    ? path.resolve(__dirname, `.${prefix}-${randomUUID()}`)
    : path.resolve(__dirname, randomUUID())
}

function getOutputPath(testDirectory: string, relativeFilePath: string): string {
  return path.join(testDirectory, 'dist', relativeFilePath)
}

export async function outputFileExists(
  testDirectory: string,
  relativeFilePath: string,
): Promise<boolean> {
  return await FsUtilities.fileExists(getOutputPath(testDirectory, relativeFilePath))
}

export async function loadLanguage(
  languagePath: string,
): Promise<Record<string, unknown> | undefined> {
  const language = await FsUtilities.readJson<Record<string, unknown>>(languagePath)
  if (!language) return
  return flattenKeys(language)
}

export async function createTestFiles(
  testDirectory: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(testDirectory, file)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }
}

export async function writeManifest(
  manifest: Manifest,
  testDirectory: string,
  isSystem: boolean = true,
): Promise<void> {
  const outputFile = isSystem ? 'public/system.json' : 'public/module.json'
  const outputPath = path.join(testDirectory, outputFile)
  return await fs.writeFile(outputPath, JSON.stringify(manifest, undefined, 2), 'utf8')
}

export function isOnlyCssComments(text: string): boolean {
  const stripped = text.replaceAll(/\/\*[\s\S]*?\*\//g, '').trim()
  return stripped.length === 0
}

// --- Development Server Utilities ---

export async function fetchFromDevelopmentServer(
  url: string,
): Promise<{ status: number; headers: Headers; text: string }> {
  const response = await fetch(`http://localhost:30001${url}`)
  const text = await response.text()
  return { status: response.status, headers: response.headers, text }
}

export async function createTestServer(config: InlineConfig): Promise<ViteDevServer> {
  const server = await createServer({ ...config, configFile: false, logLevel: 'error' })
  await server.listen()
  return server
}

export async function stopTestServer(server: ViteDevServer): Promise<void> {
  await server.close()
}

// --- Custom Vitest Matchers ---

interface CustomMatchers<R = unknown> {
  toHaveCoreFiles(manifest: Manifest, isSystem?: boolean): R
  toHaveWellFormedLanguages(manifest: Manifest): R
  toHaveDistributionEntries(): R
  toHaveOutputFile(relativeFilePath: string): R
}

declare module 'vitest' {
  interface Assertion<T> extends CustomMatchers<T> {
    __brand?: unknown
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    __brand?: unknown
  }
}

expect.extend({
  async toHaveOutputFile(received: string, relativeFilePath: string) {
    const testDirectory = received
    const pass = await outputFileExists(testDirectory, relativeFilePath)
    const outputPath = getOutputPath(testDirectory, relativeFilePath)

    return pass
      ? {
          message: () =>
            `expected output directory "${testDirectory}" not to contain file "${outputPath}"`,
          pass: true,
        }
      : {
          message: () =>
            `expected output directory "${testDirectory}" to contain file "${outputPath}"`,
          pass: false,
        }
  },

  async toHaveCoreFiles(received: string, manifest: Manifest, isSystem: boolean = true) {
    const testDirectory = received
    const manifestName = isSystem ? 'system.json' : 'module.json'

    const manifestExists = await outputFileExists(testDirectory, manifestName)
    const esmoduleExists = await outputFileExists(testDirectory, manifest.esmodules[0])
    const stylesExists = manifest.styles
      ? await outputFileExists(testDirectory, manifest.styles[0])
      : true // If styles not in manifest, consider it as passing

    const pass = manifestExists && esmoduleExists && stylesExists

    const failureDetails = [
      `- ${manifestName}: ${manifestExists ? 'PASS' : 'FAIL'}`,
      `- ${manifest.esmodules[0]}: ${esmoduleExists ? 'PASS' : 'FAIL'}`,
    ]
    if (manifest.styles) {
      failureDetails.push(`- ${manifest.styles[0]}: ${stylesExists ? 'PASS' : 'FAIL'}`)
    }

    return pass
      ? { message: () => `expected core files to not exist in "${testDirectory}"`, pass: true }
      : {
          message: () => `expected core files to exist in "${testDirectory}":
      ${failureDetails.join('\n      ')}
    `,
          pass: false,
        }
  },

  async toHaveWellFormedLanguages(received: string, manifest: Manifest) {
    const testDirectory = received

    // If languages not in manifest, consider it as passing
    if (!manifest.languages) {
      return {
        message: () => `expected language files to not be well-formed in "${testDirectory}"`,
        pass: true,
      }
    }

    const referenceFilePath = 'i18n/en.json' // Assuming 'en' is the reference language

    // 1. Check if the reference file exists
    if (!(await outputFileExists(testDirectory, referenceFilePath))) {
      return {
        message: () =>
          `Reference language file "${getOutputPath(testDirectory, referenceFilePath)}" is missing.`,
        pass: false,
      }
    }

    const referenceLanguagePath = getOutputPath(testDirectory, referenceFilePath)
    const referenceLanguageJSON = await loadLanguage(referenceLanguagePath)

    if (!referenceLanguageJSON) {
      return { message: () => `Could not load reference language JSON.`, pass: false }
    }

    // 2. Check all other language files
    for (const language of manifest.languages) {
      const languageFilePath = language.path
      const languagePath = getOutputPath(testDirectory, languageFilePath)

      if (!(await outputFileExists(testDirectory, languageFilePath))) {
        return { message: () => `Language file "${languagePath}" is missing.`, pass: false }
      }

      const languageJSON = await loadLanguage(languagePath)
      if (!languageJSON) {
        return {
          message: () => `Could not load language JSON for "${language.lang}".`,
          pass: false,
        }
      }

      for (const key of Object.keys(referenceLanguageJSON)) {
        if (!Object.hasOwn(languageJSON, key)) {
          return {
            message: () =>
              `Language "${language.lang}" (${languageFilePath}) is missing key: "${key}"`,
            pass: false,
          }
        }
      }
    }

    return {
      message: () => `expected language files to not be well-formed in "${testDirectory}"`,
      pass: true,
    }
  },

  async toHaveDistributionEntries(received: string) {
    const testDirectory = received
    const mainPath = path.join(testDirectory, packageJson.main)
    const typesPath = path.join(testDirectory, packageJson.types)

    let mainPass = true
    let typesPass = true

    try {
      await fs.access(mainPath)
    } catch {
      mainPass = false
    }

    try {
      await fs.access(typesPath)
    } catch {
      typesPass = false
    }

    const pass = mainPass && typesPass

    return pass
      ? {
          message: () => `expected distribution entries to exist in "${testDirectory}"`,
          pass: true,
        }
      : {
          message: () => `expected distribution entries to exist in "${testDirectory}"`,
          pass: false,
        }
  },
})
