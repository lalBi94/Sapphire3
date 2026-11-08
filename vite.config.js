import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La version vient de package.json, sans dupliquer le numéro dans le code.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const root = path.dirname(fileURLToPath(import.meta.url))

// Deux bundles autonomes sont produits à la construction puis exposés comme chaînes au frontend.
const dashboardSpecs = new Map([
  ['virtual:dashboard-runtime', { entry: 'src/dashboard/runtimeEntry.js', name: 'SapphireDashboardRuntime' }],
  ['virtual:dashboard-client', { entry: 'src/dashboard/client.js', name: 'SapphireDashboardClient' }],
])

// Polices embarquées dans l'export, chargées uniquement au moment de générer le dashboard.
const dashboardFontSpec = 'virtual:dashboard-fonts'
const dashboardFontFiles = {
  interLatin: 'src/assets/fonts/inter-latin.woff2',
  interCyrillic: 'src/assets/fonts/inter-cyrillic.woff2',
  spaceGrotesk: 'src/assets/fonts/space-grotesk-latin.woff2',
  jetBrainsLatin: 'src/assets/fonts/jetbrains-mono-latin.woff2',
  jetBrainsCyrillic: 'src/assets/fonts/jetbrains-mono-cyrillic.woff2',
}

// Compile un point d'entrée en IIFE et renvoie son code, sans écrire de fichier intermédiaire.
async function bundleDashboardEntry(spec) {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: true,
      target: 'es2020',
      lib: {
        entry: path.resolve(root, spec.entry),
        formats: ['iife'],
        name: spec.name,
        fileName: () => 'dashboard-bundle.js',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  for (const output of outputs) {
    const chunk = output.output?.find((entry) => entry.type === 'chunk')
    if (chunk?.code) return chunk.code
  }
  throw new Error(`Dashboard bundle is empty: ${spec.entry}`)
}

// Expose les bundles au code applicatif via deux modules virtuels.
function dashboardBundles() {
  const cache = new Map()
  const loadBundle = (spec) => {
    if (!cache.has(spec.entry)) cache.set(spec.entry, bundleDashboardEntry(spec))
    return cache.get(spec.entry)
  }
  return {
    name: 'sapphire-dashboard-bundles',
    resolveId(id) {
      return id === dashboardFontSpec || dashboardSpecs.has(id) ? `\0${id}` : null
    },
    async load(id) {
      if (id === `\0${dashboardFontSpec}`) {
        const fonts = {}
        for (const [key, file] of Object.entries(dashboardFontFiles)) {
          const data = await readFile(path.resolve(root, file))
          fonts[key] = `data:font/woff2;base64,${data.toString('base64')}`
        }
        return `export default ${JSON.stringify(fonts)}`
      }
      if (!id.startsWith('\0virtual:dashboard-')) return null
      const spec = dashboardSpecs.get(id.slice(1))
      if (!spec) return null
      return `export default ${JSON.stringify(await loadBundle(spec))}`
    },
    handleHotUpdate(context) {
      const file = String(context.file ?? '').replace(/\\/g, '/')
      const watched = file.includes('/src/dashboard/') || file.includes('/src/utils/dashboard') || file.includes('/src/utils/logic/') || file.includes('/src/assets/fonts/')
      if (!watched) return
      cache.clear()
      const graph = context.server?.moduleGraph
      for (const id of [dashboardFontSpec, ...dashboardSpecs.keys()]) {
        const module = graph?.getModuleById?.(`\0${id}`)
        if (module) graph.invalidateModule(module)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), dashboardBundles()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
