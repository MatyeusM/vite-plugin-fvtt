import { ResolvedConfig } from 'vite'
import { context } from 'src/context'
import { AbstractFileTracker } from './abstract-file-tracker'

export class HandlebarsTracker extends AbstractFileTracker<string> {
  protected readonly updateEvent = 'foundryvtt-template-update'

  constructor() {
    super(context.config as ResolvedConfig)
  }

  protected getEventData(changedPath: string, value: string): object {
    return { path: value }
  }
}

export const handlebarsTracker = new HandlebarsTracker()
