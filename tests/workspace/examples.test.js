import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { examples, exampleCategories, exampleSubcategories } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { findFrameCycle } from '../../src/utils/screenPlayback.js'
import { nodeSchema } from '../../src/utils/logic/nodeSchema.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const expectedOutput = {
  fibonacci: ['55'],
  sorting: ['1', '3', '5', '8'],
  quickSort: ['1', '3', '5', '8'],
  coinChange: ['6'],
  arrays: ['7', '4', '3'],
  recursion: ['120'],
  imports: ['25'],
  foreach: ['3', '1', '4', '1', '5'],
  pointers: ['3', '8', '8', '3'],
  higherOrder: ['42'],
  maths: ['7', '3', '-7', '5', '6', '9', '9'],
  calculus: ['6', '0.3333333333333333'],
  knapsack: ['9'],
  pixelScreens: ['Logos bouncing'],
  rain: ['Rain'],
  gameOfLife: ['Game of life'],
  roverSurvey: ['Rover survey', 'true'],
  signalLab: ['hot', 'STABLE', 'w', 'true', '5', '8', '16', '3', '19', 'true', '0', 'Signal lab'],
  gaugeDemo: ['Gauge full'],
  carDashboard: ['Car dashboard'],
  trafficControl: ['Traffic control'],
  dnaAnalyzer: ['DNA analyzer'],
  signalProcessing: ['Signal processing'],
  mandelbrotEscape: ['Mandelbrot escape'],
  collatzAtlas: ['Collatz atlas'],
  sortRace: ['Sort race'],
  heatDiffusion: ['Heat diffusion'],
  imageConvolution: ['Image convolution'],
  weatherStation: ['Weather station'],
  networkMonitor: ['Network monitor'],
  coral: ['Coral growth'],
  labyrinth: ['Labyrinth'],
  starfield: ['Starfield'],
  colorFlow: ['Color flow'],
  rgbMixer: ['RGB mixer'],
  rotatingCube: ['Rotating cube'],
  rotatingTriangle: ['Rotating triangle'],
  spirograph: ['Spirograph'],
  sierpinskiChaos: ['Sierpinski chaos'],
  pendulumWave: ['Pendulum wave'],
  rgbLedDemo: ['Red', 'Yellow', 'Green', 'Cyan', 'Blue', 'Magenta', 'White'],
  euclid: ['21'],
  binarySearch: ['6'],
  primeSieve: ['11'],
  insertionSort: ['1', '2', '3', '4', '6', '7', '8', '9'],
  diceHistogram: ['48'],
  checkoutQueue: ['0'],
  thermostat: ['21'],
  dampedSpring: ['Damped spring'],
  floodFill: ['21'],
  pascalTriangle: ['1', '7', '21', '35', '35', '21', '7', '1'],
}

test('bibliothèque d’exemples : chaque projet est valide, analysable et s’exécute', () => {
  assert.deepEqual(examples.map((example) => example.id), ['fibonacci', 'recursion', 'arrays', 'foreach', 'sorting', 'maths', 'imports', 'rgbLedDemo', 'pointers', 'higherOrder', 'quickSort', 'coinChange', 'gaugeDemo', 'carDashboard', 'trafficControl', 'dnaAnalyzer', 'signalProcessing', 'mandelbrotEscape', 'collatzAtlas', 'sortRace', 'heatDiffusion', 'imageConvolution', 'weatherStation', 'networkMonitor', 'pixelScreens', 'rain', 'knapsack', 'calculus', 'gameOfLife', 'roverSurvey', 'signalLab', 'coral', 'labyrinth', 'starfield', 'colorFlow', 'rgbMixer', 'rotatingCube', 'rotatingTriangle', 'spirograph', 'sierpinskiChaos', 'pendulumWave', 'euclid', 'binarySearch', 'primeSieve', 'insertionSort', 'diceHistogram', 'checkoutQueue', 'thermostat', 'dampedSpring', 'floodFill', 'pascalTriangle'])
  assert.deepEqual(exampleCategories.map((category) => category.id), ['simple', 'medium', 'hard'])
  for (const example of examples) {
    assert.ok(exampleCategories.some((category) => category.id === example.category), `${example.id}: catégorie connue`)
    if (example.subcategory) assert.ok(exampleSubcategories.some((subcategory) => subcategory.id === example.subcategory), `${example.id}: sous-catégorie connue`)
    const workspace = deserializeWorkspace(JSON.stringify(example.build()))
    assert.ok(workspace.presentation.cards.length >= 1, example.id)
    assert.ok(workspace.presentation.cards.some((card) => card.type === 'comment' && card.text.length > 0), `${example.id}: annotation Comment`)
    const analysis = analyzeProgram(workspace.project)
    assert.deepEqual(analysis.diagnostics, [], example.id)
    const result = simulateProgram(workspace.project)
    assert.equal(result.ok, true, `${example.id}: ${result.errorCode ?? ''}`)
    assert.deepEqual(result.output, expectedOutput[example.id], example.id)
  }
})

test('exemple LED RVB : séquence de sept couleurs, module appelant et état final', () => {
  const example = examples.find((entry) => entry.id === 'rgbLedDemo')
  assert.equal(example.category, 'simple')
  assert.equal(example.subcategory, 'widgets')
  const workspace = deserializeWorkspace(JSON.stringify(example.build()))
  assert.equal(workspace.project.modules.length, 2)
  assert.deepEqual(workspace.presentation.cards.map((card) => card.type), ['rgbLed', 'module', 'comment'])
  assert.equal(workspace.project.modules[1].imports[0].moduleId, 'rgbDemoLed')
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, expectedOutput.rgbLedDemo)
  assert.deepEqual(result.rgbLeds.rgbDemoLed, { red: 255, green: 255, blue: 255 })
  for (const [red, green, blue] of [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 255, 255]]) {
    assert.ok(result.rgbLedFrames.some((frame) => {
      const state = frame.rgbDemoLed
      return state?.red === red && state.green === green && state.blue === blue
    }), `couleur ${red},${green},${blue} observée`)
  }
})

test('les dix exemples graphiques exposent leurs widgets et leurs états', () => {
  const ids = ['trafficControl', 'dnaAnalyzer', 'signalProcessing', 'mandelbrotEscape', 'collatzAtlas', 'sortRace', 'heatDiffusion', 'imageConvolution', 'weatherStation', 'networkMonitor']
  for (const id of ids) {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === id).build()))
    const types = workspace.presentation.cards.map((card) => card.type)
    assert.ok(types.filter((type) => ['barChart', 'heatmap', 'progress'].includes(type)).length >= 2, `${id}: widgets`)
    assert.ok(types.includes('comment'), `${id}: commentaire`)
    const result = simulateProgram(workspace.project)
    assert.equal(result.ok, true, `${id}: ${result.errorCode ?? ''}`)
    const widgetModules = workspace.project.modules.filter((module) => module.barChart || module.heatmap || module.progress)
    assert.ok(widgetModules.length >= 2, `${id}: modules cachés`)
    for (const module of widgetModules) {
      const state = module.barChart ? result.barCharts[module.id] : module.heatmap ? result.heatmaps[module.id] : result.progresses[module.id]
      assert.ok(state, `${id}: état ${module.id}`)
    }
  }
  const race = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'sortRace').build()))
  assert.equal(race.presentation.cards.filter((card) => card.type === 'barChart').length, 2)
})


// Rejoue Rover survey avec un générateur reproductible et relève la case colorée de l'artefact.
function roverArtifactPosition(seed) {
  const originalRandom = Math.random
  let state = seed
  Math.random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  try {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'roverSurvey').build()))
    const result = simulateProgram(workspace.project)
    assert.equal(result.ok, true, result.errorCode)
    assert.deepEqual(result.output, ['Rover survey', 'true'])
    assert.ok(result.steps < 10000)
    for (const frame of result.screenFrames) {
      const pixels = frame.roverScreen.pixels
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 148 && pixels[offset + 1] === 190 && pixels[offset + 2] === 255 && pixels[offset + 3] === 255) return offset / 4
      }
    }
    return null
  } finally {
    Math.random = originalRandom
  }
}

test('exemple Rover survey : la position de l’artefact est tirée à chaque exécution', () => {
  const first = roverArtifactPosition(1)
  const second = roverArtifactPosition(2)
  assert.notEqual(first, second)
  for (const index of [first, second]) {
    assert.notEqual(index, null)
    const x = index % 48
    const y = Math.floor(index / 48)
    const top = x >= 2 && x <= 38 && y >= 3 && y <= 5
    const bottom = x >= 2 && x <= 38 && y >= 15 && y <= 17
    assert.ok(top || bottom, 'artefact dans la bande haute ou basse')
  }
})

test('exemple sac à dos : programmation dynamique pilotée par les natives', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'knapsack').build()))
  const analysis = analyzeProgram(workspace.project)
  assert.deepEqual(analysis.diagnostics, [])
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  // bestValue([1, 3, 4, 5], [1, 4, 5, 7], 7) : objets 3 et 4, valeur 4 + 5.
  assert.deepEqual(result.output, ['9'])
})

test('exemples : les annotations Comment ne chevauchent aucune carte', () => {
  const overlaps = (left, right) => left.x < right.x + right.width && right.x < left.x + left.width && left.y < right.y + right.height && right.y < left.y + left.height
  for (const example of examples) {
    const cards = deserializeWorkspace(JSON.stringify(example.build())).presentation.cards
    const comments = cards.filter((card) => card.type === 'comment')
    for (const comment of comments) {
      for (const card of cards) {
        if (card === comment) continue
        assert.equal(overlaps(comment, card), false, `${example.id}: ${comment.id} chevauche ${card.id}`)
      }
    }
  }
})

test('exemple écrans pixel : deux logos qui rebondissent en boucle sans raccord', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'pixelScreens').build()))
  const screens = workspace.presentation.cards.filter((card) => card.type === 'screen')
  assert.equal(screens.length, 2)
  assert.equal(screens[0].screenWidth, 34)
  assert.equal(screens[0].screenHeight, 18)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  // Une image par génération, grâce à `screenPresent` qui remplace la capture par écriture.
  assert.equal(result.screenFrames.length, 19)
  // La dernière image referme la boucle : la période détectée vaut 18 pour les deux écrans.
  assert.equal(findFrameCycle(result.screenFrames, 'screenOne'), 18)
  assert.equal(findFrameCycle(result.screenFrames, 'screenTwo'), 18)
  const position = (frame, id) => {
    const screen = frame[id]
    for (let index = 0; index < screen.pixels.length; index += 4) {
      if (screen.pixels[index + 3] > 0) return [index / 4 % screen.width, Math.floor(index / 4 / screen.width)]
    }
    return null
  }
  assert.notDeepEqual(position(result.screenFrames[0], 'screenOne'), position(result.screenFrames[2], 'screenOne'))
  assert.deepEqual(position(result.screenFrames[0], 'screenOne'), position(result.screenFrames[18], 'screenOne'))
  assert.equal(result.screenFrames[0].screenTwo.pixels.filter((value, index) => index % 4 === 3 && value > 0).length, 4)
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
})

test('exemple pluie matricielle : colonnes, traînée et boucle sans raccord', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'rain').build()))
  const screen = workspace.presentation.cards.find((card) => card.type === 'screen')
  assert.equal(screen.screenWidth, 90)
  assert.equal(screen.screenHeight, 18)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.screenFrames.length, 19)
  assert.equal(findFrameCycle(result.screenFrames, 'rainScreen'), 18)
  const counts = result.screenFrames.map((frame) => frame.rainScreen.pixels.filter((value, index) => index % 4 === 3 && value > 0).length)
  assert.ok(counts.every((count) => count === 9))
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
})

test('exemples Hard : les deux simulations couvrent tous les types de nœud et de carte', () => {
  // Les lambdas et les nœuds de classe possèdent leurs propres scénarios dédiés.
  const sourceKinds = Object.keys(nodeSchema).filter((kind) => !['Hole', 'LambdaExpression', 'NewExpression', 'ThisExpression', 'MemberExpression'].includes(kind))
  for (const id of ['roverSurvey', 'signalLab']) {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === id).build()))
    const used = new Set(workspace.project.nodes.map((node) => node.kind))
    assert.deepEqual(sourceKinds.filter((kind) => !used.has(kind)), [], `${id}: types de nœud manquants`)
    const cardTypes = new Set(workspace.presentation.cards.map((card) => card.type))
    for (const type of ['module', 'screen', 'gauge', 'led', 'comment']) assert.ok(cardTypes.has(type), `${id}: carte ${type}`)
    assert.equal(cardTypes.has('image'), false, `${id}: aucune carte Image`)
    assert.ok(workspace.project.modules.length >= 7, `${id}: modules`)
    const result = simulateProgram(workspace.project)
    assert.equal(result.ok, true, result.errorCode)
    assert.ok(result.steps < 10000, `${id}: budget de pas`)
    assert.ok(result.gaugeFrames.length < 8000, `${id}: images de jauge`)
    assert.ok(result.screenFrames.length <= 240, `${id}: images d'écran`)
    assert.equal(result.screenFrameGauges.length, result.screenFrames.length, `${id}: jauges alignées`)
    assert.equal(result.screenFrameLeds.length, result.screenFrames.length, `${id}: LED alignées`)
  }
})

test('exemple tableau de bord : pixel, jauge et images alignées à 24 fps', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'carDashboard').build()))
  const screen = workspace.presentation.cards.find((card) => card.type === 'screen')
  const gauge = workspace.presentation.cards.find((card) => card.type === 'gauge')
  assert.deepEqual({ width: screen.screenWidth, height: screen.screenHeight }, { width: 90, height: 14 })
  assert.ok(gauge)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['Car dashboard'])
  assert.equal(result.screenFrames.length, 56)
  // Un état de jauge par image d'écran, pour une animation synchrone.
  assert.equal(result.screenFrameGauges.length, result.screenFrames.length)
  const start = result.screenFrameGauges[0].carGauge.value
  const speeds = result.screenFrameGauges.map((frame) => frame.carGauge.value)
  assert.ok(speeds.every((value) => Number.isInteger(value) && value >= 0 && value <= 100))
  assert.ok(new Set(speeds).size >= 4)
  // La vitesse progresse par pas de 10 au plus, jamais d'un saut aléatoire complet.
  for (let position = 1; position < speeds.length; position += 1) assert.ok(Math.abs(speeds[position] - speeds[position - 1]) <= 10)
  assert.ok(speeds.some((value) => value !== start))
  // La jauge complète suit toute la trace, au-delà de l'ancienne borne de 4 000 états.
  assert.equal(result.gaugeFrames.length, result.trace.length)
  assert.ok(result.trace.length > 4000)
  const lit = result.screenFrames[0].carScreen.pixels.filter((value, index) => index % 4 === 3 && value > 0).length
  assert.equal(lit, 16)
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
})


test('exemple jauge : pilotée de l’extérieur et non transpilable', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'gaugeDemo').build()))
  const card = workspace.presentation.cards.find((entry) => entry.type === 'gauge')
  assert.ok(card)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['Gauge full'])
  assert.deepEqual(result.gauges.progressGauge, { value: 100, min: 0, max: 100 })
  assert.equal(result.gaugeFrames.length, result.trace.length)
  const values = result.gaugeFrames.map((frame) => frame.progressGauge?.value).filter((value) => value !== undefined)
  assert.ok(values.includes(0))
  assert.ok(values.includes(40))
  assert.equal(values[values.length - 1], 100)
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_GAUGE_UNSUPPORTED')
})

test('exemple jeu de la vie : écran 90×56, règles de Conway et cycle infini', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'gameOfLife').build()))
  const screens = workspace.presentation.cards.filter((card) => card.type === 'screen')
  assert.equal(screens.length, 1)
  assert.equal(screens[0].screenWidth, 90)
  assert.equal(screens[0].screenHeight, 56)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.screenFrames.length, 60)
  // Les motifs ont des périodes qui divisent 30 : la génération 30 égale la génération 0.
  const cycle = findFrameCycle(result.screenFrames, 'lifeScreen')
  assert.equal(cycle, 30)
  assert.deepEqual(result.screenFrames[0].lifeScreen.pixels, result.screenFrames[cycle].lifeScreen.pixels)
  const lits = result.screenFrames.map((frame) => frame.lifeScreen.pixels.filter((value, index) => index % 4 === 3 && value > 0).length)
  assert.ok(lits.every((count) => count > 0))
  assert.notDeepEqual(result.screenFrames[0].lifeScreen.pixels, result.screenFrames[7].lifeScreen.pixels)
  assert.equal(result.screens.lifeScreen.width, 90)
  assert.equal(result.screens.lifeScreen.height, 56)
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
})

test('nouveaux exemples écran : résolutions, images et budgets bornés', () => {
  const expectations = {
    coral: { width: 72, height: 40, frames: 62 },
    labyrinth: { width: 72, height: 40, frames: 109 },
    starfield: { width: 64, height: 36, frames: 60 },
    colorFlow: { width: 96, height: 54, frames: 55 },
    rgbMixer: { width: 48, height: 28, frames: 25 },
  }
  const results = new Map()
  for (const [id, expected] of Object.entries(expectations)) {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === id).build()))
    const screen = workspace.presentation.cards.find((card) => card.type === 'screen')
    assert.deepEqual({ width: screen.screenWidth, height: screen.screenHeight }, { width: expected.width, height: expected.height }, id)
    const result = simulateProgram(workspace.project)
    results.set(id, result)
    assert.equal(result.ok, true, `${id}: ${result.errorCode ?? ''}`)
    assert.equal(result.screenFrames.length, expected.frames, id)
    assert.ok(result.steps < 10000, `${id}: budget de pas`)
    assert.ok(result.screenFrames.length <= 240, `${id}: images d'écran`)
    assert.ok(result.screenFrames.every((frame) => Object.values(frame).every((state) => state.pixels.length === expected.width * expected.height * 4)), `${id}: tampon complet`)
  }
  // Le flux de couleurs est une boucle fermée ; les croissances d'automate se relancent à la fin.
  assert.equal(findFrameCycle(results.get('colorFlow').screenFrames, 'flowScreen'), 54)
  // Le mélangeur expose les barres, la jauge et la LED RVB à chaque image.
  const mixer = results.get('rgbMixer')
  assert.equal(mixer.screenFrameProgresses.length, mixer.screenFrames.length)
  assert.equal(mixer.screenFrameGauges.length, mixer.screenFrames.length)
  assert.equal(mixer.screenFrameRgbLeds.length, mixer.screenFrames.length)
  assert.ok(Object.keys(mixer.rgbLeds).length === 1)
})

test('exemples mathématiques visuels : résolutions, images et budgets bornés', () => {
  const expectations = {
    rotatingCube: { width: 48, height: 30, frames: 12, screens: 2 },
    rotatingTriangle: { width: 48, height: 30, frames: 20, screens: 1 },
    spirograph: { width: 96, height: 64, frames: 1, screens: 1 },
    sierpinskiChaos: { width: 64, height: 40, frames: 1, screens: 1 },
    pendulumWave: { width: 96, height: 48, frames: 1, screens: 1 },
  }
  const results = new Map()
  for (const [id, expected] of Object.entries(expectations)) {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === id).build()))
    const screens = workspace.presentation.cards.filter((card) => card.type === 'screen')
    assert.equal(screens.length, expected.screens, id)
    assert.ok(screens.every((screen) => screen.screenWidth === expected.width && screen.screenHeight === expected.height), `${id}: résolution`)
    const result = simulateProgram(workspace.project)
    results.set(id, result)
    assert.equal(result.ok, true, `${id}: ${result.errorCode ?? ''}`)
    assert.equal(result.screenFrames.length, expected.frames, id)
    assert.ok(result.steps < 10000, `${id}: budget de pas`)
    assert.ok(result.screenFrames.every((frame) => Object.values(frame).every((state) => state.pixels.length === expected.width * expected.height * 4)), `${id}: tampon complet`)
    // Aucune image vide : chaque image allume au moins un pixel.
    assert.ok(result.screenFrames.every((frame) => Object.values(frame).every((state) => state.pixels.some((value) => value !== 0))), `${id}: image non vide`)
  }
  // Les deux animations montrent bien plusieurs images distinctes.
  assert.ok(new Set(results.get('rotatingCube').screenFrames.map((frame) => JSON.stringify(frame))).size > 1, 'rotatingCube: images distinctes')
  assert.ok(new Set(results.get('rotatingTriangle').screenFrames.map((frame) => JSON.stringify(frame))).size > 1, 'rotatingTriangle: images distinctes')
})

test('les douze exemples transpilables : JavaScript et Python reproduisent la simulation', () => {
  for (const id of ['fibonacci', 'recursion', 'arrays', 'foreach', 'sorting', 'maths', 'imports', 'pointers', 'higherOrder', 'quickSort', 'coinChange', 'calculus']) {
    const project = examples.find((example) => example.id === id).build().project
    const expected = simulateProgram(project).output.map((line) => `${line}\n`).join('')
    const javascript = transpileProgram(project)
    assert.equal(javascript.ok, true, `${id}: JavaScript ${javascript.diagnostics.map((entry) => entry.code).join(' ')}`)
    const jsOutput = execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8', timeout: 3000 }).replace(/\r\n/g, '\n')
    assert.equal(jsOutput, expected, id)
    const python = transpileProgram(project, { target: 'python' })
    assert.equal(python.ok, true, `${id}: Python ${python.diagnostics.map((entry) => entry.code).join(' ')}`)
    const pyOutput = execFileSync('python', ['-c', python.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).replace(/\r\n/g, '\n')
    assert.equal(pyOutput, expected, id)
  }
})
