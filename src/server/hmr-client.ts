export default `
if (import.meta.hot) {
  const FVTT_PLUGIN = __FVTT_PLUGIN__

  function refreshApplications(path = null) {
    // AppV1 refresh
    Object.values(foundry.ui.windows).forEach(app => app.render(true))
    // AppV2 refresh
    if (path)
      foundry.applications.instances.forEach(appV2 => {
        Object.values(appV2.constructor.PARTS ?? {}).forEach(part => {
          const templates = Array.isArray(part.templates) ? part.templates : []
          if (part.template === path || templates.includes(path)) appV2.render(true)
        })
      })
    else foundry.applications.instances.forEach(appV2 => appV2.render(true))
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
      Handlebars.registerPartial(path, template)
      console.log(\`Vite | Retrieved and compiled template \${path}\`)
      refreshApplications(path)
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
      console.error(\`Vite | HMR: Error reloading language '\${lang}' for \${FVTT_PLUGIN.id}\`, error);
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
    refreshApplications()
  })
} else console.error('Vite | HMR is disabled')
//`
