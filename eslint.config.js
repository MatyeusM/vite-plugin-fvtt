// @ts-check

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strict,
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  { ignores: ['dist/**'] },
)
