import path from 'path'
import { LibraryOptions, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import Logger from './logger'
import * as FsUtils from './fs-utils'

let _config: ResolvedConfig | null = null
let _sourceDirectory: string | null = null
let _decodedBase: string | null = null
let _publicDir: string | null = null
let _outDir: string | null = null
let _root: string | null = null

function getConfig(): ResolvedConfig {
  if (!_config) {
    const config = context.config
    if (!config) Logger.fail('Path utils can only be called after vite has resolved the config')
    _config = config as ResolvedConfig
  }
  return _config
}

export function getDecodedBase(): string {
  if (!_decodedBase) {
    const config = getConfig()
    _decodedBase = path.posix.normalize(decodeURI(config.base))
  }
  return _decodedBase
}

export function getSourceDirectory(): string {
  if (!_sourceDirectory) {
    const config = getConfig()
    const normalizedEntry = path.normalize((config.build.lib as LibraryOptions).entry.toString())
    const segments = normalizedEntry
      .split(path.sep)
      .filter(Boolean)
      .filter(s => s !== '.')
    const firstFolder = segments.length > 0 ? segments[0] : '.'
    _sourceDirectory = path.join(config.root, firstFolder)
  }
  return _sourceDirectory
}

export function getPublicDir(): string {
  if (!_publicDir) {
    const config = getConfig()
    _publicDir = path.resolve(config.publicDir)
  }
  return _publicDir
}

export function getOutDir(): string {
  if (!_outDir) {
    const config = getConfig()
    _outDir = path.resolve(config.build.outDir)
  }
  return _outDir
}

export function getRoot(): string {
  if (!_root) {
    const config = getConfig()
    _root = path.resolve(config.root)
  }
  return _root
}

export async function getOutDirFile(p: string): Promise<string> {
  const file = path.join(getOutDir(), p)
  return (await FsUtils.fileExists(file)) ? file : ''
}

export async function getPublicDirFile(p: string): Promise<string> {
  const file = path.join(getPublicDir(), p)
  return (await FsUtils.fileExists(file)) ? file : ''
}

async function findLocalFilePath(p: string): Promise<string | null> {
  const fileCandidates = [getPublicDir(), getSourceDirectory(), getRoot()].map(pth =>
    path.join(pth, p),
  )

  const exists = await Promise.all(fileCandidates.map(FsUtils.fileExists))
  const idx = exists.findIndex(Boolean)
  return idx !== -1 ? fileCandidates[idx] : null
}

export function isFoundryVTTUrl(p: string): boolean {
  const decodedBase = getDecodedBase()
  const pathToCheck = path.posix.normalize(p)
  return pathToCheck.startsWith(decodedBase)
}

export async function foundryVTTUrlToLocal(p: string): Promise<string | null> {
  const decodedBase = getDecodedBase()
  let pathToTransform = path.posix.normalize('/' + p)
  if (!pathToTransform.startsWith(decodedBase)) return null
  pathToTransform = path.relative(decodedBase, pathToTransform)
  return findLocalFilePath(pathToTransform)
}

export function localToFoundryVTTUrl(p: string): string {
  const decodedBase = getDecodedBase()
  let pathToTransform = path.normalize(p)
  ;[getPublicDir(), getSourceDirectory(), getRoot()].forEach(pth => {
    if (pathToTransform.startsWith(pth)) {
      pathToTransform = pathToTransform.slice(pth.length)
    }
  })
  return path.join(decodedBase, pathToTransform)
}

export function getLanguageSourcePath(p: string, lang: string): string {
  const dir = path.parse(p).dir
  const lastDirName = path.basename(dir)
  const finalSegments = lastDirName === lang ? dir : path.join(dir, lang)
  return path.join(getSourceDirectory(), finalSegments)
}
