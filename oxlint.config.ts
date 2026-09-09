import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'promise', 'vitest'],
  categories: { correctness: 'error', suspicious: 'error', pedantic: 'error', perf: 'error' },
  env: { node: true, builtin: true, es2026: true },
  ignorePatterns: ['dist/**'],
})
