import fs from 'node:fs/promises'
import path from 'node:path'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ViteDevServer } from 'vite'
import { MANIFEST, JS, CSS, LANGUAGE, VITE_CONFIG } from './fixture-data'
import {
  createTestFiles,
  createTestServer,
  stopTestServer,
  fetchFromDevelopmentServer,
  writeManifest,
  isOnlyCssComments,
} from './test-utilities'

const TEST_DIR = path.resolve(__dirname, `.tmp-serve-${Date.now().toString()}`)

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR)
  const files = { ...JS, ...CSS, ...LANGUAGE }
  await createTestFiles(TEST_DIR, files)
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true })
  vi.restoreAllMocks()
})

function getBaseUrl(isSystem: boolean): string {
  const type = isSystem ? 'systems' : 'modules'
  return `/${type}/${MANIFEST.id}`
}

// starting the dev server leads to improper caching, can only test
// either using a system manifest or a module manifest
describe('Vite Plugin Dev Server - System Manifest', () => {
  let server: ViteDevServer | undefined

  it('Should serve all data from vite', async () => {
    await writeManifest(MANIFEST, TEST_DIR)
    server = await createTestServer(VITE_CONFIG)
    const baseUrl = getBaseUrl(true)

    // Deal with js
    const jsUrl = `${baseUrl}/${MANIFEST.esmodules[0]}`

    const response = await fetchFromDevelopmentServer(jsUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('javascript')

    // Verify HMR client code is injected
    expect(response.text).toContain('import.meta.hot')
    expect(response.text).toContain('foundryvtt-template-update')
    expect(response.text).toContain('foundryvtt-language-update')

    // Deal with CSS
    const cssUrl = `${baseUrl}/${MANIFEST.styles[0]}`
    console.log(cssUrl)
    const cssResponse = await fetchFromDevelopmentServer(cssUrl)
    expect(cssResponse.status).toBe(200)
    expect(cssResponse.headers.get('content-type')).toContain('text/css')
    expect(isOnlyCssComments(cssResponse.text)).toBe(true)

    // Deal with languages
    const enUrl = `${baseUrl}/i18n/en.json`
    const enResponse = await fetchFromDevelopmentServer(enUrl)

    expect(enResponse.status).toBe(200)
    expect(enResponse.headers.get('content-type')).toContain('json')

    const enData = JSON.parse(enResponse.text)
    expect(enData).toHaveProperty('hello', 'Hello')
    expect(enData).toHaveProperty('world', 'World!')

    // Test German language file
    const deUrl = `${baseUrl}/i18n/de.json`
    const deResponse = await fetchFromDevelopmentServer(deUrl)

    expect(deResponse.status).toBe(200)
    expect(deResponse.headers.get('content-type')).toContain('json')

    const deData = JSON.parse(deResponse.text)
    expect(deData).toHaveProperty('hello', 'Hallo')
    expect(deData).toHaveProperty('world', 'Welt!')

    // Ensure German has all English keys
    for (const key of Object.keys(enData)) {
      expect(deData).toHaveProperty(key)
    }

    await stopTestServer(server)
  })
})
