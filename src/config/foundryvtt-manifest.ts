import fs from 'fs-extra'
import path from 'path/posix'
import { UserConfig } from 'vite'
import { context, FoundryVTTManifest } from 'src/context'
import logger from 'src/utils/logger'

export default function loadManifest(config: UserConfig): FoundryVTTManifest | void {
  if (context?.manifest) return context.manifest
  const publicDir = config.publicDir || 'public'

  const MANIFEST_LOCATIONS = [
    'system.json',
    'module.json',
    `${publicDir}/system.json`,
    `${publicDir}/module.json`,
  ]

  const foundPath = MANIFEST_LOCATIONS.map(relPath => path.resolve(process.cwd(), relPath)).find(
    absPath => fs.pathExistsSync(absPath),
  )

  if (!foundPath) {
    logger.fail(
      `Could not find a manifest file (system.json or module.json) in project root or ${publicDir}/.`,
    )
  }

  try {
    const data = fs.readJsonSync(foundPath!)

    if (!data.id || typeof data.id !== 'string') {
      logger.fail(`Manifest at ${foundPath} is missing required "id" field.`)
    }

    const hasEsmodules = Array.isArray(data.esmodules) && data.esmodules.length > 0
    const hasScripts = Array.isArray(data.scripts) && data.scripts.length > 0
    if (hasEsmodules === hasScripts) {
      logger.fail(`Manifest at ${foundPath} must define exactly one of "esmodules" or "scripts".`)
    }

    const result: FoundryVTTManifest = {
      manifestType: foundPath!.includes('module.json') ? 'module' : 'system',
      id: data.id,
      esmodules: Array.isArray(data.esmodules) ? data.esmodules : [],
      scripts: Array.isArray(data.scripts) ? data.scripts : [],
      styles: Array.isArray(data.styles) ? data.styles : [],
      languages: Array.isArray(data.languages) ? data.languages : [],
      packs: Array.isArray(data.packs) ? data.packs : [],
    }

    return result
  } catch (err: any) {
    logger.fail(`Failed to read manifest at ${foundPath}: ${err?.message || err}`)
  }
}
