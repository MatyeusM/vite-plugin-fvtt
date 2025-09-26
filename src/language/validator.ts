import { context, FoundryVTTManifest } from 'src/context'
import * as Logger from 'src/utils/logger'
import { flattenKeys } from './transformer'
import loadLanguage from './loader'

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

  for (const lang of manifest.languages) {
    if (lang.lang === 'en') continue // Skip the base language itself

    const currentLanguageData = await loadLanguage(lang.lang, true)
    const current = getFirstMapValueOrWarn(currentLanguageData, `Language "${lang.lang}"`)
    if (!current) continue
    const currentFlattened = flattenKeys(current)

    const missing = Object.keys(baseFlattened).filter(key => !(key in current))
    const extra = Object.keys(currentFlattened).filter(key => !(key in base))

    Logger.info(`Summary for language [${lang.lang}]:`)
    if (missing.length > 0) console.warn(`Missing keys: ${missing.length}`, missing.slice(0, 5))
    if (extra.length > 0) console.warn(`Extra keys: ${extra.length}`, extra.slice(0, 5))
    if (missing.length === 0 && extra.length === 0) console.log('\t✅ All keys match.')
  }
}
