import fs from 'fs/promises'
import { Stats } from 'fs'

class FsUtils {
  private static async checkType(p: string, check: (stats: Stats) => boolean): Promise<boolean> {
    try {
      const stats = await fs.stat(p)
      return check(stats)
    } catch {
      return false
    }
  }

  static async fileExists(p: string): Promise<boolean> {
    return FsUtils.checkType(p, s => s.isFile())
  }

  static async dirExists(p: string): Promise<boolean> {
    return FsUtils.checkType(p, s => s.isDirectory())
  }

  static async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.readFile(filePath, { encoding })
  }

  static async readJson<T = unknown>(filePath: string): Promise<T | null> {
    try {
      const content = await FsUtils.readFile(filePath)
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }
}

export default FsUtils
