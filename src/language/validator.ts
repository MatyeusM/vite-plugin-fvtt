import { context, FoundryVTTManifest } from 'src/context'
import logger from 'src/utils/logger'
import { flattenKeys } from './transformer'
import loadLanguage from './loader'

export default function validator(): void {
  const manifest = context.manifest as FoundryVTTManifest

  const baseLanguageData = loadLanguage('en', true)
  if (baseLanguageData.size === 0) {
    logger.error('Base language "en" not found or could not be loaded.')
    return
  }
  const base = flattenKeys(baseLanguageData.values().next().value)

  for (const lang of manifest.languages) {
    if (lang.lang === 'en') continue // Skip the base language itself

    const currentLanguageData = loadLanguage(lang.lang, true)
    if (currentLanguageData.size === 0) {
      console.warn(`Summary for language [${lang.lang}]: Could not be loaded.`)
      continue
    }
    const current = flattenKeys(currentLanguageData.values().next().value)

    const missing = Object.keys(base).filter(key => !(key in current))
    const extra = Object.keys(current).filter(key => !(key in base))

    console.log(`Summary for language [${lang.lang}]:`)
    if (missing.length) console.warn(`\tMissing keys: ${missing.length}`, missing.slice(0, 5))
    if (extra.length) console.warn(`\tExtra keys: ${extra.length}`, extra.slice(0, 5))
    if (!missing.length && !extra.length) console.log('\t✅ All keys match.')
  }
}
