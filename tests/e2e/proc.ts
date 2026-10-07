/**
 * Process and polling helpers for the Foundry e2e suites: booting an instance through `mise`,
 * starting the Vite dev server, and waiting for a URL to answer.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

import { LOCAL_DIR } from './support'

export async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.status < 500
  } catch {
    return false
  }
}

/**
 * Foundry starts listening *before* it finishes launching the world, so the port alone is not a
 * readiness signal: joining during startup authenticates and then drops the session, because
 * `world` is still null. Its own "no active game session" page is the honest signal instead.
 */
export async function isWorldReady(url: string): Promise<boolean> {
  try {
    const body = await (await fetch(`${url}/join`)).text()
    return !/Critical Failure|no active game session/iu.test(body)
  } catch {
    return false
  }
}

/** Recursive rather than a loop, to satisfy `no-await-in-loop`. */
export async function waitUntil(
  check: () => Promise<boolean>,
  label: string,
  ms: number,
): Promise<void> {
  const deadline = Date.now() + ms
  if (await check()) return
  if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`)
  await delay(500)
  return waitUntil(check, label, Math.max(0, deadline - Date.now()))
}

export function kill(child: ChildProcess | undefined): void {
  if (child?.pid) process.kill(-child.pid, 'SIGTERM')
}

/** `mise run start-v<n>` resolves the Node version the Foundry build wants and boots the world. */
export function startFoundry(id: string): ChildProcess {
  return spawn('mise', ['-C', LOCAL_DIR, 'run', `start-${id}`], {
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
  })
}

export function startDevServer(systemDir: string): Promise<ChildProcess> {
  // --strictPort matters here: the dev server wants foundryPort + 1, which is the *other* version's
  // Foundry port. Without it Vite silently drifts to the next free port, and the suite would then
  // talk to whatever else happens to be listening on the port it expects.
  const child = spawn('npx', ['vite', '--strictPort'], { cwd: systemDir, detached: true })
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server did not report ready')), 120_000)
    const onData = (chunk: Buffer): void => {
      const text = String(chunk)
      process.stderr.write(text)
      if (!/ready in|error/iu.test(text)) return
      clearTimeout(timer)
      resolve()
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
  })
  return ready.then(() => child)
}
