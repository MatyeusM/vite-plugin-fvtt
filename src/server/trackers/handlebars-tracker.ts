import { context } from 'src/context'
import { ResolvedConfig } from 'vite'
import { AbstractFileTracker } from './abstract-file-tracker'
import path from 'src/utils/path-utils'

export class HandlebarsTracker extends AbstractFileTracker<boolean> {
  protected readonly updateEvent = 'foundryvtt-template-update'

  constructor() {
    super(context.config as ResolvedConfig)
  }

  protected getEventData(changedPath: string): object {
    return { path: path.localToFoundryVTTUrl(changedPath) }
  }
}

export const handlebarsTracker = new HandlebarsTracker()
