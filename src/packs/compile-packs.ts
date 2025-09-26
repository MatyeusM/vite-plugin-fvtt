import { compilePack } from '@foundryvtt/foundryvtt-cli'
import { glob } from 'tinyglobby'
import path from 'path'
import { context } from 'src/context'
import * as FsUtils from 'src/utils/fs-utils'
import Logger from 'src/utils/logger'
import * as PathUtils from 'src/utils/path-utils'

export async function compileManifestPacks() {
  if (!context.manifest?.packs) return

  for (const pack of context.manifest.packs) {
    const srcCandidates = [
      path.resolve(PathUtils.getSourceDirectory(), pack.path),
      path.resolve(PathUtils.getRoot(), pack.path),
    ]
    const dest = path.resolve(PathUtils.getOutDir(), pack.path)

    let chosenSrc: string | undefined
    for (const candidate of srcCandidates) {
      if (await FsUtils.dirExists(candidate)) {
        chosenSrc = candidate
        break
      }
    }

    if (!chosenSrc) {
      Logger.warn(`Pack path not found for ${pack.path}, skipped.`)
      continue
    }

    const entries = await glob(['**/*.yaml', '**/*.yml'], { cwd: chosenSrc, absolute: true })
    const hasYaml = entries.length > 0

    await compilePack(chosenSrc, dest, { yaml: hasYaml, recursive: true })
    Logger.info(`Compiled pack ${pack.path} (${hasYaml ? 'YAML' : 'JSON'}) from ${chosenSrc}`)
  }
}
