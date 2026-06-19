import { LibraryFormats, UserConfig, version, mergeConfig } from 'vite'
import { type PreRenderedAsset } from 'rolldown'
import { context } from '@/context'
import * as Logger from '@/utils/logger'

function getViteMajorVersion() {
  try {
    return Number(version.split('.', 1)[0])
  } catch {
    return 8 // fallback to newest
  }
}

const oxcMinifyOptions: Partial<UserConfig> = {
  build: {
    minify: 'oxc',
    rollupOptions: { output: { minify: { compress: true, mangle: false } } },
  },
}

const esbuildMinifyOptions = (config: UserConfig): Partial<UserConfig> => ({
  build: { minify: 'esbuild' },
  esbuild: config.esbuild ?? {
    minifyIdentifiers: false,
    minifySyntax: true,
    minifyWhitespace: true,
    keepNames: true,
  },
})

export default function createPartialViteConfig(config: UserConfig): UserConfig {
  const base = config.base ?? `/${context.manifest?.manifestType}s/${context.manifest?.id}/`
  const isUseEsModules = context.manifest?.esmodules.length === 1
  const formats: LibraryFormats[] = isUseEsModules ? ['es'] : ['umd']
  const isVite8OrAbove = getViteMajorVersion() >= 8

  const fileName =
    (isUseEsModules ? context.manifest?.esmodules[0] : context.manifest?.scripts?.[0]) ??
    'scripts/bundle.js'
  if (!(isUseEsModules || context.manifest?.scripts?.[0]))
    Logger.warn(
      'No output file specified in manifest, using default "bundle" in the "scripts/" folder',
    )

  if (!context.manifest?.styles?.length) Logger.warn('No CSS file found in manifest')
  const cssFileName = context.manifest?.styles[0] ?? 'styles/bundle.css'
  if (!context.manifest?.styles[0])
    Logger.warn(
      'No output css file specified in manifest, using default "bundle" in the "styles/" folder',
    )

  const foundryPort = context.env?.foundryPort ?? 30_000
  const foundryUrl = context.env?.foundryUrl ?? 'localhost'

  const library = config.build?.lib
  if (!library || typeof library !== 'object')
    Logger.fail('This plugin needs a configured build.lib')

  const entry = library.entry
  if (!entry) Logger.fail('Entry must be specified in lib')
  if (typeof entry !== 'string')
    Logger.fail('Only a singular string entry is supported for build.lib.entry')

  const isWatch = process.argv.includes('--watch') || !!config.build?.watch

  return mergeConfig(
    {
      base,
      build: {
        emptyOutDir: config.build?.emptyOutDir ?? !isWatch,
        // cssFileName should not be a path, so we use 'bundle' as default here, but we overwrite it in assets.
        lib: {
          entry: entry,
          formats,
          name: context.manifest?.id ?? 'bundle',
          cssFileName: 'bundle',
        },
        rollupOptions: {
          output: {
            entryFileNames: fileName,
            assetFileNames: (assetInfo: PreRenderedAsset) => {
              const names: string[] = assetInfo.names ?? []
              if (names.some(n => n.endsWith('.css'))) {
                return cssFileName
              }
              return '[name][extname]'
            },
          },
        },
      },
      define: {
        __FVTT_PLUGIN__: {
          id: context.manifest?.id,
          isSystem: context.manifest?.manifestType === 'system',
        },
      },
      server: {
        port: foundryPort + 1,
        proxy: { [`^(?!${base})`]: `http://${foundryUrl}:${foundryPort}` },
      },
    },
    isVite8OrAbove ? oxcMinifyOptions : esbuildMinifyOptions(config),
  )
}
