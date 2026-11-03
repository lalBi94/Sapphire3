import { createProject, createModule, createNode } from './logic/index.js'
import { moduleTypes } from './moduleTypes.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }
const intPointerType = { kind: 'pointer', pointee: intType }

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
  // Déréférencement `*p` (lecture ou cible d'écriture) et prise d'adresse `&x`.
  const deref = (id, operand) => make(id, 'UnaryExpression', { operator: '*' }, { operand })
  const address = (id, operand) => make(id, 'UnaryExpression', { operator: '&' }, { operand })
  return { project, useModule, make, root, ref, intValue, binary, access, print, returnValue, call, block, deref, address }
}

// Décrit une annotation Comment de présentation, hors du modèle logique.
function note(id, name, text, x, y, width = 400, height = 240) {
  return { id, type: 'comment', name, x, y, width, height, expandedNodeIds: [], text }
}

// Ajoute une carte lisible par module et les annotations Comment, sans dépendre de React ni du canvas.
function workspace(project, notes = []) {
  const definition = moduleTypes.module
  const cards = project.modules.map((module, position) => ({
    id: module.id, type: 'module', name: module.name,
    x: (position % 3) * 600, y: Math.floor(position / 3) * 520,
    width: Math.max(definition.width, 520), height: Math.max(definition.height, 420),
    expandedNodeIds: [],
  }))
  cards.push(...notes)
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
  return workspace(b.project, [note('fibonacciNote', 'Fibonacci', 'fib(n) = fib(n-1) + fib(n-2) avec le cas de base n < 2 ; main affiche fib(10) = 55.', 600, 0)])
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
  return workspace(b.project, [note('recursionNote', 'Recursion', 'factorielle(n) = n × factorielle(n-1), cas de base n == 0 → 1 ; main affiche 5! = 120.', 600, 0)])
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
  return workspace(b.project, [note('arraysNote', 'Arrays', 'values démarre à [2, 4, 6], buffer est une création de 3 cases à 0 ; main écrit values[0] = 7 puis affiche values[0] (7) et values[1] (4).', 600, 0)])
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
  return workspace(b.project, [note('sortingNote', 'Sorting', 'Tri à bulles : deux boucles while imbriquées échangent les voisins hors ordre, puis une boucle affiche le tableau trié (1 3 5 8).', 600, 0)])
}

// Tri rapide multi-module : une bibliothèque exporte swap, partition et quickSort, l'application l'utilise.
function quickSort() {
  const b = builder()
  b.useModule('quickSort', 'Quick sort')
  b.root('quickSwap', 'FunctionDeclaration', { name: 'swap', type: voidType }, { parameters: ['quickSwapData', 'quickSwapLeft', 'quickSwapRight'], body: 'quickSwapBody' })
  b.make('quickSwapData', 'Parameter', { name: 'data', type: intArrayType })
  b.make('quickSwapLeft', 'Parameter', { name: 'left', type: intType })
  b.make('quickSwapRight', 'Parameter', { name: 'right', type: intType })
  b.block('quickSwapBody', ['quickSave', 'quickWriteLeft', 'quickWriteRight'])
  b.make('quickSave', 'VariableDeclaration', { name: 'saved', type: intType }, { initializer: 'quickSavedValue' })
  b.access('quickSavedValue', 'quickDataLeftSave', 'quickLeftRead'); b.ref('quickDataLeftSave', 'data'); b.ref('quickLeftRead', 'left')
  b.make('quickWriteLeft', 'AssignmentStatement', {}, { target: 'quickLeftTarget', value: 'quickRightValue' })
  b.access('quickLeftTarget', 'quickDataLeftWrite', 'quickLeftWrite'); b.ref('quickDataLeftWrite', 'data'); b.ref('quickLeftWrite', 'left')
  b.access('quickRightValue', 'quickDataRightRead', 'quickRightRead'); b.ref('quickDataRightRead', 'data'); b.ref('quickRightRead', 'right')
  b.make('quickWriteRight', 'AssignmentStatement', {}, { target: 'quickRightTarget', value: 'quickSavedRef' })
  b.access('quickRightTarget', 'quickDataRightWrite', 'quickRightWrite'); b.ref('quickDataRightWrite', 'data'); b.ref('quickRightWrite', 'right')
  b.ref('quickSavedRef', 'saved')

  b.root('quickPartition', 'FunctionDeclaration', { name: 'partition', type: intType }, { parameters: ['partData', 'partLow', 'partHigh'], body: 'partBody' })
  b.make('partData', 'Parameter', { name: 'data', type: intArrayType })
  b.make('partLow', 'Parameter', { name: 'low', type: intType })
  b.make('partHigh', 'Parameter', { name: 'high', type: intType })
  b.block('partBody', ['partIDecl', 'partPivotDecl', 'partJDecl', 'partLoop', 'partFinalSwap', 'partReturn'])
  b.make('partIDecl', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'partIMinusOne' })
  b.binary('partIMinusOne', '-', 'partLowRefI', 'partOneI'); b.ref('partLowRefI', 'low'); b.intValue('partOneI', 1)
  b.make('partPivotDecl', 'VariableDeclaration', { name: 'pivot', type: intType }, { initializer: 'partPivotValue' })
  b.access('partPivotValue', 'partDataPivot', 'partHighPivot'); b.ref('partDataPivot', 'data'); b.ref('partHighPivot', 'high')
  b.make('partJDecl', 'VariableDeclaration', { name: 'j', type: intType }, { initializer: 'partLowRefJ' })
  b.ref('partLowRefJ', 'low')
  b.make('partLoop', 'WhileStatement', {}, { test: 'partJLessHigh', body: 'partLoopBody' })
  b.binary('partJLessHigh', '<', 'partJRead', 'partHighRead'); b.ref('partJRead', 'j'); b.ref('partHighRead', 'high')
  b.block('partLoopBody', ['partCompare', 'partJStep'])
  b.make('partCompare', 'IfStatement', {}, { test: 'partLessEqualPivot', consequent: 'partSwapBody', alternate: null })
  b.binary('partLessEqualPivot', '<=', 'partJValue', 'partPivotRef'); b.access('partJValue', 'partDataJ', 'partJIndex'); b.ref('partDataJ', 'data'); b.ref('partJIndex', 'j'); b.ref('partPivotRef', 'pivot')
  b.block('partSwapBody', ['partIInc', 'partSwapCallStatement'])
  b.make('partIInc', 'AssignmentStatement', {}, { target: 'partITarget', value: 'partINext' })
  b.ref('partITarget', 'i'); b.binary('partINext', '+', 'partIRead', 'partOneInc'); b.ref('partIRead', 'i'); b.intValue('partOneInc', 1)
  b.make('partSwapCallStatement', 'ExpressionStatement', {}, { expression: 'partSwapCall' })
  b.call('partSwapCall', 'partSwapRef', ['partDataSwap', 'partIArg', 'partJArg']); b.ref('partSwapRef', 'swap'); b.ref('partDataSwap', 'data'); b.ref('partIArg', 'i'); b.ref('partJArg', 'j')
  b.make('partJStep', 'AssignmentStatement', {}, { target: 'partJTarget', value: 'partJNext' })
  b.ref('partJTarget', 'j'); b.binary('partJNext', '+', 'partJReadStep', 'partOneJStep'); b.ref('partJReadStep', 'j'); b.intValue('partOneJStep', 1)
  b.make('partFinalSwap', 'ExpressionStatement', {}, { expression: 'partFinalSwapCall' })
  b.call('partFinalSwapCall', 'partSwapLastRef', ['partDataLast', 'partIPlusOne', 'partHighLast']); b.ref('partSwapLastRef', 'swap'); b.ref('partDataLast', 'data'); b.binary('partIPlusOne', '+', 'partIReadLast', 'partOneLast'); b.ref('partIReadLast', 'i'); b.intValue('partOneLast', 1); b.ref('partHighLast', 'high')
  b.returnValue('partReturn', 'partPivotIndex')
  b.binary('partPivotIndex', '+', 'partIReadReturn', 'partOneReturn'); b.ref('partIReadReturn', 'i'); b.intValue('partOneReturn', 1)

  b.root('quickSortFunction', 'FunctionDeclaration', { name: 'quickSort', type: voidType }, { parameters: ['sortData', 'sortLow', 'sortHigh'], body: 'sortBody' })
  b.make('sortData', 'Parameter', { name: 'data', type: intArrayType })
  b.make('sortLow', 'Parameter', { name: 'low', type: intType })
  b.make('sortHigh', 'Parameter', { name: 'high', type: intType })
  b.block('sortBody', ['sortIf'])
  b.make('sortIf', 'IfStatement', {}, { test: 'sortLowLessHigh', consequent: 'sortIfBody', alternate: null })
  b.binary('sortLowLessHigh', '<', 'sortLowRead', 'sortHighRead'); b.ref('sortLowRead', 'low'); b.ref('sortHighRead', 'high')
  b.block('sortIfBody', ['sortPivotDecl', 'sortLeftCallStatement', 'sortRightCallStatement'])
  b.make('sortPivotDecl', 'VariableDeclaration', { name: 'p', type: intType }, { initializer: 'sortPartitionCall' })
  b.call('sortPartitionCall', 'sortPartitionRef', ['sortDataArg', 'sortLowArg', 'sortHighArg']); b.ref('sortPartitionRef', 'partition'); b.ref('sortDataArg', 'data'); b.ref('sortLowArg', 'low'); b.ref('sortHighArg', 'high')
  b.make('sortLeftCallStatement', 'ExpressionStatement', {}, { expression: 'sortLeftCall' })
  b.call('sortLeftCall', 'sortSelfLeftRef', ['sortDataLeft', 'sortLowLeft', 'sortPivotLeft']); b.ref('sortSelfLeftRef', 'quickSort'); b.ref('sortDataLeft', 'data'); b.ref('sortLowLeft', 'low'); b.binary('sortPivotLeft', '-', 'sortPivotReadLeft', 'sortOneLeft'); b.ref('sortPivotReadLeft', 'p'); b.intValue('sortOneLeft', 1)
  b.make('sortRightCallStatement', 'ExpressionStatement', {}, { expression: 'sortRightCall' })
  b.call('sortRightCall', 'sortSelfRightRef', ['sortDataRight', 'sortPivotRight', 'sortHighRight']); b.ref('sortSelfRightRef', 'quickSort'); b.ref('sortDataRight', 'data'); b.binary('sortPivotRight', '+', 'sortPivotReadRight', 'sortOneRight'); b.ref('sortPivotReadRight', 'p'); b.intValue('sortOneRight', 1); b.ref('sortHighRight', 'high')

  b.useModule('quickApp', 'Quick sort demo')
  b.root('quickData', 'VariableDeclaration', { name: 'data', type: intArrayType }, { initializer: 'quickDataList' })
  b.make('quickDataList', 'ArrayLiteral', { elementType: intType }, { elements: ['quickDataZero', 'quickDataOne', 'quickDataTwo', 'quickDataThree'] })
  b.intValue('quickDataZero', 8); b.intValue('quickDataOne', 3); b.intValue('quickDataTwo', 5); b.intValue('quickDataThree', 1)
  b.root('quickMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'quickMainBody' })
  b.block('quickMainBody', ['quickCallStatement', 'quickKDecl', 'quickPrintLoop', 'quickReturn'])
  b.make('quickCallStatement', 'ExpressionStatement', {}, { expression: 'quickCall' })
  b.call('quickCall', 'quickImportRef', ['quickMainData', 'quickZeroCall', 'quickThreeCall']); b.make('quickImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'quickSortImport' } }); b.ref('quickMainData', 'data'); b.intValue('quickZeroCall', 0); b.intValue('quickThreeCall', 3)
  b.make('quickKDecl', 'VariableDeclaration', { name: 'k', type: intType }, { initializer: 'quickKStart' }); b.intValue('quickKStart', 0)
  b.make('quickPrintLoop', 'WhileStatement', {}, { test: 'quickPrintTest', body: 'quickPrintBody' })
  b.binary('quickPrintTest', '<', 'quickKRead', 'quickPrintBound'); b.ref('quickKRead', 'k'); b.intValue('quickPrintBound', 4)
  b.block('quickPrintBody', ['quickPrintElement', 'quickKStep'])
  b.print('quickPrintElement', 'quickElementRead')
  b.access('quickElementRead', 'quickDataPrint', 'quickKIndex'); b.ref('quickDataPrint', 'data'); b.ref('quickKIndex', 'k')
  b.make('quickKStep', 'AssignmentStatement', {}, { target: 'quickKTarget', value: 'quickKNext' })
  b.ref('quickKTarget', 'k'); b.binary('quickKNext', '+', 'quickKStepRead', 'quickOneK'); b.ref('quickKStepRead', 'k'); b.intValue('quickOneK', 1)
  b.returnValue('quickReturn', null)
  b.project.modules.find((module) => module.id === 'quickSort').exports.push({ nodeId: 'quickSortFunction', name: 'quickSort' })
  b.project.modules.find((module) => module.id === 'quickApp').imports.push({ id: 'quickSortImport', moduleId: 'quickSort', nodeId: 'quickSortFunction', localName: 'quickSort' })
  return workspace(b.project, [note('quickSortNote', 'Quick sort', 'La bibliothèque Quick sort exporte swap, partition et quickSort ; l\'application importe quickSort et trie [8, 3, 5, 1] par récursion et partition autour du pivot. Sortie : 1 3 5 8.', 600, 0)])
}

// Rendu de monnaie multi-module : un jeu canonique de pièces et une fonction gloutonne exportée.
function coinChange() {
  const b = builder()
  b.useModule('coinLib', 'Coins')
  b.root('coinChangeFunction', 'FunctionDeclaration', { name: 'coinChange', type: intType }, { parameters: ['changeAmount', 'changeCoins'], body: 'changeBody' })
  b.make('changeAmount', 'Parameter', { name: 'amount', type: intType })
  b.make('changeCoins', 'Parameter', { name: 'coins', type: intArrayType })
  b.block('changeBody', ['remainingDecl', 'countDecl', 'iDecl', 'coinDecl', 'outerLoop', 'changeReturn'])
  b.make('remainingDecl', 'VariableDeclaration', { name: 'remaining', type: intType }, { initializer: 'remainingStart' }); b.ref('remainingStart', 'amount')
  b.make('countDecl', 'VariableDeclaration', { name: 'count', type: intType }, { initializer: 'countStart' }); b.intValue('countStart', 0)
  b.make('iDecl', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'iStartCoin' }); b.intValue('iStartCoin', 0)
  b.make('coinDecl', 'VariableDeclaration', { name: 'coin', type: intType }, { initializer: 'coinStart' }); b.intValue('coinStart', 0)
  b.make('outerLoop', 'WhileStatement', {}, { test: 'coinIndexTest', body: 'outerCoinBody' })
  b.binary('coinIndexTest', '<', 'coinIRead', 'coinLengthCall'); b.ref('coinIRead', 'i')
  b.make('coinLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['coinLengthArray'] }); b.ref('coinLengthArray', 'coins')
  b.block('outerCoinBody', ['coinAssign', 'innerLoop', 'coinIStep'])
  b.make('coinAssign', 'AssignmentStatement', {}, { target: 'coinTarget', value: 'coinReadValue' })
  b.ref('coinTarget', 'coin'); b.access('coinReadValue', 'coinDataRead', 'coinIIndex'); b.ref('coinDataRead', 'coins'); b.ref('coinIIndex', 'i')
  b.make('innerLoop', 'WhileStatement', {}, { test: 'remainingCoinTest', body: 'innerCoinBody' })
  b.binary('remainingCoinTest', '>=', 'remainingReadTest', 'coinReadTest'); b.ref('remainingReadTest', 'remaining'); b.ref('coinReadTest', 'coin')
  b.block('innerCoinBody', ['remainingStep', 'countStep'])
  b.make('remainingStep', 'AssignmentStatement', {}, { target: 'remainingTarget', value: 'remainingNext' })
  b.ref('remainingTarget', 'remaining'); b.binary('remainingNext', '-', 'remainingRead', 'coinRead'); b.ref('remainingRead', 'remaining'); b.ref('coinRead', 'coin')
  b.make('countStep', 'AssignmentStatement', {}, { target: 'countTarget', value: 'countNext' })
  b.ref('countTarget', 'count'); b.binary('countNext', '+', 'countRead', 'oneCount'); b.ref('countRead', 'count'); b.intValue('oneCount', 1)
  b.make('coinIStep', 'AssignmentStatement', {}, { target: 'coinITarget', value: 'coinINext' })
  b.ref('coinITarget', 'i'); b.binary('coinINext', '+', 'coinIReadStep', 'oneCoinI'); b.ref('coinIReadStep', 'i'); b.intValue('oneCoinI', 1)
  b.returnValue('changeReturn', 'countReturn'); b.ref('countReturn', 'count')

  b.useModule('coinApp', 'Coin change demo')
  b.root('coins', 'VariableDeclaration', { name: 'coins', type: intArrayType }, { initializer: 'coinsList' })
  b.make('coinsList', 'ArrayLiteral', { elementType: intType }, { elements: ['coin25', 'coin10', 'coin5', 'coin1'] })
  b.intValue('coin25', 25); b.intValue('coin10', 10); b.intValue('coin5', 5); b.intValue('coin1', 1)
  b.root('coinMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'coinMainBody' })
  b.block('coinMainBody', ['coinPrint'])
  b.print('coinPrint', 'coinCall')
  b.call('coinCall', 'coinImportRef', ['coinAmount', 'coinAppCoins']); b.make('coinImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'coinChangeImport' } }); b.intValue('coinAmount', 63); b.ref('coinAppCoins', 'coins')
  b.project.modules.find((module) => module.id === 'coinLib').exports.push({ nodeId: 'coinChangeFunction', name: 'coinChange' })
  b.project.modules.find((module) => module.id === 'coinApp').imports.push({ id: 'coinChangeImport', moduleId: 'coinLib', nodeId: 'coinChangeFunction', localName: 'coinChange' })
  return workspace(b.project, [note('coinChangeNote', 'Coin change', 'coins = [25, 10, 5, 1] ; coinChange(63) choisit gloutonnement 25 + 25 + 10 + 1 + 1 + 1 et retourne 6 pièces. La bibliothèque Coins exporte la fonction, l\'application l\'importe.', 600, 0)])
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
  return workspace(b.project, [note('importsNote', 'Imports', 'Library exporte square ; App l\'importe et affiche square(5) = 25.', 0, 520)])
}

// ForEach : parcourt un tableau en appelant une fonction via une variable de type fonction.
function forEach() {
  const b = builder()
  b.useModule('foreach', 'For each')
  b.root('values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'valuesList' })
  b.make('valuesList', 'ArrayLiteral', { elementType: intType }, { elements: ['v3', 'v1', 'v4', 'v1b', 'v5'] })
  b.intValue('v3', 3); b.intValue('v1', 1); b.intValue('v4', 4); b.intValue('v1b', 1); b.intValue('v5', 5)
  // `show` affiche chaque élément visité ; sa référence alimente une variable de type fonction.
  b.root('show', 'FunctionDeclaration', { name: 'show', type: voidType }, { parameters: ['showValue'], body: 'showBody' })
  b.make('showValue', 'Parameter', { name: 'value', type: intType })
  b.block('showBody', ['showPrint'])
  b.print('showPrint', 'showRef'); b.ref('showRef', 'value')
  b.root('printer', 'VariableDeclaration', { name: 'printer', type: { kind: 'function', parameters: [intType], returnType: voidType } }, { initializer: 'printerRef' })
  b.ref('printerRef', 'show')
  b.root('forEachMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'forEachBody' })
  b.block('forEachBody', ['each'])
  b.make('each', 'ForEachStatement', {}, { array: 'valuesRef', callback: 'printerUse' })
  b.ref('valuesRef', 'values'); b.ref('printerUse', 'printer')
  return workspace(b.project, [note('foreachNote', 'For each', 'show est rangée dans la variable printer, de type fonction ; ForEach parcourt values et appelle printer pour chaque élément (3 1 4 1 5).', 600, 0)])
}

// Pointeurs dans un algorithme : `swap` échange deux entiers à travers leurs adresses.
function pointers() {
  const b = builder()
  b.useModule('pointers', 'Pointers')
  b.root('a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'three' })
  b.intValue('three', 3)
  b.root('b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'eight' })
  b.intValue('eight', 8)
  // swap(left: int*, right: int*) -> void : copie *left, écrit *left = *right, puis *right = la copie.
  b.root('swap', 'FunctionDeclaration', { name: 'swap', type: voidType }, { parameters: ['left', 'right'], body: 'swapBody' })
  b.make('left', 'Parameter', { name: 'left', type: intPointerType })
  b.make('right', 'Parameter', { name: 'right', type: intPointerType })
  b.block('swapBody', ['saveLeft', 'writeLeft', 'writeRight'])
  b.make('saveLeft', 'VariableDeclaration', { name: 'saved', type: intType }, { initializer: 'leftValue' })
  b.deref('leftValue', 'leftRefFirst'); b.ref('leftRefFirst', 'left')
  b.make('writeLeft', 'AssignmentStatement', {}, { target: 'leftTarget', value: 'rightValue' })
  b.deref('leftTarget', 'leftRefWrite'); b.ref('leftRefWrite', 'left')
  b.deref('rightValue', 'rightRefRead'); b.ref('rightRefRead', 'right')
  b.make('writeRight', 'AssignmentStatement', {}, { target: 'rightTarget', value: 'savedRef' })
  b.deref('rightTarget', 'rightRefWrite'); b.ref('rightRefWrite', 'right')
  b.ref('savedRef', 'saved')
  b.root('pointersMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'pointersBody' })
  b.block('pointersBody', ['printA', 'printB', 'callSwap', 'printA2', 'printB2'])
  b.print('printA', 'aRead1'); b.ref('aRead1', 'a')
  b.print('printB', 'bRead1'); b.ref('bRead1', 'b')
  // swap(&a, &b) : les adresses sont des arguments de type int*.
  b.make('callSwap', 'ExpressionStatement', {}, { expression: 'swapCall' })
  b.make('swapCall', 'CallExpression', {}, { callee: 'swapRef', arguments: ['addressA', 'addressB'] })
  b.ref('swapRef', 'swap')
  b.address('addressA', 'aRefArg'); b.ref('aRefArg', 'a')
  b.address('addressB', 'bRefArg'); b.ref('bRefArg', 'b')
  b.print('printA2', 'aRead2'); b.ref('aRead2', 'a')
  b.print('printB2', 'bRead2'); b.ref('bRead2', 'b')
  return workspace(b.project, [note('pointersNote', 'Pointers', 'swap(&a, &b) reçoit deux adresses int* et échange *left et *right : les écritures à travers les pointeurs modifient directement a et b (3 8 puis 8 3).', 600, 0)])
}

// Fonction d'ordre supérieur : une fonction est passée en paramètre puis appelée.
function higherOrder() {
  const b = builder()
  b.useModule('higherOrder', 'Higher-order')
  b.root('double', 'FunctionDeclaration', { name: 'double', type: intType }, { parameters: ['doubleValue'], body: 'doubleBody' })
  b.make('doubleValue', 'Parameter', { name: 'value', type: intType })
  b.block('doubleBody', ['doubleReturn'])
  b.returnValue('doubleReturn', 'doubleProduct')
  b.binary('doubleProduct', '*', 'doubleRead', 'two'); b.ref('doubleRead', 'value'); b.intValue('two', 2)
  // Le deuxième paramètre est une référence de fonction (int) -> int.
  b.root('apply', 'FunctionDeclaration', { name: 'apply', type: intType }, { parameters: ['applyValue', 'transform'], body: 'applyBody' })
  b.make('applyValue', 'Parameter', { name: 'value', type: intType })
  b.make('transform', 'Parameter', { name: 'transform', type: { kind: 'function', parameters: [intType], returnType: intType } })
  b.block('applyBody', ['applyReturn'])
  b.returnValue('applyReturn', 'applyCall')
  b.call('applyCall', 'transformRef', ['applyValueRead']); b.ref('transformRef', 'transform'); b.ref('applyValueRead', 'value')
  b.root('higherOrderMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'higherOrderBody' })
  b.block('higherOrderBody', ['printResult'])
  b.print('printResult', 'applyCallMain')
  // apply(21, double) : la fonction `double` est passée comme valeur.
  b.call('applyCallMain', 'applyRef', ['twentyOne', 'doubleRef'])
  b.ref('applyRef', 'apply'); b.intValue('twentyOne', 21); b.ref('doubleRef', 'double')
  return workspace(b.project, [note('higherOrderNote', 'Higher-order', '`apply(value, transform)` reçoit une fonction en paramètre (type `(int) -> int`) et l’appelle par `transform(value)`. `apply(21, double)` renvoie donc 42.', 600, 0)])
}

// Maths natives SP3 : opérations indépendantes des langages cibles.
function maths() {
  const b = builder()
  b.useModule('maths', 'Native maths')
  b.root('a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'minusSeven' })
  b.intValue('minusSeven', -7)
  b.root('b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'threeInt' })
  b.intValue('threeInt', 3)
  b.root('absolute', 'VariableDeclaration', { name: 'absolute', type: intType }, { initializer: 'absCall' })
  b.make('absCall', 'MathCall', { name: 'abs' }, { arguments: ['aRefAbs'] }); b.ref('aRefAbs', 'a')
  b.root('largest', 'VariableDeclaration', { name: 'largest', type: intType }, { initializer: 'maxCall' })
  b.make('maxCall', 'MathCall', { name: 'max' }, { arguments: ['aRefMax', 'bRefMax'] }); b.ref('aRefMax', 'a'); b.ref('bRefMax', 'b')
  b.root('root', 'VariableDeclaration', { name: 'root', type: doubleType }, { initializer: 'sqrtCall' })
  b.make('sqrtCall', 'MathCall', { name: 'sqrt' }, { arguments: ['eightyOne'] })
  b.make('eightyOne', 'Literal', { type: doubleType, value: '81.0' })
  b.root('power', 'VariableDeclaration', { name: 'power', type: doubleType }, { initializer: 'powCall' })
  b.make('powCall', 'MathCall', { name: 'pow' }, { arguments: ['threeDouble', 'twoDouble'] })
  b.make('threeDouble', 'Literal', { type: doubleType, value: '3.0' })
  b.make('twoDouble', 'Literal', { type: doubleType, value: '2.0' })
  b.root('mathMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mathBody' })
  b.block('mathBody', ['printAbs', 'printMax', 'printRoot', 'printPower'])
  b.print('printAbs', 'absRead'); b.ref('absRead', 'absolute')
  b.print('printMax', 'maxRead'); b.ref('maxRead', 'largest')
  b.print('printRoot', 'rootRead'); b.ref('rootRead', 'root')
  b.print('printPower', 'powerRead'); b.ref('powerRead', 'power')
  return workspace(b.project, [note('mathNote', 'Native maths', 'Opérations SP3 natives : abs(-7) = 7, max(-7, 3) = 3, sqrt(81) = 9, pow(3, 2) = 9. Une note peut aussi afficher une formule : $$ \\sqrt{81} = 9 $$.', 600, 0)])
}

// Domaines touchés par les exemples : ils pilotent uniquement le regroupement du menu.
export const exampleCategories = [
  { id: 'algorithms', labelKey: 'examples.category.algorithms' },
  { id: 'arrays', labelKey: 'examples.category.arrays' },
  { id: 'functions', labelKey: 'examples.category.functions' },
  { id: 'pointers', labelKey: 'examples.category.pointers' },
  { id: 'operations', labelKey: 'examples.category.operations' },
  { id: 'modules', labelKey: 'examples.category.modules' },
]

// Catalogue local, ouvrable sans réseau ni fichier externe.
export const examples = [
  { id: 'fibonacci', labelKey: 'examples.fibonacci', category: 'algorithms', build: fibonacci },
  { id: 'sorting', labelKey: 'examples.sorting', category: 'algorithms', build: sorting },
  { id: 'quickSort', labelKey: 'examples.quickSort', category: 'algorithms', build: quickSort },
  { id: 'coinChange', labelKey: 'examples.coinChange', category: 'algorithms', build: coinChange },
  { id: 'arrays', labelKey: 'examples.arrays', category: 'arrays', build: arrays },
  { id: 'recursion', labelKey: 'examples.recursion', category: 'algorithms', build: recursion },
  { id: 'imports', labelKey: 'examples.imports', category: 'modules', build: imports },
  { id: 'foreach', labelKey: 'examples.forEach', category: 'arrays', build: forEach },
  { id: 'pointers', labelKey: 'examples.pointers', category: 'pointers', build: pointers },
  { id: 'higherOrder', labelKey: 'examples.higherOrder', category: 'functions', build: higherOrder },
  { id: 'maths', labelKey: 'examples.maths', category: 'operations', build: maths },
]
