import { glob } from 'tinyglobby'
import { ENVOptions } from 'src/context'
import * as FsUtils from 'src/utils/fs-utils'

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    result[key.trim()] = rest.join('=').trim()
  }
  return result
}

export default async function loadEnv(): Promise<ENVOptions> {
  const envPaths = await glob('.env.foundryvtt*', { absolute: true })
  let merged: Record<string, string> = { FOUNDRY_URL: 'localhost', FOUNDRY_PORT: '30000' }

  for (const file of envPaths) {
    const content = await FsUtils.readFile(file, 'utf-8')
    merged = { ...merged, ...parseEnv(content) }
  }

  return { foundryUrl: merged.FOUNDRY_URL, foundryPort: parseInt(merged.FOUNDRY_PORT, 10) }
}
