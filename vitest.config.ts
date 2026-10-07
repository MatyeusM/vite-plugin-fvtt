import path from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    projects: [
      { test: { name: 'unit', exclude: [...configDefaults.exclude, 'tests/e2e/**', 'local/**'] } },
      {
        // One Foundry licence key: only a single instance may boot at a time, so the e2e files never
        // run concurrently. They start and stop their own instance, see tests/e2e/support.ts.
        test: { name: 'e2e', include: ['tests/e2e/**/*.test.ts'], fileParallelism: false },
      },
    ],
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
