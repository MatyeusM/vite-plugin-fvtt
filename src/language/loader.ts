import { glob } from 'tinyglobby'
import path from 'path'
import { context, FoundryVTTManifest } from 'src/context'
import { languageTracker } from 'src/server/trackers/language-tracker'
import FsUtils from 'src/utils/fs-utils'
import Logger from 'src/utils/logger'
import PathUtils from 'src/utils/path-utils'

export async function getLocalLanguageFiles(
  lang: string,
  outDir: boolean = false,
): Promise<string[]> {
  const manifest = context.manifest as FoundryVTTManifest
  const language = manifest.languages.find(l => l.lang === lang)
  if (!language) Logger.fail(`Cannot find language "${lang}"`)
  const langPath = language?.path ?? ''
  if (outDir) {
    const languageFile = await PathUtils.getOutDirFile(langPath)
    return [languageFile]
  }
  const publicDirFile = await PathUtils.getPublicDirFile(langPath)
  if (publicDirFile !== '') {
    return [publicDirFile]
  }
  // get language files by checking a folder in the source directory
  const sourcePath = PathUtils.getLanguageSourcePath(langPath, lang)
  if (await FsUtils.dirExists(sourcePath))
    return await glob(path.join(sourcePath, '**/*.json'), { absolute: true })
  Logger.warn(`No language folder found at: ${sourcePath}`)
  return []
}

export default async function loadLanguage(
  lang: string,
  outDir: boolean = false,
): Promise<Map<string, any>> {
  const files = await getLocalLanguageFiles(lang, outDir)
  const result = new Map<string, any>()

  const reads = files.map(async file => {
    try {
      const json = await FsUtils.readJson(file)
      languageTracker.addFile(lang, file)
      return [file, json] as const
    } catch (e) {
      Logger.warn(e)
      return null
    }
  })

  const results = await Promise.all(reads)
  for (const entry of results) {
    if (entry) result.set(entry[0], entry[1])
  }

  return result
}
