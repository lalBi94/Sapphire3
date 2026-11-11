import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { inputNumberCallbackId } from '../../src/utils/logic/inputNumberState.js'
import { evaluateExercise, validateExercise } from '../../src/utils/exercise.js'

// Reconstruit un modèle comme le fait l'ouverture depuis la barre de navigation.
function openTemplate(id) {
  const template = workspaceTemplates.find((entry) => entry.id === id)
  assert.ok(template, id)
  return deserializeWorkspace(JSON.stringify(template.build()))
}

test('modèles de workspace : catalogue, validité et absence de diagnostics', () => {
  assert.deepEqual(workspaceTemplates.map((entry) => entry.id), ['blank', 'inputOutput', 'widgetDashboard', 'classInstance', 'exercise'])
  for (const template of workspaceTemplates) {
    assert.ok(template.labelKey.startsWith('templates.'))
    assert.ok(template.descriptionKey.startsWith('templates.'))
    const workspace = openTemplate(template.id)
    assert.deepEqual(analyzeProgram(workspace.project).diagnostics, [], template.id)
  }
})

test('modèle vide : aucun module ni carte, sans point d’entrée', () => {
  const workspace = openTemplate('blank')
  assert.equal(workspace.project.modules.length, 0)
  assert.equal(workspace.presentation.cards.length, 0)
})

test('modèle entrée → sortie : entrée liée et sortie prête', () => {
  const workspace = openTemplate('inputOutput')
  const cards = workspace.presentation.cards
  assert.equal(cards.filter((card) => card.type === 'numberInput').length, 1)
  const input = workspace.project.modules.find((module) => module.inputNumber)
  assert.ok(input)
  assert.ok(inputNumberCallbackId(workspace.project, input.id))
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['Ready'])
})

test('modèle tableau de bord : widgets présents et animation bornée', () => {
  const workspace = openTemplate('widgetDashboard')
  const types = workspace.presentation.cards.map((card) => card.type)
  for (const type of ['screen', 'gauge', 'progress', 'barChart', 'led', 'rgbLed', 'module', 'comment']) {
    assert.ok(types.includes(type), type)
  }
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.ok(result.steps < 10000)
  assert.deepEqual(result.output, ['Dashboard ready'])
})

test('modèle classe + instance : classe privée et résultat attendu', () => {
  const workspace = openTemplate('classInstance')
  const classModule = workspace.project.modules.find((module) => module.kind === 'class')
  assert.ok(classModule)
  assert.equal(classModule.name, 'Counter')
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['3'])
})

test('modèle exercice : manifeste valide et test prêt à échouer sur le départ', async () => {
  const workspace = openTemplate('exercise')
  validateExercise(workspace.exercise)
  assert.equal(workspace.exercise.tests.length, 1)
  const summary = await evaluateExercise(workspace.project, workspace.exercise, (options) => simulateProgram(workspace.project, options))
  assert.equal(summary.total, 1)
  assert.equal(summary.passed, 0)
  assert.equal(summary.results[0].status, 'fail')
  assert.equal(summary.results[0].actual, '0')
})
