import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import foundryVTT from 'vite-plugin-fvtt';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
    plugins: [foundryVTT()],
    build: {
        lib: { entry: './src/module/main.ts' },
    },
    css: {
        preprocessorOptions: {
            // loadPaths replaces the gulp-sass includePaths the subdirectory sheets relied on.
            scss: {
                api: 'modern-compiler',
                loadPaths: [fileURLToPath(new URL('./src/css', import.meta.url))],
            },
        },
    },
    // Vite does not read tsconfig "paths", so mirror them here.
    resolve: {
        alias: [
            { find: /^@\//, replacement: `${src}/` },
            { find: /^src\//, replacement: `${src}/` },
        ],
    },
});