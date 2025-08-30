// abstract-file-tracker.ts
import path from 'path/posix'
import logger from 'src/utils/logger'
import { FSWatcher, ResolvedConfig, ViteDevServer } from 'vite'

interface FileUpdateEvent {
  type: 'custom'
  event: string
  data?: object
}

export abstract class AbstractFileTracker<T> {
  private initialized = false
  private tracked = new Map<string, T>()
  private watcher: FSWatcher | null = null
  protected readonly config: ResolvedConfig
  protected abstract readonly updateEvent: string

  constructor(config: ResolvedConfig) {
    this.config = config
  }

  protected abstract getEventData(filePath: string, value: T): object

  initialize(server: ViteDevServer) {
    if (this.initialized) return
    this.initialized = true
    this.watcher = server.watcher

    this.watcher.on('change', changedPath => {
      const value = this.tracked.get(changedPath)
      if (!value) return

      logger.info(`Attempting to hot reload ${changedPath}`)

      const eventData = this.getEventData(changedPath, value)
      server.ws.send({
        type: 'custom',
        event: this.updateEvent,
        data: eventData,
      } as FileUpdateEvent)
    })
  }

  addFile(value: T, filePath: string) {
    const absPath = path.resolve(filePath)
    if (!this.tracked.has(absPath)) {
      this.tracked.set(absPath, value)
      this.watcher?.add(absPath)
    }
  }
}
