import fs from 'node:fs/promises'
import path from 'node:path'

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { loadEnvironment } from '../src/config'
import { generateTemporaryDirectory } from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
  await fs.mkdir(TEMPORARY_TEST_DIRECTORY, { recursive: true })
})

afterEach(async () => {
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function writeEnv(content: string): Promise<void> {
  await fs.writeFile(path.join(TEMPORARY_TEST_DIRECTORY, '.env.foundryvtt.local'), content, 'utf8')
}

describe('loadEnvironment', () => {
  it('falls back to localhost:30000 without env files', async () => {
    await expect(loadEnvironment()).resolves.toEqual({
      foundryUrl: 'localhost',
      foundryPort: 30000,
    })
  })

  it('strips protocol and path from FOUNDRY_URL', async () => {
    await writeEnv('FOUNDRY_URL=https://foundry.example.com/some/path/\nFOUNDRY_PORT=30000')
    await expect(loadEnvironment()).resolves.toEqual({
      foundryUrl: 'foundry.example.com',
      foundryPort: 30000,
    })
  })

  it.each(['abc', '0', '65536', '30.5', ''])('rejects invalid FOUNDRY_PORT "%s"', async port => {
    await writeEnv(`FOUNDRY_PORT=${port}`)
    await expect(loadEnvironment()).rejects.toThrow(/FOUNDRY_PORT/u)
  })

  it('rejects an empty FOUNDRY_URL', async () => {
    await writeEnv('FOUNDRY_URL=   ')
    await expect(loadEnvironment()).rejects.toThrow(/FOUNDRY_URL/u)
  })
})
