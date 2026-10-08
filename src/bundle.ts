import fs from 'node:fs/promises'
import path from 'node:path'

import { type OutputAsset, type OutputBundle, type OutputChunk } from 'rolldown'
import { glob } from 'tinyglobby'

import { context, type OverwriteKind } from '@/context'
import loadLanguage, { getLocalLanguageFiles } from '@/language/loader'
import { transform } from '@/language/transformer'
import * as FsUtilities from '@/utils/fs-utilities'
import * as Logger from '@/utils/logger'
import { forcedCssFileName, forcedEntryFileName } from '@/utils/path-utilities'
import * as PathUtilities from '@/utils/path-utilities'

export interface PluginContext {
  emitFile: (file: { type: 'asset'; fileName: string; source: string }) => string
  addWatchFile: (id: string) => void
}

async function emitManifestAssets(pluginContext: PluginContext, bundle: OutputBundle) {
  const manifestCandidates = ['system.json', 'module.json']

  await Promise.all(
    manifestCandidates.map(async file => {
      const source = path.resolve(file)
      const isPublic = await PathUtilities.getPublicDirectoryFile(file)
      if (!isPublic && (await FsUtilities.fileExists(source))) {
        pluginContext.addWatchFile(source)
        const manifest = await FsUtilities.readJson<Record<string, unknown>>(source)
        if (!manifest) return
        const watch = PathUtilities.isWatchBuild()
        syncHotReloadFlags(
          manifest,
          watch,
          watch ? [...(await listPublicTemplateDirs()), ...localeDirs()] : [],
        )
        if (context.overwrite?.size) rewriteManifestLists(bundle, manifest)
        pluginContext.emitFile({
          type: 'asset',
          fileName: file,
          source: JSON.stringify(manifest, undefined, 2),
        })
      }
    }),
  )
}

/** Point the manifest at the final emissions; the lone-file renames land on disk in writeBundle. */
function rewriteManifestLists(bundle: OutputBundle, manifest: Record<string, unknown>): void {
  const overwrite = context.overwrite ?? new Set<OverwriteKind>()
  if (overwrite.has('js')) {
    const chunks = Object.values(bundle).filter(
      (output): output is OutputChunk => output.type === 'chunk',
    )
    const jsKey =
      Array.isArray(manifest.esmodules) && manifest.esmodules.length > 0 ? 'esmodules' : 'scripts'
    manifest[jsKey] = chunks.length === 1 ? [forcedEntryFileName()] : entryFileNames(bundle)
  }
  if (overwrite.has('css')) {
    const cssFiles = Object.values(bundle)
      .filter((output): output is OutputAsset => output.type === 'asset')
      .map(asset => asset.fileName)
      .filter(file => file.endsWith('.css'))
    if (cssFiles.length === 1) return
    if (cssFiles.length > 1) {
      const dynamicCss = collectImportedCss(bundle)
      manifest.styles = cssFiles.filter(file => !dynamicCss.has(file)).toSorted()
    }
  }
}

/**
 * Collapse lone Vite-named outputs back to their manifest names on disk; the manifest already
 * lists those names. Multi-file outputs keep their Vite names and are listed as emitted.
 */
export async function collapseLoneOutputs(bundle: OutputBundle): Promise<void> {
  const overwrite = context.overwrite ?? new Set<OverwriteKind>()
  if (overwrite.size === 0) return
  const chunks = Object.values(bundle).filter(
    (output): output is OutputChunk => output.type === 'chunk',
  )
  const outDir = PathUtilities.getOutDirectory()
  if (overwrite.has('js') && chunks.length === 1) {
    const entry = chunks.find(chunk => chunk.isEntry && !chunk.isDynamicEntry)
    if (entry) await renameDistFile(outDir, entry.fileName, forcedEntryFileName())
  }
  if (overwrite.has('css')) {
    const cssFiles = Object.values(bundle)
      .filter((output): output is OutputAsset => output.type === 'asset')
      .map(asset => asset.fileName)
      .filter(file => file.endsWith('.css'))
    if (cssFiles.length === 1) await renameDistFile(outDir, cssFiles[0], forcedCssFileName())
  }
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

export async function generateBundle(pluginContext: PluginContext, bundle: OutputBundle) {
  await Promise.all([
    emitManifestAssets(pluginContext, bundle),
    emitLanguageAssets(pluginContext),
    watchPublicTemplates(pluginContext),
  ])
}

/** Build output ships without dev flags; watch builds gain them when the author set none. */
export function syncHotReloadFlags(
  manifest: Record<string, unknown>,
  watch: boolean,
  contentDirs: string[] = [],
): void {
  const rawFlags = manifest.flags
  const flags =
    typeof rawFlags === 'object' && rawFlags !== null ? (rawFlags as Record<string, unknown>) : {}
  if (watch) {
    if (flags.hotReload) return
    manifest.flags = {
      ...flags,
      hotReload: { extensions: ['css', 'hbs', 'html', 'json'], paths: minimalRoots(contentDirs) },
    }
  } else if (flags.hotReload) {
    delete flags.hotReload
    manifest.flags = flags
  }
}

/** Language directories come straight from the manifest. */
function localeDirs(): string[] {
  return (context.manifest?.languages ?? []).map(language =>
    normalizeDir(path.dirname(language.path)),
  )
}

/** Template directories come from the public files that land in dist unchanged. */
async function listPublicTemplateDirs(): Promise<string[]> {
  const publicDir = PathUtilities.getPublicDirectory()
  const templates = await glob('**/*.hbs', { cwd: publicDir })
  return templates.map(file => normalizeDir(path.dirname(file)))
}

function normalizeDir(dir: string): string {
  return dir === '.' ? '' : dir
}

/** Drop directories already covered by another; chokidar watches recursively. */
export function minimalRoots(dirs: string[]): string[] {
  const unique = [...new Set(dirs)]
  if (unique.includes('')) return ['']
  return unique
    .filter(dir => !unique.some(other => other !== dir && dir.startsWith(`${other}/`)))
    .toSorted()
}

/** The manifest lives in "public/" (copied verbatim) when overwrite needs the project root. */
export async function assertOverwriteManifest(): Promise<void> {
  if (!context.overwrite?.size) return
  const name = context.manifest?.manifestType === 'module' ? 'module.json' : 'system.json'
  const rootExists = await FsUtilities.fileExists(path.resolve(name))
  const publicTwin = await PathUtilities.getPublicDirectoryFile(name)
  if (!rootExists || publicTwin)
    Logger.fail(
      `The "overwrite" option requires ${name} in the project root, so the plugin can rewrite it; manifests in "public/" are copied verbatim and cannot be rewritten.`,
    )
}

/**
 * Only entry chunks are listed; dynamically imported children load themselves, as does their css.
 * Reads viteMetadata, which Vite populates during generateBundle but strips afterwards.
 */
export function entryFileNames(bundle: OutputBundle): string[] {
  const entries = Object.values(bundle)
    .filter((output): output is OutputChunk => output.type === 'chunk')
    .filter(chunk => chunk.isEntry && !chunk.isDynamicEntry)
  if (entries.length === 0)
    Logger.fail('The "overwrite" option found no entry chunk to list in the manifest.')
  return entries.map(chunk => chunk.fileName)
}

/** CSS pulled in by dynamically imported chunks loads itself; it must not be listed. */
function collectImportedCss(bundle: OutputBundle): Set<string> {
  const css = new Set<string>()
  const seen = new Set<string>()
  const stack = Object.values(bundle)
    .filter((output): output is OutputChunk => output.type === 'chunk')
    .filter(chunk => chunk.isDynamicEntry)
    .map(chunk => chunk.fileName)
  while (stack.length > 0) {
    const key = stack.pop() as string
    if (seen.has(key)) continue
    seen.add(key)
    const output = bundle[key]
    if (!output || output.type !== 'chunk') continue
    for (const file of importedCssOf(output)) css.add(file)
    stack.push(...output.imports)
  }
  return css
}

function importedCssOf(chunk: OutputChunk): Set<string> {
  const metadata = chunk as { viteMetadata?: { importedCss?: Set<string> } }
  return metadata.viteMetadata?.importedCss ?? new Set()
}

async function renameDistFile(outDir: string, from: string, to: string): Promise<void> {
  if (from === to) return
  const fromPath = path.join(outDir, from)
  const toPath = path.join(outDir, to)
  await fs.mkdir(path.dirname(toPath), { recursive: true })
  await fs.rename(fromPath, toPath)
  const text = await fs.readFile(toPath, 'utf8')
  await fs.writeFile(
    toPath,
    text.replaceAll(
      `sourceMappingURL=${path.basename(from)}.map`,
      `sourceMappingURL=${path.basename(to)}.map`,
    ),
  )
  const fromMap = `${fromPath}.map`
  const toMap = `${toPath}.map`
  if (!(await FsUtilities.fileExists(fromMap))) return
  await fs.rename(fromMap, toMap)
  const mapJson = JSON.parse(await fs.readFile(toMap, 'utf8')) as { file?: string }
  mapJson.file = to
  await fs.writeFile(toMap, JSON.stringify(mapJson))
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
