import { compilePack } from '@foundryvtt/foundryvtt-cli'
import fs from 'fs-extra'
import path from 'path'
import { context } from 'src/context'
import Logger from 'src/utils/logger'
import pathUtils from 'src/utils/path-utils'

export async function compileManifestPacks() {
  if (!context.manifest?.packs) return

  for (const pack of context.manifest.packs) {
    const srcCandidates = [
      path.resolve(pathUtils.getSourceDirectory(), pack.path),
      path.resolve(pathUtils.getRoot(), pack.path),
    ]
    const dest = path.resolve(pathUtils.getOutDir(), pack.path)

    const chosenSrc = srcCandidates.find(
      candidate => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory(),
    )

    if (!chosenSrc) {
      Logger.warn(`Pack path not found for ${pack.path}, skipped.`)
      continue
    }

    const entries = fs.readdirSync(chosenSrc, { recursive: true, encoding: 'utf8' })
    const hasYaml = entries.some(entry => entry.endsWith('.yaml') || entry.endsWith('.yml'))

    await compilePack(chosenSrc, dest, { yaml: hasYaml, recursive: true })
    Logger.info(`Compiled pack ${pack.path} (${hasYaml ? 'YAML' : 'JSON'}) from ${chosenSrc}`)
  }
}
