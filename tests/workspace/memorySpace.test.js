import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, createDebugSession } from '../../src/utils/logic/index.js'
import { buildMemorySpace, buildDebugValues, memoryValue } from '../../src/utils/memorySpace.js'
import { debugFixture } from '../logic/fixtures.js'

test('espace mémoire : segments de code, données globales et pile d’appels', () => {
  const project = debugFixture()
  const session = createDebugSession(project)
  const frame = session.frames.find((entry) => entry.nodeId === 'condition')
  const space = buildMemorySpace(createContextIndex(project), frame, session.reachability)

  assert.deepEqual(space.functions.map((fn) => fn.name), ['start', 'twice', 'unused'])
  assert.deepEqual(space.functions.map((fn) => fn.address), ['0x0100', '0x0108', '0x0110'])
  assert.equal(space.functions.find((fn) => fn.name === 'start').entry, true)
  assert.equal(space.functions.find((fn) => fn.name === 'unused').reachable, false)

  assert.equal(space.globals.length, 1)
  assert.equal(space.globals[0].name, 'g')
  assert.equal(space.globals[0].address, '0x1000')
  assert.equal(space.globals[0].value, 1)

  assert.equal(space.stack.length, 1)
  assert.equal(space.stack[0].address, '0x2000')
  assert.deepEqual(space.stack[0].variables.map((variable) => [variable.name, variable.address, variable.value]), [['x', '0x2008', 2]])
})

test('espace mémoire : frame absente et adresses illustratives stables', () => {
  const project = debugFixture()
  const index = createContextIndex(project)
  const empty = buildMemorySpace(index, null)
  assert.deepEqual(empty.globals, [])
  assert.deepEqual(empty.stack, [])
  assert.ok(empty.functions.length > 0)

  const again = buildMemorySpace(index, null)
  assert.deepEqual(again.functions.map((fn) => fn.address), empty.functions.map((fn) => fn.address))
  assert.equal(memoryValue('text'), '"text"')
  assert.equal(memoryValue(-0), '-0')
})

test('valeurs au survol : déclarations, références et paramètres du point d’arrêt', () => {
  const project = debugFixture()
  const session = createDebugSession(project)
  const index = createContextIndex(project, analyzeProgram(project))

  const atCondition = buildDebugValues(index, session.frames.find((entry) => entry.nodeId === 'condition'))
  assert.equal(atCondition.get('g').value, 1)
  assert.equal(atCondition.get('local').value, 2)
  assert.equal(atCondition.get('localRef').value, 2, 'une référence reprend la valeur de sa déclaration')

  const atIncrement = buildDebugValues(index, session.frames.find((entry) => entry.nodeId === 'increment'))
  assert.equal(atIncrement.get('n').value, 3)

  const beforeInit = buildDebugValues(index, session.frames.find((entry) => entry.nodeId === 'local'))
  assert.equal(beforeInit.get('local').initialized, false)
  assert.equal(buildDebugValues(index, null).size, 0)
})
