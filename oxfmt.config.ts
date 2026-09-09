import { defineConfig } from 'oxfmt'

export default defineConfig({
  arrowParens: 'avoid',
  ignorePatterns: ['LICENSE', 'pnpm-lock.yaml'],
  objectWrap: 'collapse',
  proseWrap: 'always',
  semi: false,
  singleQuote: true,
  sortImports: true,
})
