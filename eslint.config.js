// @ts-check

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strict,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  { ignores: ['dist/**'] },
)
