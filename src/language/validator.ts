import { context, FoundryVTTManifest } from 'src/context'
import * as Logger from 'src/utils/logger'
import { flattenKeys } from './transformer'
import loadLanguage from './loader'

export default async function validator(): Promise<void> {
  const manifest = context.manifest as FoundryVTTManifest

  const baseLanguageData = await loadLanguage('en', true)
  if (baseLanguageData.size === 0) {
    Logger.error('Base language "en" not found or could not be loaded.')
    return
  }
  const base = flattenKeys(baseLanguageData.values().next().value)

  for (const lang of manifest.languages) {
    if (lang.lang === 'en') continue // Skip the base language itself

    const currentLanguageData = await loadLanguage(lang.lang, true)
    if (currentLanguageData.size === 0) {
      Logger.warn(`Summary for language [${lang.lang}]: Could not be loaded.`)
      continue
    }
    const current = flattenKeys(currentLanguageData.values().next().value)

    const missing = Object.keys(base).filter(key => !(key in current))
    const extra = Object.keys(current).filter(key => !(key in base))

    Logger.info(`Summary for language [${lang.lang}]:`)
    if (missing.length > 0) console.warn(`Missing keys: ${missing.length}`, missing.slice(0, 5))
    if (extra.length > 0) console.warn(`Extra keys: ${extra.length}`, extra.slice(0, 5))
    if (missing.length === 0 && extra.length === 0) console.log('\t✅ All keys match.')
  }
}
