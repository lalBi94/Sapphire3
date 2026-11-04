import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { examples, exampleCategories, exampleSubcategories } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { findFrameCycle } from '../../src/utils/screenPlayback.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const expectedOutput = {
  fibonacci: ['55'],
  sorting: ['1', '3', '5', '8'],
  quickSort: ['1', '3', '5', '8'],
  coinChange: ['6'],
  arrays: ['7', '4'],
  recursion: ['120'],
  imports: ['25'],
  foreach: ['3', '1', '4', '1', '5'],
  pointers: ['3', '8', '8', '3'],
  higherOrder: ['42'],
  maths: ['7', '3', '9', '9'],
  calculus: ['6', '0.3333333333333333'],
  pixelScreens: ['Logos bouncing'],
  rain: ['Rain'],
  gameOfLife: ['Game of life'],
}

test('bibliothèque d’exemples : chaque projet est valide, analysable et s’exécute', () => {
  assert.deepEqual(examples.map((example) => example.id), ['fibonacci', 'sorting', 'quickSort', 'coinChange', 'arrays', 'recursion', 'imports', 'foreach', 'pointers', 'higherOrder', 'maths', 'calculus', 'pixelScreens', 'rain', 'gameOfLife'])
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

test('exemple écrans pixel : deux logos qui rebondissent et une image par génération', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'pixelScreens').build()))
  const screens = workspace.presentation.cards.filter((card) => card.type === 'screen')
  assert.equal(screens.length, 2)
  assert.equal(screens[0].screenWidth, 30)
  assert.equal(screens[0].screenHeight, 18)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  // Une image par génération, grâce à `screenPresent` qui remplace la capture par écriture.
  assert.equal(result.screenFrames.length, 20)
  const position = (frame, id) => {
    const screen = frame[id]
    for (let index = 0; index < screen.pixels.length; index += 4) {
      if (screen.pixels[index + 3] > 0) return [index / 4 % screen.width, Math.floor(index / 4 / screen.width)]
    }
    return null
  }
  const first = position(result.screenFrames[0], 'screenOne')
  const middle = position(result.screenFrames[10], 'screenOne')
  assert.ok(first && middle)
  assert.notDeepEqual(first, middle)
  assert.equal(result.screenFrames[0].screenTwo.pixels.filter((value, index) => index % 4 === 3 && value > 0).length, 4)
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
})

test('exemple pluie matricielle : colonnes, traînée et une image par génération', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'rain').build()))
  const screen = workspace.presentation.cards.find((card) => card.type === 'screen')
  assert.equal(screen.screenWidth, 90)
  assert.equal(screen.screenHeight, 56)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.ok(result.screenFrames.length > 8)
  const counts = result.screenFrames.map((frame) => frame.rainScreen.pixels.filter((value, index) => index % 4 === 3 && value > 0).length)
  assert.ok(counts[0] > 0)
  assert.ok(counts[counts.length - 1] > counts[0])
  assert.equal(transpileProgram(workspace.project).code, 'TRANSPILE_SCREEN_UNSUPPORTED')
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
