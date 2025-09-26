import path from 'node:path'
import { UserConfig } from 'vite'
import { context, FoundryVTTManifest } from 'src/context'
import * as FsUtils from 'src/utils/fs-utilities'
import * as Logger from 'src/utils/logger'

async function resolveManifestPath(publicDirectory: string): Promise<string | undefined> {
  const MANIFEST_LOCATIONS = [
    'system.json',
    'module.json',
    `${publicDirectory}/system.json`,
    `${publicDirectory}/module.json`,
  ]

  const paths = MANIFEST_LOCATIONS.map(f => path.resolve(process.cwd(), f))
  const exists = await Promise.all(paths.map(p => FsUtils.fileExists(p)))

  const index = exists.findIndex(Boolean)
  return index === -1 ? undefined : paths[index]
}

function isLanguageEntry(object: unknown): object is { lang: string; path: string } {
  return (
    typeof object === 'object' &&
    object !== null &&
    'lang' in object &&
    'path' in object &&
    typeof (object as Record<string, unknown>).lang === 'string' &&
    typeof (object as Record<string, unknown>).path === 'string'
  )
}

function isPackEntry(object: unknown): object is { path: string } {
  return (
    typeof object === 'object' &&
    object !== null &&
    'path' in object &&
    typeof (object as Record<string, unknown>).path === 'string'
  )
}

function validateManifest(rawData: unknown, foundPath: string): FoundryVTTManifest {
  if (typeof rawData !== 'object' || rawData === null)
    Logger.fail(`Manifest at ${foundPath} is not a valid JSON object.`)

  const data = rawData as Record<string, unknown>

  if (typeof data.id !== 'string')
    Logger.fail('Manifest is missing required "id" field or it is not a string')

  const esmodules = Array.isArray(data.esmodules) ? data.esmodules.map(String) : []
  const scripts = Array.isArray(data.scripts) ? data.scripts.map(String) : []

  if (esmodules.length > 0 === scripts.length > 0)
    Logger.fail('Manifest must define exactly one of "esmodules" or "scripts"')

  const styles = Array.isArray(data.styles) ? data.styles.map(String) : []

  const languages: { lang: string; path: string }[] =
    Array.isArray(data.languages) && data.languages.every(entry => isLanguageEntry(entry))
      ? (data.languages as { lang: string; path: string }[])
      : []

  const packs: { path: string }[] =
    Array.isArray(data.packs) && data.packs.every(entry => isPackEntry(entry))
      ? (data.packs as { path: string }[])
      : []

  return {
    manifestType: foundPath.includes('module.json') ? 'module' : 'system',
    id: data.id,
    esmodules,
    scripts,
    styles,
    languages,
    packs,
  }
}

export default async function loadManifest(
  config: UserConfig,
): Promise<FoundryVTTManifest | never> {
  if (context?.manifest) return context.manifest
  const publicDirectory = config.publicDir || 'public'

  const foundPath = await resolveManifestPath(publicDirectory)
  if (!foundPath) {
    Logger.fail(
      `Could not find a manifest file (system.json or module.json) in project root or ${publicDirectory}/.`,
    )
  }

  try {
    const rawData = await FsUtils.readJson(foundPath)
    return validateManifest(rawData, foundPath)
  } catch (error) {
    if (error instanceof Error)
      Logger.fail(`Failed to read manifest at ${foundPath}: ${error.message}`)
    Logger.fail(`Failed to read manifest at ${foundPath}: ${String(error)}`)
  }
}
