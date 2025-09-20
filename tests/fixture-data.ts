import { defineConfig } from 'vite'
import foundryVTT from '../src/index'

export const MANIFEST = {
  id: 'test-id',
  esmodules: ['scripts/index.js'],
  styles: ['styles/test.css'],
  languages: [
    { path: 'i18n/en.json', lang: 'en' },
    { path: 'i18n/de.json', lang: 'de' },
  ],
}

export const LANGUAGE = {
  'public/i18n/en.json': JSON.stringify({ hello: 'Hello', world: 'World!' }),
  'src/i18n/de/hallo.json': JSON.stringify({ hello: 'Hallo' }),
  'src/i18n/de/ordner/welt.json': JSON.stringify({ world: 'Welt!' }),
}

export const CSS = { 'src/main.css': 'body { color: red; }' }
export const JS = { 'src/main.js': 'import "./main.css";\nconsole.log("Hello");' }

export const VITE_CONFIG = defineConfig({
  plugins: [foundryVTT()],
  build: { lib: { entry: './src/main.js' }, sourcemap: true },
})
