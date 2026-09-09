import { context, FoundryVTTManifest } from '@/context'
import * as Logger from '@/utils/logger'

import loadLanguage from './loader'
import { flattenKeys } from './transformer'

function getFirstMapValueOrWarn<T extends object>(
  map: Map<string, T>,
  contextDescription: string,
): T | undefined {
  if (map.size === 0) {
    Logger.warn(`${contextDescription} is empty.`)
    return undefined
  }
  const first = map.values().next().value
  if (!first) {
    Logger.warn(`${contextDescription} has no valid data.`)
    return undefined
  }
  return first
}

export default async function validator(): Promise<void> {
  const manifest = context.manifest as FoundryVTTManifest

  const baseLanguageData = await loadLanguage('en', true)
  const base = getFirstMapValueOrWarn(baseLanguageData, 'Base language "en"')
  if (!base) {
    Logger.error('Base language "en" not found or could not be loaded.')
    return
  }
  const baseFlattened = flattenKeys(base)

  const otherLanguages = manifest.languages.filter(lang => lang.lang !== 'en')
  const loadedLanguages = await Promise.all(
    otherLanguages.map(async lang => {
      const currentLanguageData = await loadLanguage(lang.lang, true)
      return {
        lang: lang.lang,
        current: getFirstMapValueOrWarn(currentLanguageData, `Language "${lang.lang}"`),
      }
    }),
  )

  for (const { lang, current } of loadedLanguages) {
    if (!current) continue
    const currentFlattened = flattenKeys(current)

    const missing = Object.keys(baseFlattened).filter(key => !Object.hasOwn(currentFlattened, key))
    const extra = Object.keys(currentFlattened).filter(key => !Object.hasOwn(baseFlattened, key))

    Logger.info(`Summary for language [${lang}]:`)
    if (missing.length > 0) console.warn(`Missing keys: ${missing.length}`, missing.slice(0, 5))
    if (extra.length > 0) console.warn(`Extra keys: ${extra.length}`, extra.slice(0, 5))
    if (missing.length === 0 && extra.length === 0) console.log('\t✅ All keys match.')
  }
}
