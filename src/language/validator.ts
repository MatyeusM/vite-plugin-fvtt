import path from 'path'
import fs from 'fs-extra'
import { context, FoundryVTTManifest } from 'src/context'
import { ResolvedConfig } from 'vite'
import logger from 'src/utils/logger'

function flattenKeys(obj: object, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenKeys(val, fullKey))
    } else {
      result[fullKey] = val
    }
  }
  return result
}

export default function validator(): void {
  const config = context.config as ResolvedConfig
  const manifest = context.manifest as FoundryVTTManifest

  const files = manifest.languages.map(lang => ({
    path: path.posix.join(config.root, config.build.outDir, lang.path),
    language: lang.lang,
  }))
  const baseLanguage = files.find(file => file.language === 'en') // foundry-vtt fallback language
  if (!baseLanguage) {
    logger.error('Base language "en" not found')
    return
  }

  const base = flattenKeys(fs.readJsonSync(baseLanguage.path))

  for (const file of files) {
    if (file.language === baseLanguage.language) continue

    const current = flattenKeys(fs.readJsonSync(file.path))
    const missing = Object.keys(base).filter(k => !(k in current))
    const extra = Object.keys(current).filter(k => !(k in base))

    console.log(`Summary for language [${file.language}]:`)
    if (missing.length) console.warn(`  Missing keys: ${missing.length}`, missing.slice(0, 5))
    if (extra.length) console.warn(`  Extra keys: ${extra.length}`, extra.slice(0, 5))
    if (!missing.length && !extra.length) console.log('  ✅ All keys match.')
  }
}
