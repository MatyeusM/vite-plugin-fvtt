/**
 * npm runs a published package's `preinstall`/`postinstall` inside the *consumer's* project. Those
 * hooks belong to this repo's own tooling and break installs elsewhere: `npx only-allow pnpm` fetches
 * a package from the registry during install, and `simple-git-hooks` is a dev dependency that is not
 * shipped, so the install dies with exit code 127.
 *
 * Contributors keep the full script set; the published manifest keeps only `dev`/`build`. Runs on
 * Node's native TypeScript stripping, which is why it needs no build step of its own.
 *
 *   node strip-publish.ts strip     # prepack: reduce the manifest
 *   node strip-publish.ts restore   # postpack: put the full manifest back
 */
import fs from 'node:fs'

const MANIFEST = 'package.json'
const BACKUP = '.publish-scripts.json'
const PUBLISHED_SCRIPTS = ['build', 'dev']

type Scripts = Record<string, string>

interface Manifest {
  scripts?: Scripts
  [key: string]: unknown
}

function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest
}

function writeManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

function strip(): void {
  if (fs.existsSync(BACKUP)) throw new Error(`${BACKUP} exists; an earlier pack did not finish`)

  const manifest = readManifest()
  const scripts: Scripts = manifest.scripts ?? {}
  fs.writeFileSync(BACKUP, JSON.stringify(scripts))

  const kept = Object.fromEntries(
    PUBLISHED_SCRIPTS.filter(name => name in scripts).map(name => [name, scripts[name]]),
  )
  writeManifest({ ...manifest, scripts: kept })

  const dropped = Object.keys(scripts).filter(name => !(name in kept))
  console.log(
    `stripped scripts: dropped ${dropped.join(', ')}; kept ${Object.keys(kept).join(', ')}`,
  )
}

function restore(): void {
  if (!fs.existsSync(BACKUP)) return console.log('nothing to restore')
  const manifest = readManifest()
  const scripts = JSON.parse(fs.readFileSync(BACKUP, 'utf8')) as Scripts
  fs.rmSync(BACKUP)
  writeManifest({ ...manifest, scripts })
  console.log(`restored ${Object.keys(scripts).length} scripts`)
}

const command = process.argv[2]
if (command === 'strip') strip()
else if (command === 'restore') restore()
else throw new Error('usage: node strip-publish.ts <strip|restore>')
