import fs from 'fs-extra'
import path from 'path'
import { UserConfig } from 'vite'
import { context, FoundryVTTManifest } from 'src/context'

export default function loadManifest(config: UserConfig): FoundryVTTManifest {
  if (context?.manifest) return context.manifest
  const publicDir = config.publicDir || 'public'

  const MANIFEST_LOCATIONS = [
    'system.json',
    'module.json',
    `${publicDir}/system.json`,
    `${publicDir}/module.json`,
  ]

  const foundPath = MANIFEST_LOCATIONS.map((relPath) => path.resolve(process.cwd(), relPath)).find(
    (absPath) => fs.pathExistsSync(absPath),
  )

  if (!foundPath) {
    throw new Error(
      `Could not find a manifest file (system.json or module.json) in project root or ${publicDir}/.`,
    )
  }

  try {
    const data = fs.readJsonSync(foundPath)
    data.manifestType = foundPath.includes('module.json') ? 'module' : 'system'

    return data as FoundryVTTManifest
    // eslint-disable-next-line
  } catch (err: any) {
    throw new Error(`Failed to read manifest at ${foundPath}: ${err?.message || err}`)
  }
}
