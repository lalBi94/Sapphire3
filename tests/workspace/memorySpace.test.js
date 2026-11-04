import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, createDebugSession } from '../../src/utils/logic/index.js'
import { buildMemorySpace, buildDebugValues, memoryValue, buildPointerGraph } from '../../src/utils/memorySpace.js'
import { debugFixture, program, root, node, intType } from '../logic/fixtures.js'

const intPointer = { kind: 'pointer', pointee: intType }

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

test('graphe de pointeurs : cibles de variables et de cases, adresses et portées actives', () => {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressOfX' })
  node(source, 'm', 'addressOfX', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  root(source, 'm', 'data', 'VariableDeclaration', { name: 'data', type: { kind: 'array', elementType: intType } }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['two', 'three', 'four'] })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'three', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'four', 'Literal', { type: intType, value: 4 })
  root(source, 'm', 'pe', 'VariableDeclaration', { name: 'pe', type: intPointer }, { initializer: 'addressOfElement' })
  node(source, 'm', 'addressOfElement', 'UnaryExpression', { operator: '&' }, { operand: 'element' })
  node(source, 'm', 'element', 'ArrayAccess', {}, { array: 'dataRef', index: 'oneIndex' })
  node(source, 'm', 'dataRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'data' } })
  node(source, 'm', 'oneIndex', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: [] })

  const session = createDebugSession(source)
  const frame = session.frames.find((entry) => entry.globals.some((variable) => variable.name === 'pe' && variable.initialized))
  assert.ok(frame)
  const index = createContextIndex(source, analyzeProgram(source))
  const graph = buildPointerGraph(index, frame)
  assert.equal(graph.hasPointers, true)
  assert.equal(graph.edges.length, 2)
  assert.ok(graph.edges.every((edge) => edge.resolved))
  assert.ok(graph.groups.some((group) => group.kind === 'global'))
  assert.ok(graph.groups.some((group) => group.kind === 'scope'))
  const pointer = frame.globals.find((variable) => variable.name === 'p')
  assert.equal(pointer.pointer.kind, 'reference')
  assert.equal(pointer.pointer.nodeId, 'x')
  const element = frame.globals.find((variable) => variable.name === 'pe')
  assert.equal(element.pointer.kind, 'element')
  assert.equal(element.pointer.arrayNodeId, 'data')
  assert.equal(element.pointer.index, 1)
  const data = graph.variables.find((variable) => variable.name === 'data')
  assert.equal(data.cells.length, 3)
  assert.ok(graph.edges.some((edge) => edge.to === `${data.id}:cell:1`))
})
