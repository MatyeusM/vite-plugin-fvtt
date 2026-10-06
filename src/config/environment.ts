import { glob } from 'tinyglobby'

import { ENVOptions } from '@/context'
import * as FsUtils from '@/utils/fs-utilities'
import * as Logger from '@/utils/logger'

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

function normalizeFoundryUrl(raw: string): string {
  const host = raw
    .trim()
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u, '')
    .split('/')[0]
    .trim()
  if (!host) Logger.fail(`Invalid FOUNDRY_URL "${raw}": expected a hostname such as "localhost".`)
  return host
}

function parseFoundryPort(raw: string): number {
  const port = Number(raw.trim())
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    Logger.fail(`Invalid FOUNDRY_PORT "${raw}": expected an integer between 1 and 65535.`)
  return port
}

export default async function loadEnvironment(): Promise<ENVOptions> {
  const environmentPaths = await glob('.env.foundryvtt*', { absolute: true })
  const merged: Record<string, string> = { FOUNDRY_URL: 'localhost', FOUNDRY_PORT: '30000' }

  const contents = await Promise.all(environmentPaths.map(file => FsUtils.readFile(file)))

  for (const content of contents) {
    Object.assign(merged, parseEnvironment(content))
  }

  return {
    foundryUrl: normalizeFoundryUrl(merged.FOUNDRY_URL),
    foundryPort: parseFoundryPort(merged.FOUNDRY_PORT),
  }
}
