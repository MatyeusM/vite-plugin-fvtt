import { Plugin } from 'vite'
import { context } from './context'
import loadEnv from './config/env'
import loadManifest from './config/foundryvtt-manifest'
import createPartialViteConfig from './config/vite-options'

export default function foundryVTTPlugin(): Plugin {
  context.env = loadEnv()

  return {
    name: 'vite-plugin-foundryvtt',
    config(config) {
      context.manifest = loadManifest(config)
      return createPartialViteConfig(config)
    },
    configResolved(config) {
      context.config = config
    },
  }
}
