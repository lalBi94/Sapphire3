import { build } from 'vite'
import path from 'node:path'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { examples } from '../src/utils/examples.js'
import { deserializeWorkspace } from '../src/utils/workspaceFile.js'
import { dashboardWidgets, dashboardInitialStates } from '../src/utils/dashboardWidgets.js'
import { dashboardContractPanels } from '../src/utils/dashboardContracts.js'
import { buildDashboardDocument, dashboardDefaultLayout } from '../src/utils/dashboardExport.js'
import { dashboardModuleMapFromCards } from '../src/utils/dashboardModuleMap.js'
import { analyzeProgram, createContextIndex } from '../src/utils/logic/index.js'
import { repositoryUrl } from '../src/utils/appInfo.js'
import { simulateProgram } from '../src/utils/logic/simulation.js'
import { dashboardSimulationBudget, dashboardPaletteFromTheme } from '../src/utils/dashboardConfig.js'
import { presetThemes } from '../src/utils/theme.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(root, 'abstract', 'visual', 'dashboards')
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

// Les douze exemples mis en avant sur le site ; la page dashboards.html reprend les mêmes identifiants.
const showcase = [
  { id: 'solarSystem', title: 'Solar system', description: 'Huit planètes képlériennes ; la Terre bleue est la seule à laisser une traînée.' },
  { id: 'buttonLed', title: 'Two buttons and an LED', description: 'Un bouton à bascule, un bouton maintenu et une LED : les deux entrées pilotent le voyant.' },
  { id: 'rotatingCube', title: 'Rotating cube', description: 'Un cube filaire en rotation, deux projections synchronisées : perspective et orthographique.' },
  { id: 'neonRose', title: 'Neon rose', description: 'Une rosace multicolore se dessine point par point : cinq pétales, 32 images, calculs SP3.' },
  { id: 'spirograph', title: 'Spirograph', description: 'Une hypotrochoïde lumineuse se construit progressivement sur un écran pixel.' },
  { id: 'harmonicStudio', title: 'Harmonic studio', description: 'Trois signaux superposés : porteuse, harmonique, battements. Explorez chaque canal.' },
  { id: 'coral', title: 'Coral growth', description: 'Une structure organique émerge d’un automate cellulaire, génération après génération.' },
  { id: 'orbitalTrails', title: 'Orbital trails', description: 'Deux satellites jaune/cyan tracent un huit : une classe Rotor, un module Math, un écran.' },
  { id: 'starfield', title: 'Starfield', description: 'Un ciel pixel qui se renouvelle : huit étoiles aléatoires par image.' },
  { id: 'chirpRibbon', title: 'Chirp ribbon', description: 'Une onde se resserre vers les bords : une fréquence qui change sous vos yeux.' },
  { id: 'rgbMixer', title: 'RGB mixer', description: 'Trois couleurs, quatre bandes, une LED RVB : le mélange se lit en temps réel.' },
  { id: 'wavePacket', title: 'Wave packet', description: 'Une onde émerge puis s’efface dans une enveloppe gaussienne ; zoom et curseur interactifs.' },
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
const themes = presetThemes
  .map((theme) => ({ id: theme.id, labelKey: theme.labelKey, palette: dashboardPaletteFromTheme(theme.colors) }))
  .filter((theme) => theme.palette)
const themeId = 'sapphire'

const runtimeSource = await bundle('src/dashboard/runtimeEntry.js', 'SapphireDashboardRuntime')
const clientSource = await bundle('src/dashboard/client.js', 'SapphireDashboardClient')
const liveSource = await bundle('src/services/live.worker.js', 'SapphireDashboardLive')
await mkdir(outputDirectory, { recursive: true })
for (const file of await readdir(outputDirectory)) {
  if (file.endsWith('.html')) await rm(path.join(outputDirectory, file))
}

for (const entry of showcase) {
  const example = examples.find((candidate) => candidate.id === entry.id)
  if (!example) throw new Error(`Unknown example ${entry.id}`)
  const workspace = deserializeWorkspace(JSON.stringify(example.build()))
  const result = simulateProgram(workspace.project, { maxSteps: dashboardSimulationBudget })
  if (!result.ok) throw new Error(`${entry.id}: ${result.errorCode ?? 'Simulation failed'}`)
  const widgets = [...dashboardWidgets(workspace.project, workspace.presentation.cards), ...dashboardContractPanels(workspace.project)]
  const index = createContextIndex(workspace.project, analyzeProgram(workspace.project))
  const moduleMap = dashboardModuleMapFromCards(workspace.presentation.cards, index)
  const html = buildDashboardDocument({
    name: entry.title,
    description: entry.description,
    palette,
    themes,
    themeId,
    moduleMap,
    widgets,
    initialStates: dashboardInitialStates(widgets),
    layout: dashboardDefaultLayout(widgets),
    layoutKey: `site-${entry.id}`,
    runtimeSource,
    clientSource,
    liveSource,
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
