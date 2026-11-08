import test from 'node:test'
import assert from 'node:assert/strict'
import { examples } from '../../src/utils/examples.js'
import { showcaseExamples } from '../../src/utils/showcaseExamples.js'
import { analyzeProgram, simulateProgram, createContextIndex, getModuleLinks } from '../../src/utils/logic/index.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { parseMathText, renderMath } from '../../src/utils/mathText.js'

// Exécute la source réelle de la bibliothèque, jamais un calcul JavaScript de substitution.
function run(id) {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === id).build()))
  const before = JSON.stringify(workspace)
  const analysis = analyzeProgram(workspace.project)
  assert.deepEqual(analysis.diagnostics, [], id)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, `${id}: ${result.errorCode}`)
  assert.ok(result.steps < 10000, id)
  assert.equal(JSON.stringify(workspace), before)
  const links = getModuleLinks(createContextIndex(workspace.project, analysis))
  assert.ok(links.some((link) => link.fromId === `${id}Math` && link.toId === `${id}App`), id)
  const note = workspace.presentation.cards.find((card) => card.type === 'comment')
  const formula = parseMathText(note.text).find((segment) => segment.kind === 'math')
  assert.ok(formula, id)
  assert.ok(!renderMath(formula.value).includes('katex-error'), id)
  return { workspace, result }
}

test('vitrine : six créations à modules séparés, valides et exécutables', () => {
  assert.equal(showcaseExamples.length, 6)
  for (const entry of showcaseExamples) run(entry.id)
})

test('vitrine : signaux vérifiés sur tous les échantillons', () => {
  const signals = [
    ['chirpRibbon', (x) => Math.sin(0.6 * x * x)],
    ['wavePacket', (x) => Math.pow(Math.E, -0.12 * x * x) * Math.cos(3 * x)],
  ]
  for (const [id, expected] of signals) {
    const { result } = run(id)
    const state = result.xyPlots[`${id}Plot`]
    assert.equal(state.points.length, 64)
    for (const [x, y] of state.points) assert.ok(Math.abs(y - expected(x)) < 1e-10, id)
  }
  const { result } = run('harmonicStudio')
  const state = result.oscilloscopes.harmonicStudioScope
  const expected = [
    (x) => Math.sin(x),
    (x) => Math.sin(x) + 0.4 * Math.sin(3 * x),
    (x) => Math.sin(3 * x) * Math.cos(0.35 * x),
  ]
  assert.equal(state.channels.length, 3)
  for (const [index, channel] of state.channels.entries()) {
    assert.equal(channel.values.length, state.samples)
    channel.values.forEach((y, sample) => {
      const x = state.xMin + (state.xMax - state.xMin) * sample / (state.samples - 1)
      assert.ok(Math.abs(y - expected[index](x)) < 1e-10)
    })
  }
})

test('vitrine : écrans progressifs et classe Rotor réellement utilisée', () => {
  for (const [id, frames] of [['neonRose', 32], ['orbitalTrails', 64]]) {
    const { workspace, result } = run(id)
    assert.equal(result.screenFrames.length, frames)
    const screenId = `${id}Screen`
    const pictures = result.screenFrames.map((frame) => JSON.stringify(frame[screenId].pixels))
    assert.ok(new Set(pictures).size > frames / 2)
    assert.ok(result.screens[screenId].pixels.some((value, index) => index % 4 !== 3 && value > 30))
    if (id === 'orbitalTrails') {
      assert.ok(workspace.project.modules.some((module) => module.kind === 'class' && module.id === 'orbitalRotor'))
      assert.ok(workspace.project.nodes.some((node) => node.kind === 'NewExpression' && node.properties.classId === 'orbitalRotor'))
    }
  }
})

test('vitrine : système solaire, orbites et couleurs des huit planètes', () => {
  const { workspace, result } = run('solarSystem')
  assert.equal(result.screenFrames.length, 26)
  assert.equal(result.screens.solarSystemScreen.width, 128)
  assert.equal(result.screens.solarSystemScreen.height, 96)
  const pictures = result.screenFrames.map((frame) => JSON.stringify(frame.solarSystemScreen.pixels))
  assert.equal(new Set(pictures).size, 26)
  const colors = new Set()
  const pixels = result.screens.solarSystemScreen.pixels
  for (let index = 0; index < pixels.length; index += 4) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
  for (const color of ['190,190,200', '235,215,160', '70,150,255', '230,110,80', '230,170,100', '235,210,130', '120,230,235', '90,130,255', '255,245,150', '255,190,60', '35,45,80', '220,240,255']) {
    assert.ok(colors.has(color), color)
  }
  assert.ok(workspace.project.modules.some((module) => module.screen?.width === 128 && module.screen?.height === 96))
  const note = workspace.presentation.cards.find((card) => card.type === 'comment')
  assert.match(note.text, /képlériennes/)
})
