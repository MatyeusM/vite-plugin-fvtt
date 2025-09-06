# **vite-plugin-fvtt**

A [Vite](https://vitejs.dev/) plugin to **streamline and automate** the development of Foundry VTT
modules and systems.

It handles manifest resolution, asset copying, language file composition, and template handling with
**minimal setup**, letting you focus on your code.

The plugin's core goal is to enable a robust HMR workflow via Vite's development server, freeing you
from Foundry VTT's native HMR and build watch commands.

[**Changelog**](CHANGELOG.md)

## **🚀 Getting Started**

### **Step 1. Setup a Foundry VTT Project**

Create a standard
[Foundry VTT module or system](https://foundryvtt.com/article/module-development/). Place your
`module.json` or `system.json` manifest in either your **project root** or your **public/**
directory.

### **Step 2. Add the Plugin to your Vite Config**

Install the plugin with `npm i -D vite-plugin-fvtt`.

Add the plugin to your vite.config.js. The **build.lib.entry** field is required; most of the other
settings are inferred by the plugin from your Foundry VTT manifest.

```js
// vite.config.js
import { defineConfig } from 'vite'
import foundryVTT from 'vite-plugin-fvtt'

export default defineConfig({
  plugins: [foundryVTT()],
  build: {
    // ⚠️ Required: The entry point for your module/system.
    // This file should import your main CSS/SCSS/LESS file.
    lib: { entry: './src/main.js' },
    sourcemap: true,
  },
})
```

## **⚙️ Features**

### **1. Configuration**

The plugin needs to know where your Foundry VTT instance is running to proxy and serve assets
correctly. If you want to change anything from the defaults `http://localhost:30000`, create a
`.env.foundryvtt.local` file in your project.

```ini
FOUNDRY_URL=localhost
FOUNDRY_PORT=30000
```

The Vite dev server will run on `FOUNDRY_PORT + 1`, where you will need to open your browser
manually to.

### **2. Manifest & Asset Resolution**

The plugin automatically detects your manifest file (`module.json` or `system.json`) in the project
**root** or `public/` folder.

This plugin shapes the output depending on your manifest; it tries to automatically discover the
relevant files in the `root`, `source`, and `public` folders to build the output files. The `public`
folder is defined by the Vite config file. The plugin determines the `source` directory based on
your `lib.entry` path. For example, if your `lib.entry` is './mysource/package/main.js', the
`mysource/` directory is considered your source directory.

💡 Your entry file should always import your main stylesheet; the manifest dictates how everything
is named and output.

### **3. ESModules, Scripts & Styles**

`esmodules` and `scripts` declared in your manifest are automatically created from your `lib.entry`.
Since Vite compiles the module, the plugin expects the `esmodules` or `scripts` entry in your
manifest to only point to a single JavaScript file.

Stylesheets (CSS/SCSS/LESS) should be imported in your entry file; the plugin ensures they are
outputted as the correct file.

### **4. Template Handling**

Templates work in HMR properly on the development server; they are autodiscovered as discussed in
[2. Manifest & Asset Resolution](#2-manifest--asset-resolution). The development server intercepts
the websocket traffic and sends the local templates instead of Foundry VTT's, if present. e.g., a
template request to `/systems/mysystem/tpl/character-header.hbs` might be rerouted to
`public/tpl/character-header.hbs`. Folder structure inside your project is mirrored, apart from the
`system`/`module` specific prefix.

### **5. Language File Merging**

Supports both complete and partial translation workflows:

- **Complete files:** Place a complete JSON file (e.g., `public/lang/en.json`) and the plugin will
  copy it as-is.
- **Partial files:** Place multiple JSONs inside `src/lang/en/` and the plugin merges them into one
  `lang/en.json` at build.

Merging follows your manifest’s declared language paths, searching in root or source directories.

⚠️ **Note:** HMR works for language files, but non-English locales may not reload as expected.

### **Example Project Structure**

```
my-module/
├─ src/
│  ├─ main.js         # The primary module entry file (required by Vite).
│  ├─ style.css       # Your project's main stylesheet, imported by main.js.
│  └─ lang/en/        # Directory for partial, merged translation files.
│     ├─ spells.json
│     ├─ abilities.json
│     └─ general.json
├─ public/            # For static assets (templates, images)
│  ├─ module.json     # Your module's manifest file (or system.json).
│  └─ templates/      # HTML template files for your module.
├─ vite.config.js     # Your Vite configuration file.
```

---

## 📄 License

[MIT](LICENSE)
