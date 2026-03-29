import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strict,
  unicorn.configs.recommended,
  // @ts-expect-error SonarJS types (LegacyConfigObject) are incompatible with
  // defineConfig's strict InfiniteArray<ConfigWithExtends> expectation.
  // Common issue in 2026, waiting for upstream fix from SonarSource.
  sonarjs.configs.recommended,
  { ignores: ['dist/**'] },
)
