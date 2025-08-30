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
    let foundryvttPath = path.localToFoundryVTTUrl(changedPath)
    if (foundryvttPath.startsWith('/')) foundryvttPath = foundryvttPath.slice(1)
    return { path: foundryvttPath }
  }
}

export const handlebarsTracker = new HandlebarsTracker()
