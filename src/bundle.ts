import path from 'node:path'

import { glob } from 'tinyglobby'

import { context } from '@/context'
import loadLanguage, { getLocalLanguageFiles } from '@/language/loader'
import { transform } from '@/language/transformer'
import * as FsUtilities from '@/utils/fs-utilities'
import * as PathUtilities from '@/utils/path-utilities'

export interface PluginContext {
  emitFile: (file: { type: 'asset'; fileName: string; source: string }) => string
  addWatchFile: (id: string) => void
}

async function emitManifestAssets(pluginContext: PluginContext) {
  const manifestCandidates = ['system.json', 'module.json']

  await Promise.all(
    manifestCandidates.map(async file => {
      const source = path.resolve(file)
      const isPublic = await PathUtilities.getPublicDirectoryFile(file)
      if (!isPublic && (await FsUtilities.fileExists(source))) {
        pluginContext.addWatchFile(source)
        const manifest = await FsUtilities.readJson(source)
        pluginContext.emitFile({
          type: 'asset',
          fileName: file,
          source: JSON.stringify(manifest, undefined, 2),
        })
      }
    }),
  )
}

async function emitLanguageAssets(pluginContext: PluginContext) {
  const languages = context.manifest?.languages ?? []
  if (languages.length === 0) return

  await Promise.all(
    languages.map(async language => {
      const publicFile = await PathUtilities.getPublicDirectoryFile(language.path)
      if (publicFile) {
        // Complete files are copied by Vite itself; watch them so `build --watch` rebuilds too.
        pluginContext.addWatchFile(publicFile)
        return
      }
      const langFiles = await getLocalLanguageFiles(language.lang)
      for (const file of langFiles) {
        pluginContext.addWatchFile(file)
      }
      const languageDataRaw = await loadLanguage(language.lang)
      const languageData = transform(languageDataRaw)
      pluginContext.emitFile({
        type: 'asset',
        fileName: path.join(language.path),
        source: JSON.stringify(languageData, undefined, 2),
      })
    }),
  )
}

export async function generateBundle(pluginContext: PluginContext) {
  await Promise.all([
    emitManifestAssets(pluginContext),
    emitLanguageAssets(pluginContext),
    watchPublicTemplates(pluginContext),
  ])
}

/**
 * Templates are copied by Vite itself, so there is nothing to emit; watch them so
 * `build --watch` re-copies them into `dist/`, where Foundry's own hot reload picks them up.
 */
async function watchPublicTemplates(pluginContext: PluginContext) {
  const templates = await glob('**/*.hbs', {
    cwd: PathUtilities.getPublicDirectory(),
    absolute: true,
  })
  for (const file of templates) pluginContext.addWatchFile(file)
}
