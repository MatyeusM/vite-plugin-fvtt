import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'tsdown'
import { describe, it, expect } from 'vitest'
import tsdownConfig from '../tsdown.config'
import packageJson from '../package.json' assert { type: 'json' }

const TEST_OUT_DIR = path.resolve(__dirname, `.tmp-self-${Date.now()}`)

describe('Self-build test', () => {
  it('should build itself and produce expected entries', async () => {
    const outDirectory = path.resolve(TEST_OUT_DIR, 'dist')
    await fs.mkdir(outDirectory, { recursive: true })

    const tsdownModifiedConfig = { ...tsdownConfig, outDir: outDirectory }
    await build(tsdownModifiedConfig)

    await expect(fs.access(path.join(TEST_OUT_DIR, packageJson.main))).resolves.not.toThrow()
    await expect(fs.access(path.join(TEST_OUT_DIR, packageJson.types))).resolves.not.toThrow()

    await fs.rm(TEST_OUT_DIR, { recursive: true })
  })
})
