import path from 'path/posix'
import { LibraryFormats, LibraryOptions, UserConfig } from 'vite'
import { context } from 'src/context'
import logger from 'src/utils/logger'

export default function createPartialViteConfig(config: UserConfig): UserConfig {
  const base = config.base ?? `/${context.manifest?.manifestType}s/${context.manifest?.id}/`
  const useEsModules = context.manifest?.esmodules.length === 1
  const formats: LibraryFormats[] = useEsModules ? ['es'] : ['umd']

  const fileName =
    (useEsModules ? context.manifest?.esmodules[0] : context.manifest?.scripts?.[0]) ?? 'bundle'
  if (fileName === 'bundle')
    logger.warn('No output file specified in manifest, using default "bundle"')

  if (!context.manifest?.styles?.length) logger.warn('No CSS file found in manifest')
  const cssFileName = path.parse(context.manifest?.styles[0] ?? '').name

  const foundryPort = context.env?.foundryPort ?? 30000
  const foundryUrl = context.env?.foundryUrl ?? 'localhost'

  const entry = (config.build?.lib as LibraryOptions | undefined)?.entry
  if (!entry) logger.fail('Entry must be specified in lib')
  if (typeof entry !== 'string')
    logger.fail('Only a singular string entry is supported for build.lib.entry')

  return {
    base,
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
    build: {
      minify: 'esbuild',
      lib: { cssFileName, entry: entry as string, fileName, formats, name: context.manifest?.id },
    },
  }
}
