import { ResolvedConfig } from 'vite'

export type FoundryVTTManifest = {
  manifestType: 'module' | 'system'
  id: string
  esmodules: string[]
  scripts: string[]
  styles: string[]
  languages: { lang: string; path: string }[]
  packs: { path: string }[]
}

export type ENVOptions = { foundryUrl: string; foundryPort: number }

export const context: { env?: ENVOptions; manifest?: FoundryVTTManifest; config?: ResolvedConfig } =
  {}
