import path from 'path'
import { UserConfig } from 'vite'
import { context, FoundryVTTManifest } from 'src/context'
import * as FsUtils from 'src/utils/fs-utils'
import Logger from 'src/utils/logger'

export default async function loadManifest(
  config: UserConfig,
): Promise<FoundryVTTManifest | never> {
  if (context?.manifest) return context.manifest
  const publicDir = config.publicDir || 'public'

  const MANIFEST_LOCATIONS = [
    'system.json',
    'module.json',
    `${publicDir}/system.json`,
    `${publicDir}/module.json`,
  ]

  const paths = MANIFEST_LOCATIONS.map(f => path.resolve(process.cwd(), f))
  const exists = await Promise.all(paths.map(p => FsUtils.fileExists(p)))

  const idx = exists.findIndex(Boolean)
  const foundPath = idx !== -1 ? paths[idx] : undefined

  if (!foundPath) {
    Logger.fail(
      `Could not find a manifest file (system.json or module.json) in project root or ${publicDir}/.`,
    )
  }

  try {
    const data = await FsUtils.readJson<any>(foundPath)

    if (!data.id || typeof data.id !== 'string') {
      Logger.fail(`Manifest at ${foundPath} is missing required "id" field.`)
    }

    const hasEsmodules = Array.isArray(data.esmodules) && data.esmodules.length > 0
    const hasScripts = Array.isArray(data.scripts) && data.scripts.length > 0
    if (hasEsmodules === hasScripts) {
      Logger.fail(`Manifest at ${foundPath} must define exactly one of "esmodules" or "scripts".`)
    }

    const result: FoundryVTTManifest = {
      manifestType: foundPath.includes('module.json') ? 'module' : 'system',
      id: data.id,
      esmodules: Array.isArray(data.esmodules) ? data.esmodules : [],
      scripts: Array.isArray(data.scripts) ? data.scripts : [],
      styles: Array.isArray(data.styles) ? data.styles : [],
      languages: Array.isArray(data.languages) ? data.languages : [],
      packs: Array.isArray(data.packs) ? data.packs : [],
    }

    return result
  } catch (err: any) {
    Logger.fail(`Failed to read manifest at ${foundPath}: ${err?.message || err}`)
  }
}
