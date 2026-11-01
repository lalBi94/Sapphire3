import { createProject, createModule, createNode } from './logic/index.js'
import { moduleTypes } from './moduleTypes.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }

// Construit une source logique par petits appels, avec un module courant pour limiter le bruit.
function builder() {
  const project = createProject('example')
  let current = null
  const useModule = (id, name) => { const module = createModule(id, name); project.modules.push(module); current = module; return module }
  const make = (id, kind, properties = {}, children = {}, references = {}) => { project.nodes.push(createNode(id, current.id, kind, { properties, children, references })); return id }
  const root = (id, kind, properties = {}, children = {}, references = {}) => { make(id, kind, properties, children, references); current.rootNodeIds.push(id); return id }
  const ref = (id, name) => make(id, 'Reference', {}, {}, { target: { kind: 'name', name } })
  const intValue = (id, value) => make(id, 'Literal', { type: intType, value })
  const binary = (id, operator, left, right) => make(id, 'BinaryExpression', { operator }, { left, right })
  const access = (id, array, index) => make(id, 'ArrayAccess', {}, { array, index })
  const print = (id, value) => make(id, 'PrintStatement', {}, { value })
  const returnValue = (id, argument) => make(id, 'ReturnStatement', {}, { argument })
  const call = (id, callee, args) => make(id, 'CallExpression', {}, { callee, arguments: args })
  const block = (id, statements) => make(id, 'Block', {}, { statements })
  return { project, useModule, make, root, ref, intValue, binary, access, print, returnValue, call, block }
}

// Ajoute une carte lisible par module, sans dépendre de React ni du canvas.
function workspace(project) {
  const definition = moduleTypes.module
  const cards = project.modules.map((module, position) => ({
    id: module.id, type: 'module', name: module.name,
    x: (position % 3) * 600, y: Math.floor(position / 3) * 520,
    width: Math.max(definition.width, 520), height: Math.max(definition.height, 420),
    expandedNodeIds: [],
  }))
  return { application: 'Sapphire 3', workspaceVersion: 1, project, presentation: { cards, camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null } }
}

// Fibonacci récursif : le point d'entrée affiche fib(10).
function fibonacci() {
  const b = builder()
  b.useModule('fibonacci', 'Fibonacci')
  b.root('fib', 'FunctionDeclaration', { name: 'fib', type: intType }, { parameters: ['n'], body: 'fibBody' })
  b.make('n', 'Parameter', { name: 'n', type: intType })
  b.block('fibBody', ['fibBase', 'fibRecurse'])
  b.make('fibBase', 'IfStatement', {}, { test: 'lessThanTwo', consequent: 'baseBody', alternate: null })
  b.binary('lessThanTwo', '<', 'nBase', 'twoBase'); b.ref('nBase', 'n'); b.intValue('twoBase', 2)
  b.block('baseBody', ['returnN'])
  b.returnValue('returnN', 'nReturn'); b.ref('nReturn', 'n')
  b.returnValue('fibRecurse', 'total')
  b.binary('total', '+', 'fibLower', 'fibLowerTwo')
  b.call('fibLower', 'fibRefLower', ['nMinusOne']); b.ref('fibRefLower', 'fib')
  b.binary('nMinusOne', '-', 'nMinusOneLeft', 'oneLower'); b.ref('nMinusOneLeft', 'n'); b.intValue('oneLower', 1)
  b.call('fibLowerTwo', 'fibRefLowerTwo', ['nMinusTwo']); b.ref('fibRefLowerTwo', 'fib')
  b.binary('nMinusTwo', '-', 'nMinusTwoLeft', 'twoLower'); b.ref('nMinusTwoLeft', 'n'); b.intValue('twoLower', 2)
  b.root('fibMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'fibMainBody' })
  b.block('fibMainBody', ['fibPrint'])
  b.print('fibPrint', 'fibCallTen')
  b.call('fibCallTen', 'fibRefMain', ['ten']); b.ref('fibRefMain', 'fib'); b.intValue('ten', 10)
  return workspace(b.project)
}

// Récursion : la factorielle, cas de base puis appel à soi-même.
function recursion() {
  const b = builder()
  b.useModule('recursion', 'Recursion')
  b.root('factorial', 'FunctionDeclaration', { name: 'factorial', type: intType }, { parameters: ['n'], body: 'factBody' })
  b.make('n', 'Parameter', { name: 'n', type: intType })
  b.block('factBody', ['factBase', 'factStep'])
  b.make('factBase', 'IfStatement', {}, { test: 'isZero', consequent: 'factBaseBody', alternate: null })
  b.binary('isZero', '==', 'nBase', 'zero'); b.ref('nBase', 'n'); b.intValue('zero', 0)
  b.block('factBaseBody', ['factReturnOne'])
  b.returnValue('factReturnOne', 'one'); b.intValue('one', 1)
  b.returnValue('factStep', 'factProduct')
  b.binary('factProduct', '*', 'nStep', 'factCall')
  b.ref('nStep', 'n')
  b.call('factCall', 'factRef', ['nMinusOne']); b.ref('factRef', 'factorial')
  b.binary('nMinusOne', '-', 'nMinusOneLeft', 'oneLower'); b.ref('nMinusOneLeft', 'n'); b.intValue('oneLower', 1)
  b.root('factMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'factMainBody' })
  b.block('factMainBody', ['factPrint'])
  b.print('factPrint', 'factCallFive')
  b.call('factCallFive', 'factRefMain', ['five']); b.ref('factRefMain', 'factorial'); b.intValue('five', 5)
  return workspace(b.project)
}

// Tableaux : littéral, création de taille fixe, écriture d'un élément puis lecture.
function arrays() {
  const b = builder()
  b.useModule('arrays', 'Arrays')
  b.root('values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'valuesList' })
  b.make('valuesList', 'ArrayLiteral', { elementType: intType }, { elements: ['valueZero', 'valueOne', 'valueTwo'] })
  b.intValue('valueZero', 2); b.intValue('valueOne', 4); b.intValue('valueTwo', 6)
  b.root('buffer', 'VariableDeclaration', { name: 'buffer', type: intArrayType }, { initializer: 'bufferCreation' })
  b.make('bufferCreation', 'ArrayCreation', { elementType: intType }, { size: 'bufferSize', initializer: 'bufferFill' })
  b.intValue('bufferSize', 3); b.intValue('bufferFill', 0)
  b.root('arraysMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'arraysBody' })
  b.block('arraysBody', ['writeFirst', 'printFirst', 'printSecond'])
  b.make('writeFirst', 'AssignmentStatement', {}, { target: 'firstElement', value: 'seven' })
  b.access('firstElement', 'valuesRefWrite', 'zeroWrite'); b.ref('valuesRefWrite', 'values'); b.intValue('zeroWrite', 0)
  b.intValue('seven', 7)
  b.print('printFirst', 'readFirst')
  b.access('readFirst', 'valuesRefRead', 'zeroRead'); b.ref('valuesRefRead', 'values'); b.intValue('zeroRead', 0)
  b.print('printSecond', 'readSecond')
  b.access('readSecond', 'valuesRefSecond', 'oneRead'); b.ref('valuesRefSecond', 'values'); b.intValue('oneRead', 1)
  return workspace(b.project)
}

// Tri à bulles sur un petit tableau, puis affichage dans l'ordre croissant.
function sorting() {
  const b = builder()
  b.useModule('sorting', 'Sorting')
  b.root('data', 'VariableDeclaration', { name: 'data', type: intArrayType }, { initializer: 'dataList' })
  b.make('dataList', 'ArrayLiteral', { elementType: intType }, { elements: ['dataZero', 'dataOne', 'dataTwo', 'dataThree'] })
  b.intValue('dataZero', 5); b.intValue('dataOne', 3); b.intValue('dataTwo', 8); b.intValue('dataThree', 1)
  b.root('sortMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'sortBody' })
  b.block('sortBody', ['iDecl', 'tempDecl', 'outerLoop', 'kDecl', 'printLoop', 'sortReturn'])
  b.make('iDecl', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'iStart' }); b.intValue('iStart', 0)
  b.make('tempDecl', 'VariableDeclaration', { name: 'temp', type: intType }, { initializer: 'tempStart' }); b.intValue('tempStart', 0)
  b.make('outerLoop', 'WhileStatement', {}, { test: 'outerTest', body: 'outerBody' })
  b.binary('outerTest', '<', 'iReadOuter', 'outerBound'); b.ref('iReadOuter', 'i'); b.intValue('outerBound', 3)
  b.block('outerBody', ['jDecl', 'innerLoop', 'iStep'])
  b.make('jDecl', 'VariableDeclaration', { name: 'j', type: intType }, { initializer: 'jStart' }); b.intValue('jStart', 0)
  b.make('innerLoop', 'WhileStatement', {}, { test: 'innerTest', body: 'innerBody' })
  b.binary('innerTest', '<', 'jReadInner', 'innerBound'); b.ref('jReadInner', 'j'); b.intValue('innerBound', 3)
  b.block('innerBody', ['compare', 'jStep'])
  b.make('compare', 'IfStatement', {}, { test: 'greater', consequent: 'swapBody', alternate: null })
  b.binary('greater', '>', 'leftRead', 'rightRead')
  b.access('leftRead', 'dataRefLeft', 'jLeft'); b.ref('dataRefLeft', 'data'); b.ref('jLeft', 'j')
  b.access('rightRead', 'dataRefRight', 'jPlusOneRight'); b.ref('dataRefRight', 'data'); b.binary('jPlusOneRight', '+', 'jRight', 'oneRight'); b.ref('jRight', 'j'); b.intValue('oneRight', 1)
  b.block('swapBody', ['saveTemp', 'shiftLeft', 'writeTemp'])
  b.make('saveTemp', 'AssignmentStatement', {}, { target: 'tempTargetSave', value: 'leftReadSave' })
  b.ref('tempTargetSave', 'temp')
  b.access('leftReadSave', 'dataRefSave', 'jSave'); b.ref('dataRefSave', 'data'); b.ref('jSave', 'j')
  b.make('shiftLeft', 'AssignmentStatement', {}, { target: 'leftWrite', value: 'rightReadShift' })
  b.access('leftWrite', 'dataRefWrite', 'jWrite'); b.ref('dataRefWrite', 'data'); b.ref('jWrite', 'j')
  b.access('rightReadShift', 'dataRefShift', 'jPlusOneShift'); b.ref('dataRefShift', 'data'); b.binary('jPlusOneShift', '+', 'jShift', 'oneShift'); b.ref('jShift', 'j'); b.intValue('oneShift', 1)
  b.make('writeTemp', 'AssignmentStatement', {}, { target: 'rightWrite', value: 'tempTargetWrite' })
  b.access('rightWrite', 'dataRefWriteRight', 'jPlusOneWrite'); b.ref('dataRefWriteRight', 'data'); b.binary('jPlusOneWrite', '+', 'jWriteRight', 'oneWrite'); b.ref('jWriteRight', 'j'); b.intValue('oneWrite', 1)
  b.ref('tempTargetWrite', 'temp')
  b.make('jStep', 'AssignmentStatement', {}, { target: 'jTarget', value: 'jNext' })
  b.ref('jTarget', 'j'); b.binary('jNext', '+', 'jStepRead', 'oneStep'); b.ref('jStepRead', 'j'); b.intValue('oneStep', 1)
  b.make('iStep', 'AssignmentStatement', {}, { target: 'iTarget', value: 'iNext' })
  b.ref('iTarget', 'i'); b.binary('iNext', '+', 'iStepRead', 'oneStepI'); b.ref('iStepRead', 'i'); b.intValue('oneStepI', 1)
  b.make('kDecl', 'VariableDeclaration', { name: 'k', type: intType }, { initializer: 'kStart' }); b.intValue('kStart', 0)
  b.make('printLoop', 'WhileStatement', {}, { test: 'printTest', body: 'printBody' })
  b.binary('printTest', '<', 'kReadPrint', 'printBound'); b.ref('kReadPrint', 'k'); b.intValue('printBound', 4)
  b.block('printBody', ['printElement', 'kStep'])
  b.print('printElement', 'readElement')
  b.access('readElement', 'dataRefPrint', 'kIndex'); b.ref('dataRefPrint', 'data'); b.ref('kIndex', 'k')
  b.make('kStep', 'AssignmentStatement', {}, { target: 'kTarget', value: 'kNext' })
  b.ref('kTarget', 'k'); b.binary('kNext', '+', 'kStepRead', 'oneStepK'); b.ref('kStepRead', 'k'); b.intValue('oneStepK', 1)
  b.returnValue('sortReturn', null)
  return workspace(b.project)
}

// Imports : une fonction carrée exportée par une bibliothèque, importée et appelée ailleurs.
function imports() {
  const b = builder()
  b.useModule('library', 'Library')
  b.root('square', 'FunctionDeclaration', { name: 'square', type: intType }, { parameters: ['value'], body: 'squareBody' })
  b.make('value', 'Parameter', { name: 'value', type: intType })
  b.block('squareBody', ['squareReturn'])
  b.returnValue('squareReturn', 'squareProduct')
  b.binary('squareProduct', '*', 'valueRead', 'valueReadTwo')
  b.ref('valueRead', 'value'); b.ref('valueReadTwo', 'value')
  b.useModule('app', 'App')
  b.root('appMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'appBody' })
  b.block('appBody', ['appPrint'])
  b.print('appPrint', 'squareCall')
  b.call('squareCall', 'squareImportRef', ['five'])
  b.make('squareImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'squareImport' } })
  b.intValue('five', 5)
  b.project.modules.find((module) => module.id === 'library').exports.push({ nodeId: 'square', name: 'square' })
  b.project.modules.find((module) => module.id === 'app').imports.push({ id: 'squareImport', moduleId: 'library', nodeId: 'square', localName: 'square' })
  return workspace(b.project)
}

// Catalogue local, ouvrable sans réseau ni fichier externe.
export const examples = [
  { id: 'fibonacci', labelKey: 'examples.fibonacci', build: fibonacci },
  { id: 'sorting', labelKey: 'examples.sorting', build: sorting },
  { id: 'arrays', labelKey: 'examples.arrays', build: arrays },
  { id: 'recursion', labelKey: 'examples.recursion', build: recursion },
  { id: 'imports', labelKey: 'examples.imports', build: imports },
]
