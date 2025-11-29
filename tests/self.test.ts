import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'tsdown'
import { describe, it, expect, afterEach } from 'vitest'
import tsdownConfig from '../tsdown.config'
import { generateTemporaryDirectory } from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

afterEach(async () => {
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true })
})

describe('Self-build Test', () => {
  it('should build itself and produce expected distribution entries', async () => {
    const outDirectory = path.resolve(TEMPORARY_TEST_DIRECTORY, 'dist')
    await fs.mkdir(outDirectory, { recursive: true })

    const tsdownModifiedConfig = { ...tsdownConfig, outDir: outDirectory }
    await build(tsdownModifiedConfig)

    expect(TEMPORARY_TEST_DIRECTORY).toHaveDistributionEntries()
  })
})
