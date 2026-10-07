import { spawn, type ChildProcess } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { restoreWorldData, stopFoundry, type GitRunner } from './e2e/proc'

type GitCall = { args: Array<string>; cwd: string }

function makeGitStub(): { calls: Array<GitCall>; run: GitRunner } {
  const calls: Array<GitCall> = []
  const run: GitRunner = (args, options) => {
    calls.push({ args, cwd: options.cwd })
    return Promise.resolve()
  }
  return { calls, run }
}

describe('restoreWorldData', () => {
  it('restores then cleans the version worlds dir', { timeout: 60_000 }, async () => {
    const git = makeGitStub()

    await restoreWorldData('v13', '/repo', git.run)

    expect(git.calls).toEqual([
      { args: ['restore', 'local/data-v13/Data/worlds'], cwd: '/repo' },
      { args: ['clean', '-fdq', 'local/data-v13/Data/worlds'], cwd: '/repo' },
    ])
  })
})

describe('stopFoundry', () => {
  it('without a child resolves without touching git', { timeout: 60_000 }, async () => {
    const git = makeGitStub()

    await stopFoundry(undefined, 'v13', '/repo', git.run)

    expect(git.calls).toEqual([])
  })

  it('kills its instance and restores the seed', { timeout: 60_000 }, async () => {
    const git = makeGitStub()
    const child: ChildProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
      detached: true,
    })

    await stopFoundry(child, 'v13', '/repo', git.run)

    expect(child.signalCode).toBe('SIGTERM')
    expect(git.calls.length).toBe(2)
  })

  it('restores without killing an already-exited instance', { timeout: 60_000 }, async () => {
    const git = makeGitStub()
    const child: ChildProcess = spawn(process.execPath, ['-e', ''])
    await new Promise<void>(resolve => {
      child.once('exit', () => resolve())
    })

    await stopFoundry(child, 'v13', '/repo', git.run)

    expect(git.calls.length).toBe(2)
  })
})
