import path from 'node:path'
import { LibraryOptions, ResolvedConfig } from 'vite'
import { context } from '@/context'
import * as Logger from './logger'
import * as FsUtilities from './fs-utilities'

const cache: {
  config?: ResolvedConfig
  sourceDirectory?: string
  decodedBase?: string
  publicDirectory?: string
  outDirectory?: string
  root?: string
} = {}

function getConfig(): ResolvedConfig {
  if (!cache.config) {
    const config = context.config
    if (!config) Logger.fail('Path utils can only be called after vite has resolved the config')
    cache.config = config as ResolvedConfig
  }
  return cache.config
}

export function getDecodedBase(): string {
  if (!cache.decodedBase) {
    const config = getConfig()
    cache.decodedBase = path.posix.normalize(decodeURI(config.base))
  }
  return cache.decodedBase
}

export function getSourceDirectory(): string {
  if (!cache.sourceDirectory) {
    const config = getConfig()
    const normalizedEntry = path.normalize((config.build.lib as LibraryOptions).entry.toString())
    const segments = normalizedEntry
      .split(path.sep)
      .filter(Boolean)
      .filter(s => s !== '.')
    const firstFolder = segments.length > 0 ? segments[0] : '.'
    cache.sourceDirectory = path.join(config.root, firstFolder)
  }
  return cache.sourceDirectory
}

export function getPublicDirectory(): string {
  if (!cache.publicDirectory) {
    const config = getConfig()
    cache.publicDirectory = path.resolve(config.publicDir)
  }
  return cache.publicDirectory
}

export function getOutDirectory(): string {
  if (!cache.outDirectory) {
    const config = getConfig()
    cache.outDirectory = path.resolve(config.build.outDir)
  }
  return cache.outDirectory
}

export function getRoot(): string {
  if (!cache.root) {
    const config = getConfig()
    cache.root = path.resolve(config.root)
  }
  return cache.root
}

export async function getOutDirectoryFile(p: string): Promise<string> {
  const file = path.join(getOutDirectory(), p)
  return (await FsUtilities.fileExists(file)) ? file : ''
}

export async function getPublicDirectoryFile(p: string): Promise<string> {
  const file = path.join(getPublicDirectory(), p)
  return (await FsUtilities.fileExists(file)) ? file : ''
}

async function findLocalFilePath(p: string): Promise<string | undefined> {
  const fileCandidates = [getPublicDirectory(), getSourceDirectory(), getRoot()].map(pth =>
    path.join(pth, p),
  )

  const exists = await Promise.all(fileCandidates.map(file => FsUtilities.fileExists(file)))
  const index = exists.findIndex(Boolean)
  return index === -1 ? undefined : fileCandidates[index]
}

export function isFoundryVTTUrl(p: string): boolean {
  const decodedBase = getDecodedBase()
  const pathToCheck = path.posix.normalize(p)
  return pathToCheck.startsWith(decodedBase)
}

export async function foundryVTTUrlToLocal(p: string): Promise<string | undefined> {
  const decodedBase = getDecodedBase()
  let pathToTransform = path.posix.normalize('/' + p)
  if (!pathToTransform.startsWith(decodedBase)) return undefined
  pathToTransform = path.relative(decodedBase, pathToTransform)
  return findLocalFilePath(pathToTransform)
}

export function localToFoundryVTTUrl(p: string): string {
  const decodedBase = getDecodedBase()
  let pathToTransform = path.normalize(p)
  for (const pth of [getPublicDirectory(), getSourceDirectory(), getRoot()]) {
    if (pathToTransform.startsWith(pth)) {
      pathToTransform = pathToTransform.slice(pth.length)
    }
  }
  return path.join(decodedBase, pathToTransform)
}

export function getLanguageSourcePath(p: string, lang: string): string {
  const directory = path.parse(p).dir
  const lastDirectoryName = path.basename(directory)
  const finalSegments = lastDirectoryName === lang ? directory : path.join(directory, lang)
  return path.join(getSourceDirectory(), finalSegments)
}
export async function findFirstExistingDirectory(
  directories: string[],
): Promise<string | undefined> {
  for (const directory of directories) {
    if (await FsUtilities.directoryExists(directory)) {
      return directory
    }
  }
}
