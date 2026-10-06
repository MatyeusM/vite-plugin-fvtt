import { defineConfig } from 'oxfmt'

export default defineConfig({
  arrowParens: 'avoid',
  ignorePatterns: ['LICENSE', 'pnpm-lock.yaml', 'local/**'],
  objectWrap: 'collapse',
  proseWrap: 'always',
  semi: false,
  singleQuote: true,
  sortImports: true,
})
