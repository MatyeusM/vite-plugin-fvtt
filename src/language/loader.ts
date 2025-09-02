import fs from 'fs-extra'
import { globSync } from 'tinyglobby'
import posix from 'path/posix'
import { context, FoundryVTTManifest } from 'src/context'
import { languageTracker } from 'src/server/trackers/language-tracker'
import logger from 'src/utils/logger'
import path from 'src/utils/path-utils'

function getLocalLanguageFiles(lang: string, outDir: boolean = false): string[] {
  const manifest = context.manifest as FoundryVTTManifest
  const language = manifest.languages.find(l => l.lang === lang)
  if (!language) logger.fail(`Cannot find language "${lang}"`)
  const langPath = language?.path ?? ''
  if (outDir) {
    const languageFile = path.getOutDirFile(langPath)
    return [languageFile]
  }
  const publicDirFile = path.getPublicDirFile(langPath)
  if (publicDirFile !== '') {
    return [publicDirFile]
  }
  // get language files by checking a folder in the source directory
  const sourcePath = path.getLanguageSourcePath(langPath, lang)
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    logger.warn(`No language folder found at: ${sourcePath}`)
    return []
  }
  return globSync(posix.join(sourcePath, '**/*.json'))
}

export default function loadLanguage(lang: string, outDir: boolean = false): Map<string, any> {
  const files = getLocalLanguageFiles(lang, outDir)
  const result = new Map<string, any>()
  for (const file of files) {
    try {
      result.set(file, fs.readJSONSync(file))
      languageTracker.addFile(lang, file)
    } catch (e) {
      logger.warn(e)
    }
  }
  return result
}
