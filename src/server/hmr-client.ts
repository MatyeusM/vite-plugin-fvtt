export default `
if (import.meta.hot) {
  const FVTT_PLUGIN = __FVTT_PLUGIN__

  function refreshApplications(renderData = {}) {
    const options = { renderContext: 'hotReload', renderData }
    // AppV1 refresh
    for (const appV1 of Object.values(foundry.ui.windows)) appV1.render(false, { ...options })
    // AppV2 refresh
    for (const appV2 of foundry.applications.instances.values()) appV2.render({ ...options })
  }

  import.meta.hot.on('foundryvtt-template-update', ({ path }) => {
    game.socket.emit('template', path, response => {
      if (response.error) new Error(response.error)
      let template = undefined
      try {
        template = Handlebars.compile(response.html)
      } catch (error) {
        console.error(error)
        return
      }
      if (!Object.hasOwn(Handlebars, 'templateIds')) Handlebars.registerPartial(path, template)
      else if (Handlebars.templateIds[path]?.size > 0) {
        for (const id of Handlebars.templateIds[path])
          if (id in Handlebars.partials) Handlebars.registerPartial(id, template)
      } else foundry.applications.handlebars.getTemplate(path)
      console.log(\`Vite | Retrieved and compiled template \${path}\`)
      refreshApplications({
        packageId: FVTT_PLUGIN.id,
        packageType: FVTT_PLUGIN.isSystem ? 'system' : 'module',
        content: response.html,
        path,
        extension: 'html',
      })
    })
  })

  async function hmrLanguage(lang, targetObject = game.i18n.translations) {
    try {
      const languages = FVTT_PLUGIN.isSystem
        ? game.system.languages
        : game.modules.get(FVTT_PLUGIN.id)?.languages
      if (!languages) {
        console.warn(
          'Vite | Got a HMR request to reload languages, however no languages were found.',
        )
        return
      }
      const langEntry = languages.find(l => l.lang === lang)
      if (!langEntry) {
        console.warn('Vite | Got an HMR request for an undefined language')
        return
      }

      const url = langEntry.path
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Failed to fetch language file!')

      const json = await resp.json()

      foundry.utils.mergeObject(targetObject, json)
      console.log(\`Vite | HMR: Reloaded language '\${lang}'\`)
    } catch (error) {
      console.error(\`Vite | HMR: Error reloading language '\${lang}' for \${FVTT_PLUGIN.id}\`, error)
    }
  }

  import.meta.hot.on('foundryvtt-language-update', async () => {
    const currentLang = game.i18n.lang
    const promises = []
    if (currentLang !== 'en') {
      promises.push(hmrLanguage('en', game.i18n._fallback))
    }
    promises.push(hmrLanguage(currentLang))
    await Promise.all(promises)
    refreshApplications({
      packageId: FVTT_PLUGIN.id,
      packageType: FVTT_PLUGIN.isSystem ? 'system' : 'module',
      content: '',
      path: '',
      extension: 'json',
    })
  })
} else console.error('Vite | HMR is disabled')
//`
