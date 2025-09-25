import { LibraryFormats, UserConfig } from 'vite'
import { context } from 'src/context'
import Logger from 'src/utils/logger'

export default function createPartialViteConfig(config: UserConfig): UserConfig {
  const base = config.base ?? `/${context.manifest?.manifestType}s/${context.manifest?.id}/`
  const useEsModules = context.manifest?.esmodules.length === 1
  const formats: LibraryFormats[] = useEsModules ? ['es'] : ['umd']

  const fileName =
    (useEsModules ? context.manifest?.esmodules[0] : context.manifest?.scripts?.[0]) ??
    'scripts/bundle.js'
  if (!(useEsModules || context.manifest?.scripts?.[0]))
    Logger.warn(
      'No output file specified in manifest, using default "bundle" in the "scripts/" folder',
    )

  if (!context.manifest?.styles?.length) Logger.warn('No CSS file found in manifest')
  const cssFileName = context.manifest?.styles[0] ?? 'styles/bundle.css'
  if (!context.manifest?.styles[0])
    Logger.warn(
      'No output css file specified in manifest, using default "bundle" in the "styles/" folder',
    )

  const foundryPort = context.env?.foundryPort ?? 30000
  const foundryUrl = context.env?.foundryUrl ?? 'localhost'

  const lib = config.build?.lib
  if (!lib || typeof lib !== 'object') Logger.fail('This plugin needs a configured build.lib')

  const entry = lib.entry
  if (!entry) Logger.fail('Entry must be specified in lib')
  if (typeof entry !== 'string')
    Logger.fail('Only a singular string entry is supported for build.lib.entry')

  const isWatch = process.argv.includes('--watch') || !!config.build?.watch

  return {
    base,
    build: {
      emptyOutDir: config.build?.emptyOutDir ?? !isWatch,
      lib: { entry: entry, formats, name: context.manifest?.id ?? 'bundle', cssFileName: 'bundle' },
      minify: 'esbuild',
      rollupOptions: {
        output: {
          entryFileNames: fileName,
          assetFileNames: assetInfo => {
            const names = assetInfo.names ?? []
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
    esbuild: config.esbuild ?? {
      minifyIdentifiers: false,
      minifySyntax: true,
      minifyWhitespace: true,
      keepNames: true,
    },
    server: {
      port: foundryPort + 1,
      proxy: { [`^(?!${base})`]: `http://${foundryUrl}:${foundryPort}` },
    },
  }
}
