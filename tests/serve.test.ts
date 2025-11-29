import fs from 'node:fs/promises'
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
  generateTemporaryDirectory,
} from './test-utilities'

const TEMPORARY_TEST_DIRECTORY = generateTemporaryDirectory()

let server: ViteDevServer | undefined

beforeEach(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(TEMPORARY_TEST_DIRECTORY)
  const files = { ...JS, ...CSS, ...LANGUAGE }
  await createTestFiles(TEMPORARY_TEST_DIRECTORY, files)
  await writeManifest(MANIFEST, TEMPORARY_TEST_DIRECTORY, true)
  server = await createTestServer(VITE_CONFIG)
})

afterEach(async () => {
  if (server) await stopTestServer(server)
  await fs.rm(TEMPORARY_TEST_DIRECTORY, { recursive: true })
  vi.restoreAllMocks()
})

function getBaseUrl(isSystem: boolean): string {
  const type = isSystem ? 'systems' : 'modules'
  return `/${type}/${MANIFEST.id}`
}

describe('Vite Plugin Dev Server - System Manifest', () => {
  const baseUrl = getBaseUrl(true)

  it('Should serve the ES module with HMR injections', async () => {
    const jsUrl = `${baseUrl}/${MANIFEST.esmodules[0]}`
    const response = await fetchFromDevelopmentServer(jsUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('javascript')
    expect(response.text).toContain('import.meta.hot')
    expect(response.text).toContain('foundryvtt-template-update')
    expect(response.text).toContain('foundryvtt-language-update')
  })

  it('Should serve the CSS stylesheet as expected (only comments/empty)', async () => {
    const cssUrl = `${baseUrl}/${MANIFEST.styles[0]}`
    const response = await fetchFromDevelopmentServer(cssUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
    expect(isOnlyCssComments(response.text)).toBe(true)
  })

  describe('Language File Serving and Merging', () => {
    it('Should serve the reference language (en) correctly', async () => {
      const enUrl = `${baseUrl}/i18n/en.json`
      const response = await fetchFromDevelopmentServer(enUrl)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('json')

      const enData = JSON.parse(response.text)
      expect(enData).toEqual({ hello: 'Hello', world: 'World!' })
    })

    it('Should serve and merge a secondary language (de) and contain all reference keys', async () => {
      const deUrl = `${baseUrl}/i18n/de.json`
      const response = await fetchFromDevelopmentServer(deUrl)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('json')

      const deData = JSON.parse(response.text)
      const expectedDeData = { hello: 'Hallo', world: 'Welt!' } // From fixture-data

      expect(deData).toEqual(expectedDeData)
      const enUrl = `${baseUrl}/i18n/en.json`
      const enResponse = await fetchFromDevelopmentServer(enUrl)
      const enData = JSON.parse(enResponse.text)

      for (const key of Object.keys(enData)) {
        expect(deData).toHaveProperty(key)
      }
    })
  })
})
