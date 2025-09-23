import path from 'path'
import { LibraryOptions, ResolvedConfig } from 'vite'
import { context } from 'src/context'
import Logger from './logger'
import FsUtils from './fs-utils'

class PathUtils {
  private static _config: ResolvedConfig | null = null
  private static _sourceDirectory: string | null = null
  private static _decodedBase: string | null = null
  private static _publicDir: string | null = null
  private static _outDir: string | null = null
  private static _root: string | null = null

  private static getConfig(): ResolvedConfig {
    if (!PathUtils._config) {
      const config = context.config
      if (!config) Logger.fail('Path utils can only be called after vite has resolved the config')
      PathUtils._config = config as ResolvedConfig
    }
    return PathUtils._config
  }

  public static getDecodedBase(): string {
    if (!PathUtils._decodedBase) {
      const config = PathUtils.getConfig()
      PathUtils._decodedBase = path.posix.normalize(decodeURI(config.base))
    }
    return PathUtils._decodedBase
  }

  public static getSourceDirectory(): string {
    if (!PathUtils._sourceDirectory) {
      const config = PathUtils.getConfig()
      const normalizedEntry = path.normalize((config.build.lib as LibraryOptions).entry.toString())
      const segments = normalizedEntry
        .split(path.sep)
        .filter(Boolean)
        .filter(s => s !== '.')
      const firstFolder = segments.length > 0 ? segments[0] : '.'
      PathUtils._sourceDirectory = path.join(config.root, firstFolder)
    }
    return PathUtils._sourceDirectory
  }

  public static getPublicDir(): string {
    if (!PathUtils._publicDir) {
      const config = PathUtils.getConfig()
      PathUtils._publicDir = path.resolve(config.publicDir)
    }
    return PathUtils._publicDir
  }

  public static getOutDir(): string {
    if (!PathUtils._outDir) {
      const config = PathUtils.getConfig()
      PathUtils._outDir = path.resolve(config.build.outDir)
    }
    return PathUtils._outDir
  }

  public static getRoot(): string {
    if (!PathUtils._root) {
      const config = PathUtils.getConfig()
      PathUtils._root = path.resolve(config.root)
    }
    return PathUtils._root
  }

  public static async getOutDirFile(p: string): Promise<string> {
    const file = path.join(PathUtils.getOutDir(), p)
    return (await FsUtils.fileExists(file)) ? file : ''
  }

  public static async getPublicDirFile(p: string): Promise<string> {
    const file = path.join(PathUtils.getPublicDir(), p)
    return (await FsUtils.fileExists(file)) ? file : ''
  }

  private static async findLocalFilePath(p: string): Promise<string | null> {
    const fileCandidates = [
      PathUtils.getPublicDir(),
      PathUtils.getSourceDirectory(),
      PathUtils.getRoot(),
    ].map(pth => path.join(pth, p))

    const exists = await Promise.all(fileCandidates.map(FsUtils.fileExists))
    const idx = exists.findIndex(Boolean)
    return idx !== -1 ? fileCandidates[idx] : null
  }

  public static isFoundryVTTUrl(p: string): boolean {
    const decodedBase = PathUtils.getDecodedBase()
    const pathToCheck = path.posix.normalize(p)
    return pathToCheck.startsWith(decodedBase)
  }

  public static async foundryVTTUrlToLocal(p: string): Promise<string | null> {
    const decodedBase = PathUtils.getDecodedBase()
    let pathToTransform = path.posix.normalize('/' + p)
    if (!pathToTransform.startsWith(decodedBase)) return null
    pathToTransform = path.relative(decodedBase, pathToTransform)
    return PathUtils.findLocalFilePath(pathToTransform)
  }

  public static localToFoundryVTTUrl(p: string): string {
    const decodedBase = PathUtils.getDecodedBase()
    let pathToTransform = path.normalize(p)
    ;[PathUtils.getPublicDir(), PathUtils.getSourceDirectory(), PathUtils.getRoot()].forEach(
      pth => {
        if (pathToTransform.startsWith(pth)) {
          pathToTransform = pathToTransform.slice(pth.length)
        }
      },
    )
    return path.join(decodedBase, pathToTransform)
  }

  public static getLanguageSourcePath(p: string, lang: string): string {
    const dir = path.parse(p).dir
    const lastDirName = path.basename(dir)
    const finalSegments = lastDirName === lang ? dir : path.join(dir, lang)
    return path.join(PathUtils.getSourceDirectory(), finalSegments)
  }
}

export default PathUtils
