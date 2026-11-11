import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Construit le SDK runtime et son worker ESM autonome.
export default defineConfig({
  base: './',
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
  worker: {
    format: 'es',
  },
})
