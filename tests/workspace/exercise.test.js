import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { createExercise, createEntryTest, createFunctionTest, evaluateExercise, exerciseNotification, findFunction, solutionFileName, summarizeExercise, validateExercise } from '../../src/utils/exercise.js'
import { createExerciseLock, verifyExerciseLock } from '../../src/utils/exerciseLock.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { program, root, node, intType, booleanType } from '../logic/fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
let sequence = 0
const ids = () => `test-${++sequence}`

// Construit un projet minimal avec un point d'entrée et une fonction pure.
function project() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['print'] })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'message' })
  node(source, 'm', 'message', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'ok' })
  root(source, 'm', 'add', 'FunctionDeclaration', { name: 'add', type: intType }, { parameters: ['a', 'b'], body: 'addBody' })
  node(source, 'm', 'a', 'Parameter', { name: 'a', type: intType })
  node(source, 'm', 'b', 'Parameter', { name: 'b', type: intType })
  node(source, 'm', 'addBody', 'Block', {}, { statements: ['return'] })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'sum' })
  node(source, 'm', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'left', right: 'right' })
  node(source, 'm', 'left', 'Reference', {}, {}, { target: { kind: 'name', name: 'a' } })
  node(source, 'm', 'right', 'Reference', {}, {}, { target: { kind: 'name', name: 'b' } })
  return source
}

const run = (source) => (options) => simulateProgram(source, options)

test('manifeste : création, validation et refus des formes invalides', () => {
  const exercise = createExercise({ title: 'Add two numbers', instructions: 'Implement add.' })
  assert.equal(exercise.version, 1)
  assert.deepEqual(exercise.tests, [])
  assert.equal(validateExercise(exercise), exercise)
  for (const invalid of [
    null,
    { version: 2, title: 'x', instructions: '', tests: [] },
    { version: 1, title: '', instructions: '', tests: [] },
    { version: 1, title: 'x', instructions: 3, tests: [] },
    { version: 1, title: 'x', instructions: '', tests: [{ id: 'a', kind: 'entry', title: 't', expectedOutput: 'no' }] },
    { version: 1, title: 'x', instructions: '', tests: [{ id: 'a', kind: 'function', title: 't', functionName: 'add', args: [{}], expectedReturn: null }] },
    { version: 1, title: 'x', instructions: '', tests: [{ id: 'a', kind: 'other', title: 't' }] },
  ]) assert.throws(() => validateExercise(invalid))
})

test('évaluation du point d’entrée : succès, échec et erreur du moteur', async () => {
  const source = project()
  const exercise = { ...createExercise({ title: 'Entry' }), tests: [createEntryTest('prints ok', ['ok'], ids)] }
  const passed = await evaluateExercise(source, exercise, run(source))
  assert.deepEqual(passed, { total: 1, passed: 1, failed: 0, results: [{ id: 'test-1', title: 'prints ok', kind: 'entry', status: 'pass', expected: ['ok'], actual: ['ok'] }] })
  assert.equal(summarizeExercise(passed).complete, true)
  const failing = { ...exercise, tests: [createEntryTest('wrong', ['nope'], ids)] }
  const failed = await evaluateExercise(source, failing, run(source))
  assert.equal(failed.results[0].status, 'fail')
  assert.deepEqual(failed.results[0].actual, ['ok'])
  assert.equal(summarizeExercise(failed).complete, false)
  const broken = { ...exercise, tests: [{ ...createEntryTest('missing entry', ['ok'], ids), kind: 'entry' }] }
  const empty = program('m')
  const error = await evaluateExercise(empty, broken, run(empty))
  assert.equal(error.results[0].status, 'error')
  assert.equal(error.results[0].errorCode, 'SIMULATION_ENTRY_MISSING')
})

test('évaluation de fonction : arguments, retour attendu et fonction absente', async () => {
  const source = project()
  const exercise = { ...createExercise({ title: 'Function' }), tests: [createFunctionTest('add 2 and 3', 'add', [2, 3], '5', ids)] }
  const result = await evaluateExercise(source, exercise, run(source))
  assert.equal(result.results[0].status, 'pass')
  assert.equal(result.results[0].actual, '5')
  const wrong = { ...exercise, tests: [createFunctionTest('wrong', 'add', [2, 3], '6', ids)] }
  assert.equal((await evaluateExercise(source, wrong, run(source))).results[0].status, 'fail')
  const missing = { ...exercise, tests: [createFunctionTest('missing', 'unknown', [], null, ids)] }
  const error = await evaluateExercise(source, missing, run(source))
  assert.equal(error.results[0].status, 'error')
  assert.equal(error.results[0].errorCode, 'EXERCISE_FUNCTION_MISSING')
  assert.deepEqual(findFunction(source, 'add'), { ok: true, id: 'add' })
  assert.equal(findFunction(source, 'nope').ok, false)
})

test('évaluation : nom de fonction ambigu refusé sans choisir au hasard', async () => {
  const source = project()
  node(source, 'm', 'duplicate', 'FunctionDeclaration', { name: 'add', type: intType }, { parameters: [], body: 'empty' })
  node(source, 'm', 'empty', 'Block', {}, { statements: [] })
  assert.equal(findFunction(source, 'add').code, 'EXERCISE_FUNCTION_AMBIGUOUS')
  const exercise = { ...createExercise({ title: 'Ambiguous' }), tests: [createFunctionTest('dup', 'add', [], null, ids)] }
  const result = await evaluateExercise(source, exercise, run(source))
  assert.equal(result.results[0].status, 'error')
})

test('évaluation : un lanceur qui échoue produit une erreur stable, sans interrompre les autres tests', async () => {
  const source = project()
  const exercise = { ...createExercise({ title: 'Failure' }), tests: [createEntryTest('first', ['ok'], ids), createEntryTest('second', ['ok'], ids)] }
  let calls = 0
  const result = await evaluateExercise(source, exercise, async () => {
    calls += 1
    if (calls === 1) throw Object.assign(new Error('boom'), { code: 'ENGINE_FAILED' })
    return { ok: true, output: ['ok'] }
  })
  assert.equal(result.results[0].status, 'error')
  assert.equal(result.results[1].status, 'pass')
  assert.equal(result.passed, 1)
})

test('workspace : le manifeste est exporté, relu et validé', () => {
  const source = project()
  const exercise = { ...createExercise({ title: 'Round trip', instructions: 'Do it.' }), tests: [createEntryTest('prints ok', ['ok'], ids), createFunctionTest('add', 'add', [1, 2], '3', ids)] }
  const card = { id: 'm', type: 'module', name: 'm', x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }
  const text = serializeWorkspace(source, [card], { x: 0, y: 0, zoomLevel: 0 }, null, exercise)
  const restored = deserializeWorkspace(text)
  assert.deepEqual(restored.exercise, exercise)
  const without = deserializeWorkspace(serializeWorkspace(source, [card], { x: 0, y: 0, zoomLevel: 0 }))
  assert.equal(without.exercise, undefined)
  assert.throws(() => serializeWorkspace(source, [card], { x: 0, y: 0, zoomLevel: 0 }, null, { version: 1, title: '', instructions: '', tests: [] }))
  const invalid = JSON.parse(text)
  invalid.exercise.tests[0].expectedOutput = 'nope'
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)))
})

test('snapshot de départ : validé, exporté et restauré sans perdre les tests', () => {
  const source = project()
  const card = { id: 'm', type: 'module', name: 'm', x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }
  const starter = { project: source, presentation: { cards: [card], camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null } }
  const exercise = { ...createExercise({ title: 'Starter', starter }), tests: [createEntryTest('prints ok', ['ok'], ids)] }
  assert.deepEqual(exercise.starter, starter)
  assert.throws(() => createExercise({ title: 'Bad', starter: { project: source } }))
  const text = serializeWorkspace(source, [card], { x: 0, y: 0, zoomLevel: 0 }, null, exercise)
  assert.deepEqual(deserializeWorkspace(text).exercise.starter, starter)
  const invalid = JSON.parse(text)
  invalid.exercise.starter.presentation.camera.zoomLevel = 99
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)))
})

test('notification du robot : succès seulement si tout passe, erreur sinon', () => {
  const t = (key, params) => `${key}:${JSON.stringify(params)}`
  assert.equal(exerciseNotification(null, t), null)
  assert.equal(exerciseNotification({ total: 0, passed: 0, failed: 0 }, t), null)
  const success = exerciseNotification({ total: 3, passed: 3, failed: 0 }, t)
  assert.equal(success.type, 'success')
  assert.equal(success.duration, 4500)
  assert.equal(success.key, 'exercise-result')
  assert.match(success.message, /exercise\.notifyPass/)
  const failure = exerciseNotification({ total: 3, passed: 1, failed: 2 }, t)
  assert.equal(failure.type, 'error')
  assert.equal(failure.duration, 6000)
  assert.match(failure.message, /exercise\.notifyFail/)
  assert.match(failure.message, /"failed":2/)
})

test('verrou d’édition : mot de passe haché, vérification et refus des formes invalides', async () => {
  const lock = await createExerciseLock('secret')
  assert.equal(lock.algorithm, 'PBKDF2-SHA256')
  assert.ok(lock.iterations >= 100000)
  assert.ok(lock.salt.length > 0 && lock.hash.length > 0)
  assert.equal(lock.password, undefined)
  assert.equal(await verifyExerciseLock('secret', lock), true)
  assert.equal(await verifyExerciseLock('wrong', lock), false)
  assert.equal(await verifyExerciseLock('', lock), false)
  assert.equal(await verifyExerciseLock('secret', null), false)
  assert.equal(await verifyExerciseLock('secret', { ...lock, algorithm: 'other' }), false)
  await assert.rejects(() => createExerciseLock('abc'))
  const exercise = { ...createExercise({ title: 'Locked' }), lock }
  assert.deepEqual(validateExercise(exercise), exercise)
  assert.throws(() => validateExercise({ ...exercise, lock: { ...lock, hash: '' } }))
})

test('nom de solution : portable sous Windows et lisible', () => {
  assert.equal(solutionFileName('Add two numbers'), 'Add two numbers-solution.zip')
  assert.equal(solutionFileName('a/b:c*?"<>|d'), 'a-b-c-d-solution.zip')
  assert.equal(solutionFileName('   '), 'exercise-solution.zip')
  assert.equal(solutionFileName('x'.repeat(200)).length, 80 + '-solution.zip'.length)
})

test('types booléens et arguments JSON restent explicites', async () => {
  const source = program('m')
  root(source, 'm', 'not', 'FunctionDeclaration', { name: 'not', type: booleanType }, { parameters: ['value'], body: 'body' })
  node(source, 'm', 'value', 'Parameter', { name: 'value', type: booleanType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['return'] })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'negated' })
  node(source, 'm', 'negated', 'UnaryExpression', { operator: 'not' }, { operand: 'operand' })
  node(source, 'm', 'operand', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  const exercise = { ...createExercise({ title: 'Boolean' }), tests: [createFunctionTest('not false', 'not', [false], 'true', ids)] }
  const result = await evaluateExercise(source, exercise, run(source))
  assert.equal(result.results[0].status, 'pass')
})
