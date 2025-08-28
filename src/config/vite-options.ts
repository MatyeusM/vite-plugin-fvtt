import path from 'path'
import { LibraryFormats, LibraryOptions, UserConfig } from 'vite'
import { context } from 'src/context'

export default function createPartialViteConfig(config: UserConfig): UserConfig {
  const base = config.base ?? `/${context.manifest?.manifestType}s/${context.manifest?.id}/`
  const useEsModules = context.manifest?.esmodules.length === 1
  const formats: LibraryFormats[] = useEsModules ? ['es'] : ['umd']

  const fileName = (format: string) => {
    if (format === 'es') {
      return context.manifest?.esmodules[0] ?? ''
    }
    if (format === 'umd') {
      return context.manifest?.scripts?.[0] ?? ''
    }
    throw new Error('No valid output target found in manifest.')
  }

  const cssFileName = path.parse(context.manifest?.styles[0] ?? '').name

  const foundryPort = context.env?.foundryPort ?? 30000
  const foundryUrl = context.env?.foundryUrl ?? 'localhost'

  const entry = (config.build?.lib as LibraryOptions | undefined)?.entry
  if (!entry) throw Error('Entry must be specified in lib')

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
      lib: { cssFileName, entry, fileName, formats, name: context.manifest?.id },
    },
  }
}
