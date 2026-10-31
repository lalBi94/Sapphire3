import { createProject, createModule, createNode } from '../../src/utils/logic/index.js'

export const intType = { kind: 'primitive', name: 'int' }
export const booleanType = { kind: 'primitive', name: 'boolean' }
export const stringType = { kind: 'primitive', name: 'string' }

// Prépare les modules nécessaires à chaque scénario, sans dépendance au canvas.
export function program(...moduleIds) {
  const source = createProject('project')
  source.modules = moduleIds.map((id) => createModule(id, id))
  return source
}

// Ajoute un enregistrement source en laissant la syntaxe indépendante de son rangement.
export function node(source, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  const entry = createNode(id, moduleId, kind, { properties, children, references })
  source.nodes.push(entry)
  return entry
}

// Rattache explicitement un nœud à la liste des racines de son module.
export function root(source, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  const entry = node(source, moduleId, id, kind, properties, children, references)
  source.modules.find((module) => module.id === moduleId).rootNodeIds.push(id)
  return entry
}

// Exemple du rapport : une constante publique et une variable qui la référence ailleurs.
export function twoModules() {
  const source = program('math', 'app')
  root(source, 'math', 'answer', 'ConstantDeclaration', { name: 'answer', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'math', 'fortyTwo', 'Literal', { value: 42, type: intType })
  source.modules[0].exports.push({ nodeId: 'answer', name: 'answer' })
  source.modules[1].imports.push({ id: 'answerImport', moduleId: 'math', nodeId: 'answer', localName: 'answer' })
  root(source, 'app', 'result', 'VariableDeclaration', { name: 'result', type: intType }, { initializer: 'answerReference' })
  node(source, 'app', 'answerReference', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })
  return source
}

// Prépare les portées, l'appel et les fragments morts utilisés par les contrôles du débogueur.
export function debugFixture() {
  const project = createProject('debug')
  project.modules = [createModule('m', 'Debug')]
  project.modules[0].rootNodeIds = ['g', 'main', 'twice', 'unused']
  const int = intType
  const boolean = booleanType
  const voidType = { kind: 'primitive', name: 'void' }
  const make = (id, kind, properties = {}, children = {}, references = {}) => createNode(id, 'm', kind, { properties, children, references })
  const reference = (id, target) => make(id, 'Reference', {}, {}, { target: { kind: 'node', nodeId: target } })
  project.nodes = [
    make('g', 'VariableDeclaration', { name: 'g', type: int }, { initializer: 'one' }), make('one', 'Literal', { type: int, value: 1 }),
    make('main', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' }),
    make('mainBody', 'Block', {}, { statements: ['local', 'condition', 'printAfter', 'returnMain', 'deadPrint'] }),
    make('local', 'VariableDeclaration', { name: 'x', type: int }, { initializer: 'two' }), make('two', 'Literal', { type: int, value: 2 }),
    make('condition', 'IfStatement', {}, { test: 'true', consequent: 'branch', alternate: null }), make('true', 'Literal', { type: boolean, value: true }),
    make('branch', 'Block', {}, { statements: ['inner', 'callPrint'] }),
    make('inner', 'VariableDeclaration', { name: 'x', type: int }, { initializer: 'three' }), make('three', 'Literal', { type: int, value: 3 }),
    make('callPrint', 'PrintStatement', {}, { value: 'call' }), make('call', 'CallExpression', {}, { callee: 'callee', arguments: ['argument'] }), reference('callee', 'twice'), reference('argument', 'inner'),
    make('printAfter', 'PrintStatement', {}, { value: 'localRef' }), reference('localRef', 'local'),
    make('returnMain', 'ReturnStatement', {}, { argument: null }),
    make('deadPrint', 'PrintStatement', {}, { value: 'deadValue' }), make('deadValue', 'Literal', { type: int, value: 99 }),
    make('twice', 'FunctionDeclaration', { name: 'twice', type: int }, { parameters: ['n'], body: 'twiceBody' }), make('n', 'Parameter', { name: 'n', type: int }),
    make('twiceBody', 'Block', {}, { statements: ['increment', 'returnTwice'] }),
    make('increment', 'AssignmentStatement', {}, { target: 'gTarget', value: 'sum' }), reference('gTarget', 'g'),
    make('sum', 'BinaryExpression', { operator: '+' }, { left: 'gRef', right: 'addOne' }), reference('gRef', 'g'), make('addOne', 'Literal', { type: int, value: 1 }),
    make('returnTwice', 'ReturnStatement', {}, { argument: 'product' }), make('product', 'BinaryExpression', { operator: '*' }, { left: 'nRef', right: 'factor' }), reference('nRef', 'n'), make('factor', 'Literal', { type: int, value: 2 }),
    make('unused', 'FunctionDeclaration', { name: 'unused', type: voidType }, { parameters: [], body: 'unusedBody' }), make('unusedBody', 'Block', {}, { statements: [] }),
  ]
  return project
}
