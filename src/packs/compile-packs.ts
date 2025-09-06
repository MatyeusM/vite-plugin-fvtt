import { compilePack } from '@foundryvtt/foundryvtt-cli'
import fs from 'fs-extra'
import posix from 'path/posix'
import { context } from 'src/context'
import logger from 'src/utils/logger'
import path from 'src/utils/path-utils'

export async function compileManifestPacks() {
  if (!context.manifest?.packs) return

  for (const pack of context.manifest.packs) {
    const srcCandidates = [
      posix.resolve(path.getSourceDirectory(), pack.path),
      posix.resolve(path.getRoot(), pack.path),
    ]
    const dest = posix.resolve(path.getOutDir(), pack.path)

    const chosenSrc = srcCandidates.find(
      candidate => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory(),
    )

    if (!chosenSrc) {
      logger.warn(`Pack path not found for ${pack.path}, skipped.`)
      continue
    }

    const hasYaml = fs
      .readdirSync(chosenSrc)
      .some(file => file.endsWith('.yaml') || file.endsWith('.yml'))

    await compilePack(chosenSrc, dest, { yaml: hasYaml, recursive: true })
    logger.info(`Compiled pack ${pack.path} (${hasYaml ? 'YAML' : 'JSON'}) from ${chosenSrc}`)
  }
}
