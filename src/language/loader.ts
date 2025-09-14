import fs from 'fs-extra'
import { globSync } from 'tinyglobby'
import path from 'path'
import { context, FoundryVTTManifest } from 'src/context'
import { languageTracker } from 'src/server/trackers/language-tracker'
import Logger from 'src/utils/logger'
import PathUtils from 'src/utils/path-utils'

export function getLocalLanguageFiles(lang: string, outDir: boolean = false): string[] {
  const manifest = context.manifest as FoundryVTTManifest
  const language = manifest.languages.find(l => l.lang === lang)
  if (!language) Logger.fail(`Cannot find language "${lang}"`)
  const langPath = language?.path ?? ''
  if (outDir) {
    const languageFile = PathUtils.getOutDirFile(langPath)
    return [languageFile]
  }
  const publicDirFile = PathUtils.getPublicDirFile(langPath)
  if (publicDirFile !== '') {
    return [publicDirFile]
  }
  // get language files by checking a folder in the source directory
  const sourcePath = PathUtils.getLanguageSourcePath(langPath, lang)
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    Logger.warn(`No language folder found at: ${sourcePath}`)
    return []
  }
  return globSync(path.join(sourcePath, '**/*.json'))
}

export default function loadLanguage(lang: string, outDir: boolean = false): Map<string, any> {
  const files = getLocalLanguageFiles(lang, outDir)
  const result = new Map<string, any>()
  for (const file of files) {
    try {
      result.set(file, fs.readJSONSync(file))
      languageTracker.addFile(lang, file)
    } catch (e) {
      Logger.warn(e)
    }
  }
  return result
}
