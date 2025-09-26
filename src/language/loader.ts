import { glob } from 'tinyglobby'
import path from 'node:path'
import { context, FoundryVTTManifest } from 'src/context'
import { languageTracker } from 'src/server/trackers/language-tracker'
import * as FsUtils from 'src/utils/fs-utilities'
import * as Logger from 'src/utils/logger'
import * as PathUtils from 'src/utils/path-utilities'

export async function getLocalLanguageFiles(
  lang: string,
  inOutDirectory: boolean = false,
): Promise<string[]> {
  const manifest = context.manifest as FoundryVTTManifest
  const language = manifest.languages.find(l => l.lang === lang)
  if (!language) Logger.fail(`Cannot find language "${lang}"`)
  const langPath = language?.path ?? ''
  if (inOutDirectory) {
    const languageFile = await PathUtils.getOutDirectoryFile(langPath)
    return [languageFile]
  }
  const publicDirectoryFile = await PathUtils.getPublicDirectoryFile(langPath)
  if (publicDirectoryFile !== '') {
    return [publicDirectoryFile]
  }
  // get language files by checking a folder in the source directory
  const sourcePath = PathUtils.getLanguageSourcePath(langPath, lang)
  if (await FsUtils.directoryExists(sourcePath))
    return await glob(path.join(sourcePath, '**/*.json'), { absolute: true })
  Logger.warn(`No language folder found at: ${sourcePath}`)
  return []
}

export default async function loadLanguage(
  lang: string,
  inOutDirectory: boolean = false,
): Promise<Map<string, unknown>> {
  const files = await getLocalLanguageFiles(lang, inOutDirectory)
  const result = new Map<string, unknown>()

  const reads = files.map(async file => {
    try {
      const json = await FsUtils.readJson(file)
      languageTracker.addFile(lang, file)
      return [file, json] as const
    } catch (error) {
      Logger.warn(error)
      return
    }
  })

  const results = await Promise.all(reads)
  for (const entry of results) {
    if (entry) result.set(entry[0], entry[1])
  }

  return result
}
