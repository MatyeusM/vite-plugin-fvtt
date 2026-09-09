import { glob } from 'tinyglobby'

import { ENVOptions } from '@/context'
import * as FsUtils from '@/utils/fs-utilities'

function parseEnvironment(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    result[key.trim()] = rest.join('=').trim()
  }
  return result
}

export default async function loadEnvironment(): Promise<ENVOptions> {
  const environmentPaths = await glob('.env.foundryvtt*', { absolute: true })
  const merged: Record<string, string> = { FOUNDRY_URL: 'localhost', FOUNDRY_PORT: '30000' }

  const contents = await Promise.all(environmentPaths.map(file => FsUtils.readFile(file)))

  for (const content of contents) {
    Object.assign(merged, parseEnvironment(content))
  }

  return { foundryUrl: merged.FOUNDRY_URL, foundryPort: Number(merged.FOUNDRY_PORT) }
}
