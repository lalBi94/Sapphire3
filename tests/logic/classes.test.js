import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createModule, createNode, createProject, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { deserializeWorkspace, serializeWorkspace } from '../../src/utils/workspaceFile.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const classCounterType = { kind: 'class', classId: 'counter' }

// Ajoute un nœud au projet sans l'attacher automatiquement.
function add(project, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  const entry = createNode(id, moduleId, kind, { properties, children, references })
  project.nodes.push(entry)
  return entry
}

// Rattache un nœud à la racine d'un module.
function root(project, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  add(project, moduleId, id, kind, properties, children, references)
  project.modules.find((module) => module.id === moduleId).rootNodeIds.push(id)
  return id
}

// Référence un nœud déclaré dans le même module.
function reference(project, moduleId, id, target) {
  return add(project, moduleId, id, 'Reference', {}, {}, { target: { kind: 'node', nodeId: target } })
}

// Construit une classe Counter et une fonction main qui l'instancie et l'utilise.
function counterProject() {
  const project = createProject('classes')
  project.modules = [createModule('counter', 'Counter', 'class'), createModule('app', 'App')]

  // Champs publics et privés.
  root(project, 'counter', 'valueField', 'VariableDeclaration', { name: 'value', type: intType, visibility: 'public' }, { initializer: 'zero' })
  add(project, 'counter', 'zero', 'Literal', { type: intType, value: 0 })
  root(project, 'counter', 'secretField', 'VariableDeclaration', { name: 'secret', type: intType, visibility: 'private' }, { initializer: 'secretValue' })
  add(project, 'counter', 'secretValue', 'Literal', { type: intType, value: 42 })

  // Constructeur public : value = start.
  root(project, 'counter', 'constructor', 'FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: ['startParam'], body: 'constructorBody' })
  add(project, 'counter', 'startParam', 'Parameter', { name: 'start', type: intType })
  add(project, 'counter', 'constructorBody', 'Block', {}, { statements: ['assignStart'] })
  add(project, 'counter', 'assignStart', 'AssignmentStatement', {}, { target: 'thisValueStart', value: 'startRef' })
  add(project, 'counter', 'thisValueStart', 'MemberExpression', { name: 'value' }, { object: 'thisStart' })
  add(project, 'counter', 'thisStart', 'ThisExpression')
  reference(project, 'counter', 'startRef', 'startParam')

  // Méthode publique increment : this.value = this.value + 1.
  root(project, 'counter', 'increment', 'FunctionDeclaration', { name: 'increment', type: voidType, visibility: 'public' }, { parameters: [], body: 'incrementBody' })
  add(project, 'counter', 'incrementBody', 'Block', {}, { statements: ['assignIncrement'] })
  add(project, 'counter', 'assignIncrement', 'AssignmentStatement', {}, { target: 'thisValueIncrement', value: 'plusOne' })
  add(project, 'counter', 'thisValueIncrement', 'MemberExpression', { name: 'value' }, { object: 'thisIncrementTarget' })
  add(project, 'counter', 'thisIncrementTarget', 'ThisExpression')
  add(project, 'counter', 'plusOne', 'BinaryExpression', { operator: '+' }, { left: 'thisValueRead', right: 'one' })
  add(project, 'counter', 'thisValueRead', 'MemberExpression', { name: 'value' }, { object: 'thisIncrementRead' })
  add(project, 'counter', 'thisIncrementRead', 'ThisExpression')
  add(project, 'counter', 'one', 'Literal', { type: intType, value: 1 })

  // Méthode publique getSecret : retourne le champ privé secret.
  root(project, 'counter', 'getSecret', 'FunctionDeclaration', { name: 'getSecret', type: intType, visibility: 'public' }, { parameters: [], body: 'getSecretBody' })
  add(project, 'counter', 'getSecretBody', 'Block', {}, { statements: ['returnSecret'] })
  add(project, 'counter', 'returnSecret', 'ReturnStatement', {}, { argument: 'thisSecret' })
  add(project, 'counter', 'thisSecret', 'MemberExpression', { name: 'secret' }, { object: 'thisSecretObject' })
  add(project, 'counter', 'thisSecretObject', 'ThisExpression')

  // main : Counter c = new Counter(5); c.increment(); print c.value; print c.getSecret().
  root(project, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  add(project, 'app', 'mainBody', 'Block', {}, { statements: ['counterDecl', 'incrementCall', 'printValue', 'printSecret'] })
  add(project, 'app', 'counterDecl', 'VariableDeclaration', { name: 'c', type: classCounterType }, { initializer: 'newCounter' })
  add(project, 'app', 'newCounter', 'NewExpression', { classId: 'counter' }, { arguments: ['five'] })
  add(project, 'app', 'five', 'Literal', { type: intType, value: 5 })
  add(project, 'app', 'incrementCall', 'ExpressionStatement', {}, { expression: 'incrementExpression' })
  add(project, 'app', 'incrementExpression', 'CallExpression', {}, { callee: 'incrementMember', arguments: [] })
  add(project, 'app', 'incrementMember', 'MemberExpression', { name: 'increment' }, { object: 'counterRef' })
  reference(project, 'app', 'counterRef', 'counterDecl')
  add(project, 'app', 'printValue', 'PrintStatement', {}, { value: 'valueMember' })
  add(project, 'app', 'valueMember', 'MemberExpression', { name: 'value' }, { object: 'counterValueRef' })
  reference(project, 'app', 'counterValueRef', 'counterDecl')
  add(project, 'app', 'printSecret', 'PrintStatement', {}, { value: 'secretCall' })
  add(project, 'app', 'secretCall', 'CallExpression', {}, { callee: 'secretMember', arguments: [] })
  add(project, 'app', 'secretMember', 'MemberExpression', { name: 'getSecret' }, { object: 'counterSecretRef' })
  reference(project, 'app', 'counterSecretRef', 'counterDecl')

  return project
}

test('classes : instanciation, constructeur, attributs, méthodes et this', () => {
  const analysis = analyzeProgram(counterProject())
  assert.equal(analysis.canGenerate, true, analysis.diagnostics.map((entry) => entry.code).join(', '))
  const result = simulateProgram(counterProject())
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['6', '42'])
})

test('classes : le workspace conserve les scopes, les instances et les types de classe', () => {
  const project = counterProject()
  const cards = project.modules.map((module) => ({
    id: module.id,
    type: module.kind === 'class' ? 'class' : 'module',
    name: module.name,
    x: 0,
    y: 0,
    width: module.kind === 'class' ? 340 : 320,
    height: module.kind === 'class' ? 240 : 220,
    expandedNodeIds: [],
  }))
  const workspace = deserializeWorkspace(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
  assert.equal(workspace.project.modules.find((module) => module.id === 'counter').kind, 'class')
  assert.equal(workspace.project.nodes.find((node) => node.id === 'secretField').properties.visibility, 'private')
  assert.equal(workspace.project.nodes.find((node) => node.id === 'counterDecl').properties.type.kind, 'class')
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['6', '42'])
})

test('classes : la transpilation reste refusée tant que la cible ne porte pas les instances', () => {
  const result = transpileProgram(counterProject())
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TRANSPILE_CLASS_UNSUPPORTED')
})

test('classes : un membre privé reste inaccessible hors de la classe', () => {
  const project = counterProject()
  root(project, 'app', 'peek', 'FunctionDeclaration', { name: 'peek', type: intType }, { parameters: ['peekParam'], body: 'peekBody' })
  add(project, 'app', 'peekParam', 'Parameter', { name: 'c', type: classCounterType })
  add(project, 'app', 'peekBody', 'Block', {}, { statements: ['returnPeek'] })
  add(project, 'app', 'returnPeek', 'ReturnStatement', {}, { argument: 'privateMember' })
  add(project, 'app', 'privateMember', 'MemberExpression', { name: 'secret' }, { object: 'counterPeekRef' })
  reference(project, 'app', 'counterPeekRef', 'peekParam')
  const analysis = analyzeProgram(project)
  assert.equal(analysis.canGenerate, false)
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.field === 'properties.name'))
})

test('classes : une instruction libre est refusée dans le scope de classe', () => {
  const project = counterProject()
  project.modules.find((module) => module.id === 'counter').rootNodeIds.push('freePrint')
  add(project, 'counter', 'freePrint', 'PrintStatement', {}, { value: 'one' })
  const analysis = analyzeProgram(project)
  assert.equal(analysis.canGenerate, false)
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'STRUCTURE_INVALID' && entry.location.nodeId === 'freePrint'))
})

test('classes : this est refusé hors d’une méthode', () => {
  const project = createProject('this-outside')
  project.modules = [createModule('app', 'App')]
  root(project, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  add(project, 'app', 'body', 'Block', {}, { statements: ['thisExpression'] })
  add(project, 'app', 'thisExpression', 'ExpressionStatement', {}, { expression: 'thisNode' })
  add(project, 'app', 'thisNode', 'ThisExpression')
  const analysis = analyzeProgram(project)
  assert.equal(analysis.canGenerate, false)
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'PLACEMENT_ILLEGAL'))
})
