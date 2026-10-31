import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, analyzeReachability, createDebugSession, moveDebugSession, simulateProgram, createProject, createModule, createNode } from '../../src/utils/logic/index.js'
import { debugFixture } from './fixtures.js'

const int = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const boolean = { kind: 'primitive', name: 'boolean' }

// Rend une source immuable afin de détecter toute mutation cachée lors de la capture.
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('debug : arrêts avant instruction, simulation identique et source non mutée', () => {
  const project = freeze(debugFixture())
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const normal = simulateProgram(project)
  const debug = createDebugSession(project)
  assert.equal(debug.errorCode, null)
  assert.deepEqual(debug.frames.map((frame) => frame.nodeId), ['g', 'main', 'local', 'condition', 'inner', 'callPrint', 'twice', 'increment', 'returnTwice', 'printAfter', 'returnMain', null])
  assert.deepEqual(debug.frames[0].output, [])
  assert.deepEqual(debug.frames.at(-1).output, normal.output)
  assert.deepEqual(normal.output, ['6', '2'])
  assert.equal(normal.debugFrames, undefined)
  assert.equal(debug.frames.at(-1).globals[0].value, 2)
})

test('mémoire : globaux, ombrage, paramètres, disparition des scopes et exclusion des locaux de l’appelant', () => {
  const { frames } = createDebugSession(debugFixture())
  assert.equal(frames[0].globals[0].initialized, false)
  const beforeLocal = frames.find((frame) => frame.nodeId === 'local')
  assert.equal(beforeLocal.localScopes[0].variables.find((variable) => variable.nodeId === 'local').initialized, false)
  const call = frames.find((frame) => frame.nodeId === 'callPrint')
  assert.deepEqual(call.localScopes.map((scope) => scope.variables.map((variable) => [variable.name, variable.value])), [[['x', 3]], [['x', 2]]])
  const callee = frames.find((frame) => frame.nodeId === 'twice')
  assert.deepEqual(callee.localScopes.flatMap((scope) => scope.variables.map((variable) => [variable.name, variable.value])), [['n', 3]])
  assert.equal(callee.callStack.length, 2)
  const after = frames.find((frame) => frame.nodeId === 'printAfter')
  assert.equal(after.localScopes.length, 1)
  assert.equal(after.localScopes[0].variables[0].value, 2)
  assert.deepEqual(frames.at(-1).localScopes, [])
})

test('mémoire : un flottant -0 conserve son signe dans les instantanés', () => {
  const project = debugFixture()
  const float = { kind: 'primitive', name: 'float' }
  project.nodes.find((node) => node.id === 'local').properties.type = float
  project.nodes.find((node) => node.id === 'two').properties = { type: float, value: '-0' }
  const session = createDebugSession(project)
  assert.equal(session.result.ok, true)
  const variable = session.frames.find((frame) => frame.nodeId === 'condition').localScopes[0].variables.find((entry) => entry.nodeId === 'local')
  assert.ok(Object.is(variable.value, -0))
})

test('commandes : suivant, sortie du scope et retour arrière restaurent mémoire et sorties', () => {
  let session = createDebugSession(debugFixture())
  for (let index = 0; index < 4; index += 1) session = moveDebugSession(session, 'next')
  assert.equal(session.frames[session.cursor].nodeId, 'inner')
  const before = session
  session = moveDebugSession(session, 'scope')
  assert.equal(session.frames[session.cursor].nodeId, 'printAfter')
  assert.deepEqual(session.frames[session.cursor].output, ['6'])
  assert.equal(session.frames[session.cursor].globals[0].value, 2)
  session = moveDebugSession(session, 'back')
  assert.equal(session.cursor, before.cursor)
  assert.deepEqual(session.frames[session.cursor].output, [])
  assert.equal(session.frames[session.cursor].globals[0].value, 1)
  assert.equal(before.cursor, 4)
  assert.equal(moveDebugSession(before, 'unknown'), before)
})

test('sortie du scope : initialise les globaux puis s’arrête à l’entrée ; retour après terminaison', () => {
  let session = createDebugSession(debugFixture())
  session = moveDebugSession(session, 'scope')
  assert.equal(session.frames[session.cursor].nodeId, 'main')
  session = moveDebugSession(session, 'scope')
  assert.equal(session.frames[session.cursor].status, 'completed')
  assert.equal(moveDebugSession(session, 'next'), session)
  session = moveDebugSession(session, 'back')
  assert.equal(session.frames[session.cursor].nodeId, 'main')
  assert.deepEqual(session.frames[session.cursor].output, [])
})

test('accessibilité : fonction utile et code après retour, sans modifier les diagnostics du programme', () => {
  const project = debugFixture()
  const result = analyzeReachability(project)
  assert.equal(result.ok, true)
  assert.deepEqual(result.functions, [{ nodeId: 'main', reachable: true }, { nodeId: 'twice', reachable: true }, { nodeId: 'unused', reachable: false }])
  assert.deepEqual(new Set(result.unreachableNodeIds), new Set(['deadPrint', 'deadValue', 'unused', 'unusedBody']))
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
})

test('accessibilité conservatrice : branche littérale exclue, condition variable gardant ses deux possibilités', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'true').properties.value = false
  const known = analyzeReachability(project)
  assert.ok(known.unreachableNodeIds.includes('branch'))
  assert.ok(known.unreachableNodeIds.includes('twice'))
  assert.ok(known.reachableNodeIds.includes('printAfter'))
  project.nodes.find((node) => node.id === 'mainBody').children.statements.unshift('flag')
  project.nodes.push(createNode('flag', 'm', 'VariableDeclaration', { properties: { name: 'flag', type: boolean }, children: { initializer: 'falseLiteral' } }), createNode('falseLiteral', 'm', 'Literal', { properties: { type: boolean, value: false } }))
  const condition = project.nodes.find((node) => node.id === 'true')
  condition.kind = 'Reference'
  condition.properties = {}
  condition.references = { target: { kind: 'node', nodeId: 'flag' } }
  const unknown = analyzeReachability(project)
  assert.equal(unknown.ok, true)
  assert.ok(unknown.reachableNodeIds.includes('branch'))
  assert.ok(unknown.reachableNodeIds.includes('twice'))
  assert.deepEqual(simulateProgram(project).output, ['2'])
})

test('erreurs : programme invalide refusé et échec runtime consultable puis réversible', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'local').children.initializer = null
  project.nodes = project.nodes.filter((node) => node.id !== 'two')
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  let session = createDebugSession(project)
  assert.equal(session.frames.at(-1).errorCode, 'SIMULATION_UNINITIALIZED')
  session = moveDebugSession(session, 'scope')
  session = moveDebugSession(session, 'scope')
  assert.equal(session.frames[session.cursor].status, 'error')
  assert.ok(session.frames[session.cursor].localScopes.every((scope) => scope.nodeId !== 'branch'))
  session = moveDebugSession(session, 'back')
  assert.equal(session.frames[session.cursor].nodeId, 'main')
  project.nodes.find((node) => node.id === 'main').properties.type = null
  const invalid = createDebugSession(project)
  assert.equal(invalid.errorCode, 'SIMULATION_DIAGNOSTICS')
  assert.deepEqual(invalid.frames, [])
  assert.equal(invalid.reachability.ok, false)
})

test('limites : boucle vide bornée, historique mémoire borné et arrêts terminaux disponibles', () => {
  const project = createProject('limits')
  project.modules = [createModule('m', 'Limits')]
  project.modules[0].rootNodeIds = ['main']
  project.nodes = [
    createNode('main', 'm', 'FunctionDeclaration', { properties: { name: 'start', type: voidType, entryPoint: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'm', 'Block', { children: { statements: ['loop'] } }),
    createNode('loop', 'm', 'ForStatement', { children: { initializer: null, test: null, update: null, body: 'loopBody' } }),
    createNode('loopBody', 'm', 'Block', { children: { statements: [] } }),
  ]
  let session = createDebugSession(project, { maxSteps: 30 })
  assert.equal(session.frames.at(-1).errorCode, 'SIMULATION_STEP_LIMIT')
  project.nodes.find((node) => node.id === 'loopBody').children.statements.push('print')
  project.nodes.push(createNode('print', 'm', 'PrintStatement', { children: { value: 'value' } }), createNode('value', 'm', 'Literal', { properties: { type: int, value: 0 } }))
  session = createDebugSession(project)
  assert.equal(session.frames.at(-1).errorCode, 'DEBUG_HISTORY_LIMIT')
  assert.ok(session.frames.length < 10000)
  assert.equal(session.frames.at(-1).status, 'error')
  assert.equal(simulateProgram(project).errorCode, 'SIMULATION_STEP_LIMIT')
})

test('for : activations de corps distinctes, initialiseur visible dans la boucle seulement et sorties réversibles', () => {
  const project = createProject('loop')
  project.modules = [createModule('m', 'Loop')]
  project.modules[0].rootNodeIds = ['main']
  const n = (id, kind, properties = {}, children = {}, references = {}) => createNode(id, 'm', kind, { properties, children, references })
  const ref = (id) => n(id, 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'i' } })
  project.nodes = [
    n('main', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' }), n('body', 'Block', {}, { statements: ['loop', 'after'] }),
    n('loop', 'ForStatement', {}, { initializer: 'i', test: 'test', update: 'update', body: 'innerBody' }),
    n('i', 'VariableDeclaration', { name: 'i', type: int }, { initializer: 'zero' }), n('zero', 'Literal', { type: int, value: 0 }),
    n('test', 'BinaryExpression', { operator: '<' }, { left: 'testRef', right: 'limit' }), ref('testRef'), n('limit', 'Literal', { type: int, value: 2 }),
    n('update', 'AssignmentStatement', {}, { target: 'target', value: 'plus' }), ref('target'),
    n('plus', 'BinaryExpression', { operator: '+' }, { left: 'plusRef', right: 'one' }), ref('plusRef'), n('one', 'Literal', { type: int, value: 1 }),
    n('innerBody', 'Block', {}, { statements: ['print'] }), n('print', 'PrintStatement', {}, { value: 'printRef' }), ref('printRef'),
    n('after', 'PrintStatement', {}, { value: 'end' }), n('end', 'Literal', { type: int, value: 9 }),
  ]
  const session = createDebugSession(project)
  assert.equal(session.result.ok, true)
  const bodies = session.frames.filter((frame) => frame.nodeId === 'print')
  assert.equal(bodies.length, 2)
  assert.notEqual(bodies[0].localScopes[0].instanceId, bodies[1].localScopes[0].instanceId)
  assert.deepEqual(bodies.map((frame) => frame.localScopes.find((scope) => scope.scopeId === 'for:loop').variables[0].value), [0, 1])
  assert.ok(session.frames.find((frame) => frame.nodeId === 'after').localScopes.every((scope) => scope.scopeId !== 'for:loop'))
  assert.deepEqual(session.frames.at(-1).output, ['0', '1', '9'])
  const atLoop = { ...session, cursor: session.frames.findIndex((frame) => frame.nodeId === 'loop') }
  const skipped = moveDebugSession(atLoop, 'scope')
  assert.equal(skipped.frames[skipped.cursor].nodeId, 'after')
  assert.deepEqual(skipped.frames[skipped.cursor].output, ['0', '1'])
})

test('accessibilité intermodules : appels importés et récursion sans analyse infinie', () => {
  const project = debugFixture()
  project.modules.push(createModule('lib', 'Library'))
  const unusedIds = new Set(['unused', 'unusedBody'])
  project.modules[0].rootNodeIds = project.modules[0].rootNodeIds.filter((id) => id !== 'unused')
  project.modules[1].rootNodeIds = ['unused']
  project.modules[1].exports = [{ name: 'loop', nodeId: 'unused' }]
  project.modules[0].imports = [{ id: 'loopImport', moduleId: 'lib', nodeId: 'unused', localName: 'loop' }]
  for (const node of project.nodes) if (unusedIds.has(node.id)) node.moduleId = 'lib'
  project.nodes.find((node) => node.id === 'mainBody').children.statements.unshift('invoke')
  project.nodes.find((node) => node.id === 'unusedBody').children.statements = ['recursiveStatement']
  project.nodes.push(
    createNode('invoke', 'm', 'ExpressionStatement', { children: { expression: 'importCall' } }), createNode('importCall', 'm', 'CallExpression', { children: { callee: 'importRef', arguments: [] } }), createNode('importRef', 'm', 'Reference', { references: { target: { kind: 'import', importId: 'loopImport' } } }),
    createNode('recursiveStatement', 'lib', 'ExpressionStatement', { children: { expression: 'recursiveCall' } }), createNode('recursiveCall', 'lib', 'CallExpression', { children: { callee: 'recursiveRef', arguments: [] } }), createNode('recursiveRef', 'lib', 'Reference', { references: { target: { kind: 'node', nodeId: 'unused' } } }),
  )
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const reachable = analyzeReachability(project)
  assert.equal(reachable.functions.find((entry) => entry.nodeId === 'unused').reachable, true)
  const session = createDebugSession(project)
  assert.equal(session.frames.at(-1).errorCode, 'SIMULATION_CALL_LIMIT')
  assert.ok(session.frames.at(-1).localScopes.every((scope) => scope.nodeId === 'unused'))
})

test('accessibilité : sortie de boucle et code après boucle infinie', () => {
  const project = debugFixture()
  const condition = project.nodes.find((node) => node.id === 'condition')
  condition.kind = 'WhileStatement'
  condition.children = { test: 'true', body: 'branch' }
  project.nodes.find((node) => node.id === 'branch').children.statements = ['inner', 'callPrint', 'break', 'deadInLoop']
  project.nodes.push(createNode('break', 'm', 'BreakStatement'), createNode('deadInLoop', 'm', 'PrintStatement', { children: { value: 'deadLoopValue' } }), createNode('deadLoopValue', 'm', 'Literal', { properties: { type: int, value: 8 } }))
  const withBreak = analyzeReachability(project)
  assert.ok(withBreak.unreachableNodeIds.includes('deadInLoop'))
  assert.ok(withBreak.reachableNodeIds.includes('printAfter'))
  project.nodes.find((node) => node.id === 'break').kind = 'ContinueStatement'
  const forever = analyzeReachability(project)
  assert.ok(forever.unreachableNodeIds.includes('printAfter'))
  assert.ok(forever.unreachableNodeIds.includes('returnMain'))
  project.nodes.find((node) => node.id === 'true').properties.value = false
  const never = analyzeReachability(project)
  assert.ok(never.unreachableNodeIds.includes('branch'))
  assert.ok(never.reachableNodeIds.includes('printAfter'))
})

test('accessibilité : court-circuit booléen sans considérer un appel ignoré comme une fonction utile', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'true').properties.value = false
  project.nodes.find((node) => node.id === 'condition').children.test = 'and'
  project.nodes.find((node) => node.id === 'unused').properties.type = boolean
  project.nodes.find((node) => node.id === 'unusedBody').children.statements = ['returnFalse']
  project.nodes.push(
    createNode('and', 'm', 'BinaryExpression', { properties: { operator: 'and' }, children: { left: 'true', right: 'booleanCall' } }),
    createNode('booleanCall', 'm', 'CallExpression', { children: { callee: 'booleanRef', arguments: [] } }), createNode('booleanRef', 'm', 'Reference', { references: { target: { kind: 'node', nodeId: 'unused' } } }),
    createNode('returnFalse', 'm', 'ReturnStatement', { children: { argument: 'falseValue' } }), createNode('falseValue', 'm', 'Literal', { properties: { type: boolean, value: false } }),
  )
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = analyzeReachability(project)
  for (const id of ['booleanCall', 'booleanRef', 'unused', 'branch', 'twice']) assert.ok(result.unreachableNodeIds.includes(id), id)
  assert.deepEqual(simulateProgram(project).output, ['2'])
})
