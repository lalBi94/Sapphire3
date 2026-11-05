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
}

test('bibliothèque d’exemples : chaque projet est valide, analysable et s’exécute', () => {
  assert.deepEqual(examples.map((example) => example.id), ['fibonacci', 'recursion', 'arrays', 'foreach', 'sorting', 'maths', 'imports', 'pointers', 'higherOrder', 'quickSort', 'coinChange', 'gaugeDemo', 'carDashboard', 'pixelScreens', 'rain', 'knapsack', 'calculus', 'gameOfLife', 'roverSurvey', 'signalLab'])
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
    const horizontal = x >= 2 && x <= 23 && y >= 3 && y <= 5
    const vertical = x >= 2 && x <= 5 && y >= 3 && y <= 17
    assert.ok(horizontal || vertical, 'artefact dans un couloir dégagé')
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
  const sourceKinds = Object.keys(nodeSchema).filter((kind) => kind !== 'Hole')
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

test('exemples multi-modules algorithmiques et mathématiques : JavaScript et Python reproduisent la simulation', () => {
  for (const id of ['quickSort', 'coinChange', 'calculus']) {
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
