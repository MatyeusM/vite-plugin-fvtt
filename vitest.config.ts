import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { globals: true },
  resolve: { alias: { src: path.resolve(__dirname, './src') } },
})
