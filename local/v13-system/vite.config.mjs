import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import foundryVTT from 'vite-plugin-fvtt';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
    plugins: [foundryVTT()],
    build: {
        lib: { entry: './src/module/main.ts' },
    },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
    // Vite does not read tsconfig "paths", so mirror them here.
    resolve: {
        alias: [
            { find: /^@\//, replacement: `${src}/` },
            { find: /^src\//, replacement: `${src}/` },
        ],
    },
});