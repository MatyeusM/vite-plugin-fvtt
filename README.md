# **vite-plugin-foundryvtt**

A powerful [Vite](https://vitejs.dev/) plugin to **streamline and automate** the development of Foundry VTT modules and systems. It handles manifest resolution, asset copying, language file composition, and template handling with **minimal setup**, letting you focus on your code.

## **🚀 Key Features**

The primary advantage of this plugin is the ability to develop your module in a modern, isolated environment. You no longer need to work directly inside your Foundry VTT data folder, which can be messy and inefficient. This allows you to leverage Vite's Hot Module Replacement (HMR) and other developer-friendly features without polluting your local installation.

## **Getting Started**

### **1. Setup a Foundry VTT Project**

Create a standard [Foundry VTT module or system](https://foundryvtt.com/article/module-development/).
Place your `module.json` or `system.json` manifest in either your **project root** or your **public/** directory.

### **2. Add the Plugin to your Vite Config**

Install the plugin with `npm i -D vite-plugin-foundryvtt`.

Add the plugin to your vite.config.js. The **build.lib.entry** field is required, most of the other settings are infer'd by the plugin from your foundry manifest.

```js
// vite.config.js
import { defineConfig } from 'vite';
import foundryVTT from 'vite-plugin-foundryvtt';

export default defineConfig({
  plugins: [foundryVTT()],
  build: {
    // ⚠️ Required: The entry point for your module/system.
    // This file should import your main CSS/SCSS/LESS file.
    lib: {
      entry: './src/main.js',
    },
    sourcemap: true,
  },
});
```

## **⚙️ How it Works**

### **Manifest & Asset Resolution**

* The plugin automatically detects your manifest file (`module.json` or `system.json`) in the project **root** or `public/` folder.
* Assets referenced in the manifest (styles, esmodules, scripts) are **automatically generated to the build output**, simplifying your build process.

### **Template Handling**

* The plugin automatically detects templates in common locations:
  * Your public folder (e.g., `public/handlebars/`).
  * The project root (e.g., `templates/`).
  * A templates folder directly under your entry file's directory (e.g., `src/tpl/`).
* **Note:** Only templates located in the **public folder** are copied to the build output.

### **Language File Merging**

The plugin offers a powerful feature for managing translations.

* **Complete Language Files:** Place a complete JSON file (e.g., `public/lang/en.json`) and the plugin will copy it as-is.
* **Partial Language Files:** To modularize your translations, place multiple JSON files in a subdirectory (e.g., `src/lang/en/`). The plugin will automatically **merge them into a single file** (`lang/en.json`) during the build, as specified in your manifest. The plugin looks in **root** or your **source directory** for the paths as specified in your foundry manifest file.

## **Example Project Structure**
```
my-module/
├─ src/
│  ├─ main.js         # The primary module entry file (required by Vite).
│  ├─ style.css       # Your project's main stylesheet.
│  └─ lang/en/        # Directory for partial, merged translation files.
│     ├─ spells.json
│     ├─ abilities.json
│     └─ general.json
├─ public/
│  ├─ module.json     # Your module's manifest file (or system.json).
│  └─ templates/      # HTML template files for your module.
├─ vite.config.js     # Your Vite configuration file.
```

## **🐛 Known Issues & Troubleshooting**

* **HMR:** Hot Module Replacement may be inconsistent for non-English language files. A full page refresh or server restart might be needed.
* **App V2:** HMR for Foundry's new App V2 has not been fully tested. If you encounter issues, please open a GitHub issue.
* **General Issues:** If you face unexpected behavior, the first step is always to **restart your dev server (npm run dev) or run a fresh build**. This often resolves caching or HMR-related glitches.

---

License: MIT
