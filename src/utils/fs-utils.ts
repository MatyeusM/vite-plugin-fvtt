import fs from 'fs/promises'
import { Stats } from 'fs'

async function checkType(p: string, check: (stats: Stats) => boolean): Promise<boolean> {
  try {
    const stats = await fs.stat(p)
    return check(stats)
  } catch {
    return false
  }
}

export async function fileExists(p: string): Promise<boolean> {
  return checkType(p, s => s.isFile())
}

export async function dirExists(p: string): Promise<boolean> {
  return checkType(p, s => s.isDirectory())
}

export async function readFile(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
): Promise<string> {
  return fs.readFile(filePath, { encoding })
}

export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath)
    return JSON.parse(content) as T
  } catch {
    return null
  }
}
