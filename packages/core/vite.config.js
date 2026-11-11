import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Construit le SDK en un unique module ESM autonome, sans dépendance à l'IDE.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
  },
})
