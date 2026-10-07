/**
 * Foundry v13 e2e. Differences from v14 live here rather than in a shared version table, because
 * they are the things that drift apart between releases: v13 offers a <select> of users on the join
 * page, renders the v1 actor sheet template, and labels its tabs with the flat SR5.* keys.
 *
 * Skips itself unless local/ is provisioned for v13; see tests/e2e/support.ts.
 */
import { foundrySuite } from './support'

await foundrySuite({
  id: 'v13',
  foundryDir: 'foundry-v13',
  port: 30013,
  template: 'public/templates/actor/character.hbs',
  languageKey: 'SR5.Actions',
  languageSelector: '.window-app.actor .tabs [data-tab="actions"]',
  async selectUser(page) {
    const select = page.locator('select[name="userid"]')
    // v13 populates the user list asynchronously over the socket.
    await select
      .locator('option', { hasText: 'Gamemaster' })
      .waitFor({ state: 'attached', timeout: 60_000 })
    await select.selectOption({ label: 'Gamemaster' })
  },
})
