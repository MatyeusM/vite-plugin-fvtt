export default `
if (import.meta.hot) {
  function refreshApplications() {
    // AppV1 refresh
    Object.values(foundry.ui.windows).forEach(app => app.render(true))
    // AppV2 refresh
    // TODO: Can we filter out to only refresh the correct apps?
    foundry.applications.instances.forEach(appV2 => appV2.render(true))
  }

  import.meta.hot.on('foundryvtt-template-update', ({ path }) => {
    console.log('Vite | Force reload template', path)
    Handlebars.unregisterPartial(path)
    foundry.applications.handlebars.getTemplate(path)
    refreshApplications()
  })

  import.meta.hot.on('foundryvtt-language-update', async () => {
    console.log('Vite | Force reassigning language')
    await game.i18n.setLanguage(game.i18n.lang)
    refreshApplications()
  })
} else console.error('Vite | HMR is disabled')
`
