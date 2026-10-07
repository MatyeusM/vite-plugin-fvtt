import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { restoreWorldData, stopFoundry } from './e2e/proc'

const execFileAsync = promisify(execFile)

async function git(dir: string, ...args: Array<string>): Promise<void> {
  await execFileAsync('git', ['-C', dir, ...args])
}

async function commit(dir: string, message: string): Promise<void> {
  await git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', message)
}

function worldFile(dir: string, id: string, ...rest: Array<string>): string {
  return join(dir, `local/data-${id}/Data/worlds/test${id}`, ...rest)
}

async function seedWorld(dir: string, id: string): Promise<void> {
  await mkdir(worldFile(dir, id, 'data/actors'), { recursive: true })
  await writeFile(worldFile(dir, id, 'world.json'), '{"title":"Test World"}')
}

async function makeSeededRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'world-seed-'))
  await git(dir, 'init')
  await git(dir, 'commit', '--allow-empty', '--allow-empty-message', '-m', '')
  await seedWorld(dir, 'v13')
  await seedWorld(dir, 'v14')
  await git(dir, 'add', '-A')
  await commit(dir, 'seed')
  return dir
}

describe('restoreWorldData', () => {
  let dir = ''

  beforeEach(async () => {
    dir = await makeSeededRepo()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('restores rewritten files and drops new runtime files', async () => {
    await writeFile(worldFile(dir, 'v13', 'world.json'), '{"title":"rewritten on boot"}')
    await writeFile(worldFile(dir, 'v13', 'data/actors/LOCK'), 'pid')

    await restoreWorldData('v13', dir)

    expect(await readFile(worldFile(dir, 'v13', 'world.json'), 'utf8')).toBe(
      '{"title":"Test World"}',
    )
    await expect(readFile(worldFile(dir, 'v13', 'data/actors/LOCK'), 'utf8')).rejects.toThrow(
      'ENOENT',
    )
  })

  it('leaves other versions alone', async () => {
    await writeFile(worldFile(dir, 'v14', 'world.json'), '{"title":"other"}')

    await restoreWorldData('v13', dir)

    expect(await readFile(worldFile(dir, 'v14', 'world.json'), 'utf8')).toBe('{"title":"other"}')
  })
})

describe('stopFoundry', () => {
  let dir = ''

  beforeEach(async () => {
    dir = await makeSeededRepo()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('without a child resolves without touching the tree', async () => {
    await writeFile(worldFile(dir, 'v13', 'world.json'), '{"title":"dirty"}')

    await stopFoundry(undefined, 'v13', dir)

    expect(await readFile(worldFile(dir, 'v13', 'world.json'), 'utf8')).toBe('{"title":"dirty"}')
  })

  it('kills its instance and restores the seed', async () => {
    await writeFile(worldFile(dir, 'v13', 'world.json'), '{"title":"rewritten on boot"}')
    const child: ChildProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
      detached: true,
    })

    await stopFoundry(child, 'v13', dir)

    expect(child.signalCode).toBe('SIGTERM')
    expect(await readFile(worldFile(dir, 'v13', 'world.json'), 'utf8')).toBe(
      '{"title":"Test World"}',
    )
  })
})
