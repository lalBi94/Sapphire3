import { build } from 'vite'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { examples } from '../src/utils/examples.js'
import { deserializeWorkspace } from '../src/utils/workspaceFile.js'
import { dashboardWidgets, dashboardInitialStates } from '../src/utils/dashboardWidgets.js'
import { buildDashboardDocument, dashboardDefaultLayout } from '../src/utils/dashboardExport.js'
import { repositoryUrl } from '../src/utils/appInfo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(root, 'abstract', 'visual', 'dashboards')
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

// Les dix exemples mis en avant sur le site ; la page dashboards.html reprend les mêmes identifiants.
const showcase = [
  { id: 'rgbMixer', title: 'RGB mixer', description: 'Écran, trois barres de progression, jauge et LED RVB dans un même dashboard.' },
  { id: 'gaugeDemo', title: 'Gauge demo', description: 'Une jauge seule, pour lire la valeur, les bornes et le pourcentage.' },
  { id: 'trafficControl', title: 'Traffic control', description: 'Heatmap, graphique à barres et progression sur une simulation de trafic.' },
  { id: 'dampedSpring', title: 'Damped spring', description: 'Ressort amorti : barres signées et jauge suivent chaque pas du calcul.' },
  { id: 'rotatingCube', title: 'Rotating cube', description: 'Deux écrans synchronisés, projection perspective et orthographique.' },
  { id: 'gameOfLife', title: 'Game of Life', description: 'Automate de Conway sur un écran 90 × 56, image par génération.' },
  { id: 'pendulumWave', title: 'Pendulum wave', description: 'Huit pendules animés sur neuf images précalculées.' },
  { id: 'checkoutQueue', title: 'Checkout queue', description: 'File d’attente : barres, jauge et LED pour suivre l’état du service.' },
  { id: 'primeSieve', title: 'Prime sieve', description: 'Crible d’Ératosthène : heatmap des nombres et progression.' },
  { id: 'reactorControl', title: 'Reactor control', description: 'Deux classes coopèrent et pilotent jauge, barres et LED.' },
]

// Compile un point d'entrée en IIFE et renvoie son code, sans écrire de fichier intermédiaire.
async function bundle(entry, name) {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: true,
      target: 'es2020',
      lib: { entry: path.resolve(root, entry), formats: ['iife'], name, fileName: () => 'bundle.js' },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  for (const item of outputs) {
    const chunk = item.output?.find((candidate) => candidate.type === 'chunk')
    if (chunk?.code) return chunk.code
  }
  throw new Error(`empty bundle ${entry}`)
}

// Charge les polices locales et le logo, comme l'export réel du dashboard.
const fontFiles = {
  interLatin: 'src/assets/fonts/inter-latin.woff2',
  interCyrillic: 'src/assets/fonts/inter-cyrillic.woff2',
  spaceGrotesk: 'src/assets/fonts/space-grotesk-latin.woff2',
  jetBrainsLatin: 'src/assets/fonts/jetbrains-mono-latin.woff2',
  jetBrainsCyrillic: 'src/assets/fonts/jetbrains-mono-cyrillic.woff2',
}
const fonts = Object.fromEntries(await Promise.all(Object.entries(fontFiles).map(async ([key, file]) => {
  const data = await readFile(path.join(root, file))
  return [key, `data:font/woff2;base64,${data.toString('base64')}`]
})))
const logo = await readFile(path.join(root, 'src/assets/branding/01_WEB/WEBP_lossless/sapphire3_logo_128x128_lossless.webp'))
const branding = { logo: `data:image/webp;base64,${logo.toString('base64')}` }

const palette = {
  '--color-black': '#0e0e12',
  '--color-anthracite': '#19191f',
  '--color-anthracite-raised': '#24242c',
  '--color-text': '#f2f1f6',
  '--color-text-muted': '#b5b2c2',
  '--color-yellow': '#f5d547',
  '--color-violet': '#c4b1ff',
  '--color-border': '#ffffff24',
  '--color-border-hover': '#ffffff48',
  '--color-hover': '#ffffff0d',
  '--color-grid': '#ffffff0c',
  '--color-canvas-edge': '#07070b99',
  '--color-on-primary': '#0e0e12',
  '--color-node-condition': '#d9a441',
}

const runtimeSource = await bundle('src/dashboard/runtimeEntry.js', 'SapphireDashboardRuntime')
const clientSource = await bundle('src/dashboard/client.js', 'SapphireDashboardClient')
await mkdir(outputDirectory, { recursive: true })

for (const entry of showcase) {
  const example = examples.find((candidate) => candidate.id === entry.id)
  if (!example) throw new Error(`Unknown example ${entry.id}`)
  const workspace = deserializeWorkspace(JSON.stringify(example.build()))
  const widgets = dashboardWidgets(workspace.project, workspace.presentation.cards)
  const html = buildDashboardDocument({
    name: entry.title,
    description: entry.description,
    palette,
    widgets,
    initialStates: dashboardInitialStates(widgets),
    layout: dashboardDefaultLayout(widgets),
    layoutKey: `site-${entry.id}`,
    runtimeSource,
    clientSource,
    project: workspace.project,
    language: 'fr',
    fonts,
    branding,
    version,
    repository: repositoryUrl,
  })
  const output = path.join(outputDirectory, `${entry.id}.html`)
  await writeFile(output, html)
  console.log(`${path.relative(root, output)} · ${widgets.map((widget) => widget.type).join(', ')} · ${html.length} octets`)
}
