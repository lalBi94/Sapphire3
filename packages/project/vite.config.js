import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Construit le SDK project en un module ESM autonome, core compris.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@sapphire3/core': resolve(import.meta.dirname, '../core/src/index.js'),
    },
  },
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
