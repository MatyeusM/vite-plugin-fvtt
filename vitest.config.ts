import path from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // local/ holds gitignored Foundry test systems whose own *.spec.ts files are not ours.
    exclude: [...configDefaults.exclude, 'local/**'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
