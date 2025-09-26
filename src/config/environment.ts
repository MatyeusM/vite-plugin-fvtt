import { glob } from 'tinyglobby'
import { ENVOptions } from 'src/context'
import * as FsUtils from 'src/utils/fs-utilities'

function parseEnvironment(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    result[key.trim()] = rest.join('=').trim()
  }
  return result
}

export default async function loadEnvironment(): Promise<ENVOptions> {
  const environmentPaths = await glob('.env.foundryvtt*', { absolute: true })
  let merged: Record<string, string> = { FOUNDRY_URL: 'localhost', FOUNDRY_PORT: '30000' }

  for (const file of environmentPaths) {
    const content = await FsUtils.readFile(file)
    merged = { ...merged, ...parseEnvironment(content) }
  }

  return { foundryUrl: merged.FOUNDRY_URL, foundryPort: Number.parseInt(merged.FOUNDRY_PORT, 10) }
}
