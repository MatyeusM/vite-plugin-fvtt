// language-tracker.ts
import { ResolvedConfig } from 'vite'
import { AbstractFileTracker } from './abstract-file-tracker'

export class LanguageTracker extends AbstractFileTracker<string> {
  protected readonly updateEvent = 'foundryvtt-language-update'

  constructor() {
    // A placeholder config is used as the language tracker doesn't need it for event data
    super({} as ResolvedConfig)
  }

  protected getEventData(): object {
    return {}
  }
}

export const languageTracker = new LanguageTracker()
