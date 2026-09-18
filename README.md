<h1 align="center">vite-plugin-fvtt</h1>

<div align="center">

![NPM Version](https://img.shields.io/npm/v/vite-plugin-fvtt?style=for-the-badge&labelColor=1a1c23&color=a9cbae)
![GitHub License](https://img.shields.io/github/license/MatyeusM/vite-plugin-fvtt?style=for-the-badge&labelColor=1a1c23&color=97cdcc)
![GitHub last commit](https://img.shields.io/github/last-commit/MatyeusM/vite-plugin-fvtt?style=for-the-badge&labelColor=1a1c23&color=a1c6e1)
![GitHub repo size](https://img.shields.io/github/repo-size/MatyeusM/vite-plugin-fvtt?style=for-the-badge&labelColor=1a1c23&color=bdbde4)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/MatyeusM/vite-plugin-fvtt/ci.yml?style=for-the-badge&labelColor=1a1c23&color=d6b5d2)

</div>

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

Install the plugin with `pnpm add -D vite-plugin-fvtt` (or `npm i -D vite-plugin-fvtt`).

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

### Requirements

- Node.js `>=22.0.0`
- Vite `^7.0.0 || ^8.0.0`
- A manifest file (`module.json` or `system.json`) in the project **root** or `public/` directory,
  declaring exactly one of `esmodules` or `scripts` (plus optional `styles`, `languages`, `packs`).

## **⚙️ Features**

### **1. Configuration (Optional)**

The plugin needs to know where your Foundry VTT instance is running to proxy and serve assets
correctly. If you want to change anything from the defaults `http://localhost:30000`, create a
`.env.foundryvtt.local` file in your project (any `.env.foundryvtt*` file is loaded and merged).

```ini
FOUNDRY_URL=localhost
FOUNDRY_PORT=30000
```

The Vite dev server runs on `FOUNDRY_PORT + 1` and proxies everything outside your module/system
base path to Foundry, so open your browser at the dev-server port manually.

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

Templates get working HMR on the development server; they are resolved as described in
[2. Manifest & Asset Resolution](#2-manifest--asset-resolution). The development server intercepts
websocket traffic and serves local templates instead of Foundry VTT's, when present. Folder
structure inside your project is mirrored, apart from the `system`/`module` specific prefix.

### **5. Language File Merging**

Supports both complete and partial translation workflows, following the `path` of each entry in your
manifest's `languages` array:

- **Complete files:** place a complete JSON file at the manifest-declared path inside your public
  directory and the plugin copies it as-is.
- **Partial files:** otherwise, place multiple JSONs inside `<source>/<dir>/<lang>/` (e.g. for a
  manifest path of `lang/en.json` with a `src` source directory: `src/lang/en/*.json`) and the
  plugin merges them into one file at build. Dot-notation keys are expanded into nested objects.

### **6. Packs**

Packs declared in your manifest are compiled with `@foundryvtt/foundryvtt-cli` during build and
`--watch` (YAML sources detected automatically). Sources are looked up in your source directory
first, then the project root, and compiled into the output directory. A manifest pack entry with no
matching source directory is skipped with a warning. Disable with
`foundryVTT({ buildPacks: false })`.

**Note:** Packs are currently not watched for changes.

### Minification

On Vite 8+ the plugin minifies with `oxc`; on older Vite versions it falls back to `esbuild`
(identifiers and names preserved).

### **Example Project Structure**

```
// With a manifest declaring "languages": [{ "lang": "en", "path": "lang/en.json" }]:
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

## 🛠️ Development

| Script               | Purpose                     |
| -------------------- | --------------------------- |
| `pnpm run build`     | Build the plugin (`tsdown`) |
| `pnpm run test`      | Run the Vitest suite        |
| `pnpm run lint`      | Lint (`oxlint`)             |
| `pnpm run fmt`       | Format (`oxfmt`)            |
| `pnpm run typecheck` | Typecheck (`tsc`)           |

---

## 🛠️ Local Foundry Test Instances (maintainers)

Gitignored `local/` holds version-specific Foundry installs with separate data dirs:

```
local/foundry-v12/ + local/data-v12/ (port 30012, node 20)
local/foundry-v13/ + local/data-v13/ (port 30013, node 22)
local/foundry-v14/ + local/data-v14/ (port 30014, node 24)
```

Start one via `mise run -C local start-v12|start-v13|start-v14`.

> ⚠️ Single Foundry license key: run only **one** instance at a time. Never run v12/v13/v14
> concurrently.

## 📄 License

[MIT](LICENSE)
