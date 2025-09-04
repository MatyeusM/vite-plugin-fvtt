export default `
if (import.meta.hot) {
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

  import.meta.hot.on('foundryvtt-language-update', async () => {
    console.log('Vite | Force reassigning language')
    // only reload the entire translations of this system or module
    await game.i18n.setLanguage(game.i18n.lang)
    refreshApplications()
  })
} else console.error('Vite | HMR is disabled')
`
