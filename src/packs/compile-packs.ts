import { compilePack } from '@foundryvtt/foundryvtt-cli'
import { glob } from 'tinyglobby'
import path from 'node:path'
import { context } from 'src/context'
import * as FsUtils from 'src/utils/fs-utilities'
import * as Logger from 'src/utils/logger'
import * as PathUtils from 'src/utils/path-utilities'

export async function compileManifestPacks() {
  if (!context.manifest?.packs) return

  for (const pack of context.manifest.packs) {
    const sourceCandidates = [
      path.resolve(PathUtils.getSourceDirectory(), pack.path),
      path.resolve(PathUtils.getRoot(), pack.path),
    ]
    const destination = path.resolve(PathUtils.getOutDirectory(), pack.path)

    let chosenSource: string | undefined
    for (const candidate of sourceCandidates) {
      if (await FsUtils.directoryExists(candidate)) {
        chosenSource = candidate
        break
      }
    }

    if (!chosenSource) {
      Logger.warn(`Pack path not found for ${pack.path}, skipped.`)
      continue
    }

    const entries = await glob(['**/*.yaml', '**/*.yml'], { cwd: chosenSource, absolute: true })
    const hasYaml = entries.length > 0

    await compilePack(chosenSource, destination, { yaml: hasYaml, recursive: true })
    Logger.info(`Compiled pack ${pack.path} (${hasYaml ? 'YAML' : 'JSON'}) from ${chosenSource}`)
  }
}
