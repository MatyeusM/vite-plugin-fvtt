/**
 * Foundry v14 e2e. Differences from v13 live here rather than in a shared version table, because
 * they are the things that drift apart between releases: v14 asks for a username on the join page,
 * renders the v2 AppV2 actor sheet, and labels its tabs with the SR5.Tabs.Actor.* keys.
 *
 * Skips itself unless local/ is provisioned for v14; see tests/e2e/support.ts.
 */
import { foundrySuite } from './support'

await foundrySuite({
  id: 'v14',
  foundryDir: 'foundry-v14',
  port: 30014,
  template: 'public/templates/v2/actor/header.hbs',
  languageKey: 'SR5.Tabs.Actor.Actions',
  languageSelector: '.application.sheet.actor .sheet-tabs [data-tab="actions"]',
  async selectUser(page) {
    await page.locator('#join-username').fill('Gamemaster')
  },
})
