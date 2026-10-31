import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { initialNodeForm, nodeConfiguration } from '../../src/components/NodeForm/nodeConfiguration.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Construit un programme minimal dont l’entrée affiche une valeur constante.
function printProgram(value = 42) {
  const project = createProject('simulation')
  project.modules = [createModule('module', 'Simulation')]
  project.modules[0].rootNodeIds = ['main']
  project.nodes = [
    createNode('main', 'module', 'FunctionDeclaration', { properties: { name: 'main', type: voidType, entryPoint: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'module', 'Block', { children: { statements: ['print'] } }),
    createNode('print', 'module', 'PrintStatement', { children: { value: 'literal' } }),
    createNode('literal', 'module', 'Literal', { properties: { type: intType, value } }),
  ]
  return project
}

test('PrintStatement est typé et produit une sortie déterministe', () => {
  const project = printProgram()
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project)
  assert.deepEqual(result.output, ['42'])
  assert.deepEqual(result.trace, ['print', 'literal'])
})

test('la simulation refuse un programme qui possède des diagnostics bloquants', () => {
  const project = printProgram()
  project.nodes.find((node) => node.id === 'literal').properties.type = { kind: 'primitive', name: 'void' }
  const result = simulateProgram(project)
  assert.equal(result.ok, false)
  assert.equal(result.output.length, 0)
})

// Vérifie des valeurs non constantes pour ne pas déléguer les erreurs runtime au typage statique.
function binaryProgram(operator, left, right, name = 'int') {
  const project = printProgram()
  const type = { kind: 'primitive', name }
  project.nodes = project.nodes.filter((node) => node.id !== 'literal')
  project.nodes.find((node) => node.id === 'body').children.statements = ['x', 'y', 'print']
  project.nodes.find((node) => node.id === 'print').children.value = 'binary'
  project.nodes.push(
    createNode('x', 'module', 'VariableDeclaration', { properties: { name: 'x', type }, children: { initializer: 'leftLiteral' } }),
    createNode('y', 'module', 'VariableDeclaration', { properties: { name: 'y', type }, children: { initializer: 'rightLiteral' } }),
    createNode('leftLiteral', 'module', 'Literal', { properties: { type, value: left } }),
    createNode('rightLiteral', 'module', 'Literal', { properties: { type, value: right } }),
    createNode('binary', 'module', 'BinaryExpression', { properties: { operator }, children: { left: 'left', right: 'right' } }),
    createNode('left', 'module', 'Reference', { references: { target: { kind: 'node', nodeId: 'x' } } }),
    createNode('right', 'module', 'Reference', { references: { target: { kind: 'node', nodeId: 'y' } } }),
  )
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  return project
}

test('divisions : troncature entière uniquement, float et double respectés', () => {
  assert.deepEqual(simulateProgram(binaryProgram('/', 7, 2)).output, ['3'])
  assert.deepEqual(simulateProgram(binaryProgram('/', 7, 2, 'double')).output, ['3.5'])
  assert.deepEqual(simulateProgram(binaryProgram('/', 7, 2, 'float')).output, ['3.5'])
})

test('calculs runtime : dépassement, division par zéro et sous-flux refusés', () => {
  for (const [project, code] of [
    [binaryProgram('+', 2147483647, 1), 'NUMERIC_OVERFLOW'],
    [binaryProgram('/', 1, 0), 'DIVISION_BY_ZERO'],
    [binaryProgram('*', '1e-30', '1e-30', 'float'), 'NUMERIC_UNDERFLOW'],
  ]) {
    const result = simulateProgram(project)
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, code)
    assert.match(result.error, new RegExp(code))
  }
})

test('binaire32 arrondi à chaque opération et calcul entier exact', () => {
  assert.deepEqual(simulateProgram(binaryProgram('+', 16777216, 1, 'float')).output, ['16777216'])
  const project = binaryProgram('*', 2147483647, 2147483647)
  assert.match(simulateProgram(project).error, /NUMERIC_OVERFLOW/)
})

test('conversions explicites et identité textuelle appliquées dans la simulation', () => {
  for (const [from, to, value, expected] of [['double', 'int', '3.75', '3'], ['int', 'float', 16777217, '16777216'], ['string', 'string', 'hello', 'hello']]) {
    const project = printProgram(value)
    project.nodes.find((node) => node.id === 'literal').properties.type = { kind: 'primitive', name: from }
    project.nodes.find((node) => node.id === 'print').children.value = 'cast'
    project.nodes.push(createNode('cast', 'module', 'CastExpression', { properties: { type: { kind: 'primitive', name: to } }, children: { argument: 'literal' } }))
    assert.deepEqual(analyzeProgram(project).diagnostics, [])
    assert.deepEqual(simulateProgram(project).output, [expected])
  }
})

test('for vide sans condition : le budget borne réellement les itérations', () => {
  const project = printProgram()
  project.nodes = project.nodes.filter((node) => !['print', 'literal'].includes(node.id))
  project.nodes.find((node) => node.id === 'body').children.statements = ['loop']
  project.nodes.push(
    createNode('loop', 'module', 'ForStatement', { children: { initializer: null, test: null, update: null, body: 'loopBody' } }),
    createNode('loopBody', 'module', 'Block', { children: { statements: [] } }),
  )
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project, { maxSteps: 20 })
  assert.equal(result.ok, false)
  assert.match(result.error, /step limit/)
  assert.equal(result.errorCode, 'SIMULATION_STEP_LIMIT')
  assert.equal(result.trace.length, 20)
  for (const maxSteps of [NaN, Infinity, 0, -1, 1.5, 100001]) assert.equal(simulateProgram(project, { maxSteps }).ok, false)
})

test('alias de type sans effet runtime et lecture non initialisée refusée', () => {
  const project = binaryProgram('+', 1, 2)
  project.modules[0].rootNodeIds.unshift('alias')
  project.nodes.push(createNode('alias', 'module', 'TypeDeclaration', { properties: { name: 'Integer', type: intType } }))
  assert.deepEqual(simulateProgram(project).output, ['3'])
  project.nodes.find((node) => node.id === 'x').children.initializer = null
  project.nodes = project.nodes.filter((node) => node.id !== 'leftLiteral')
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  assert.match(simulateProgram(project).error, /before it was initialized/)
})

test('formulaire Print : type explicite transmis au littéral sans annoter l’instruction', () => {
  const form = initialNodeForm('PrintStatement', null, undefined, [])
  form.typeName = 'int'
  form.expression = { mode: 'literal', value: '42', empty: false }
  const draft = nodeConfiguration('PrintStatement', form, [])
  assert.deepEqual(draft.children.value.properties, { type: intType, value: '42' })
  assert.equal(draft.properties.type, undefined)
})

test('appels récursifs : arrêt contrôlé avant de déborder la pile JavaScript', () => {
  const project = printProgram()
  project.nodes = project.nodes.filter((node) => node.id !== 'literal')
  project.nodes.find((node) => node.id === 'body').children.statements = ['local', 'print']
  project.nodes.find((node) => node.id === 'print').children.value = 'call'
  project.nodes.push(
    createNode('local', 'module', 'VariableDeclaration', { properties: { name: 'local', type: intType }, children: { initializer: null } }),
    createNode('call', 'module', 'CallExpression', { children: { callee: 'callee', arguments: [] } }),
    createNode('callee', 'module', 'Reference', { references: { target: { kind: 'node', nodeId: 'recurse' } } }),
    createNode('recurse', 'module', 'FunctionDeclaration', { properties: { name: 'recurse', type: intType }, children: { parameters: [], body: 'recurseBody' } }),
    createNode('recurseBody', 'module', 'Block', { children: { statements: ['return'] } }),
    createNode('return', 'module', 'ReturnStatement', { children: { argument: 'recursiveCall' } }),
    createNode('recursiveCall', 'module', 'CallExpression', { children: { callee: 'recursiveCallee', arguments: [] } }),
    createNode('recursiveCallee', 'module', 'Reference', { references: { target: { kind: 'node', nodeId: 'recurse' } } }),
  )
  project.modules[0].rootNodeIds.push('recurse')
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project)
  assert.equal(result.ok, false)
  assert.match(result.error, /call depth limit/)
  assert.equal(result.errorCode, 'SIMULATION_CALL_LIMIT')
  assert.ok(result.steps < 10000)
})

test('for : update expression, continue puis break exécutés dans leur portée', () => {
  const project = binaryProgram('<', 0, 3)
  project.nodes.find((node) => node.id === 'body').children.statements = ['x', 'y', 'loop']
  project.nodes.find((node) => node.id === 'print').children.value = 'increment'
  project.nodes.push(
    createNode('loop', 'module', 'ForStatement', { children: { initializer: null, test: 'binary', update: 'updateCall', body: 'loopBody' } }),
    createNode('loopBody', 'module', 'Block', { children: { statements: ['print', 'continue'] } }),
    createNode('continue', 'module', 'ContinueStatement'),
    createNode('updateCall', 'module', 'CallExpression', { children: { callee: 'updateRef', arguments: [] } }),
    createNode('updateRef', 'module', 'Reference', { references: { target: { kind: 'node', nodeId: 'updateFunction' } } }),
    createNode('updateFunction', 'module', 'FunctionDeclaration', { properties: { name: 'update', type: voidType }, children: { parameters: [], body: 'updateBody' } }),
    createNode('updateBody', 'module', 'Block', { children: { statements: ['break'] } }),
    createNode('break', 'module', 'ReturnStatement', { children: { argument: null } }),
    createNode('increment', 'module', 'Literal', { properties: { type: intType, value: 1 } }),
  )
  project.modules[0].rootNodeIds.push('updateFunction')
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  // La boucle ne progresse pas : le contrôle recherché est le traitement de l'update expression.
  assert.match(simulateProgram(project, { maxSteps: 30 }).error, /step limit/)
  project.nodes.find((node) => node.id === 'continue').kind = 'BreakStatement'
  assert.equal(simulateProgram(project).ok, true)
})
