import { createProject, createModule, createNode } from './logic/index.js'
import { createScreenModule, screenDefaults } from './screenNode.js'
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
  const cards = project.modules.map((module, position) => module.screen
    ? { id: module.id, type: 'screen', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.screen.width, height: moduleTypes.screen.height, screenWidth: module.screen.width, screenHeight: module.screen.height, screenScale: screenDefaults.scale, expandedNodeIds: [] }
    : { id: module.id, type: 'module', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: Math.max(definition.width, 520), height: Math.max(definition.height, 420), expandedNodeIds: [] })
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

// Calcul numérique multi-module : dérivée centrale et intégrale de Simpson pour x².
function calculus() {
  const b = builder()
  b.useModule('calculus', 'Calculus')
  b.root('squareFunction', 'FunctionDeclaration', { name: 'square', type: doubleType }, { parameters: ['squareX'], body: 'squareBody' })
  b.make('squareX', 'Parameter', { name: 'x', type: doubleType })
  b.block('squareBody', ['squareReturn'])
  b.returnValue('squareReturn', 'squareProduct')
  b.binary('squareProduct', '*', 'squareXRead', 'squareXReadTwo'); b.ref('squareXRead', 'x'); b.ref('squareXReadTwo', 'x')

  b.root('derivativeFunction', 'FunctionDeclaration', { name: 'derivative', type: doubleType }, { parameters: ['derivativeX'], body: 'derivativeBody' })
  b.make('derivativeX', 'Parameter', { name: 'x', type: doubleType })
  b.block('derivativeBody', ['derivativeH', 'derivativeReturn'])
  b.make('derivativeH', 'VariableDeclaration', { name: 'h', type: doubleType }, { initializer: 'derivativeHValue' })
  b.make('derivativeHValue', 'Literal', { type: doubleType, value: '0.5' })
  b.returnValue('derivativeReturn', 'derivativeQuotient')
  b.binary('derivativeQuotient', '/', 'derivativeDelta', 'derivativeDenominator')
  b.binary('derivativeDelta', '-', 'derivativeRightValue', 'derivativeLeftValue')
  b.call('derivativeRightValue', 'derivativeRightSquare', ['derivativeXPlusH']); b.ref('derivativeRightSquare', 'square')
  b.binary('derivativeXPlusH', '+', 'derivativeXRight', 'derivativeHRight'); b.ref('derivativeXRight', 'x'); b.ref('derivativeHRight', 'h')
  b.call('derivativeLeftValue', 'derivativeLeftSquare', ['derivativeXMinusH']); b.ref('derivativeLeftSquare', 'square')
  b.binary('derivativeXMinusH', '-', 'derivativeXLeft', 'derivativeHLeft'); b.ref('derivativeXLeft', 'x'); b.ref('derivativeHLeft', 'h')
  b.binary('derivativeDenominator', '*', 'derivativeTwo', 'derivativeHMiddle'); b.make('derivativeTwo', 'Literal', { type: doubleType, value: '2.0' }); b.ref('derivativeHMiddle', 'h')

  b.root('integralFunction', 'FunctionDeclaration', { name: 'integral', type: doubleType }, { parameters: ['integralA', 'integralB'], body: 'integralBody' })
  b.make('integralA', 'Parameter', { name: 'a', type: doubleType })
  b.make('integralB', 'Parameter', { name: 'b', type: doubleType })
  b.block('integralBody', ['middleDecl', 'weightDecl', 'integralReturn'])
  b.make('middleDecl', 'VariableDeclaration', { name: 'middle', type: doubleType }, { initializer: 'middleValue' })
  b.binary('middleValue', '/', 'middleSum', 'middleTwo'); b.binary('middleSum', '+', 'integralARead', 'integralBRead'); b.ref('integralARead', 'a'); b.ref('integralBRead', 'b'); b.make('middleTwo', 'Literal', { type: doubleType, value: '2.0' })
  b.make('weightDecl', 'VariableDeclaration', { name: 'weight', type: doubleType }, { initializer: 'weightValue' })
  b.binary('weightValue', '/', 'weightSpan', 'weightSix'); b.binary('weightSpan', '-', 'integralBWeight', 'integralAWeight'); b.ref('integralBWeight', 'b'); b.ref('integralAWeight', 'a'); b.make('weightSix', 'Literal', { type: doubleType, value: '6.0' })
  b.returnValue('integralReturn', 'integralProduct')
  b.binary('integralProduct', '*', 'weightRead', 'integralSum')
  b.ref('weightRead', 'weight')
  b.binary('integralSum', '+', 'integralLeftSquare', 'integralRightTerms')
  b.call('integralLeftSquare', 'integralLeftRef', ['integralAValue']); b.ref('integralLeftRef', 'square'); b.ref('integralAValue', 'a')
  b.binary('integralRightTerms', '+', 'integralMiddleTerm', 'integralRightSquare')
  b.binary('integralMiddleTerm', '*', 'integralFour', 'integralMiddleSquare'); b.make('integralFour', 'Literal', { type: doubleType, value: '4.0' }); b.call('integralMiddleSquare', 'integralMiddleRef', ['integralMiddleValue']); b.ref('integralMiddleRef', 'square'); b.ref('integralMiddleValue', 'middle')
  b.call('integralRightSquare', 'integralRightRef', ['integralBValue']); b.ref('integralRightRef', 'square'); b.ref('integralBValue', 'b')

  b.useModule('calculusDemo', 'Calculus demo')
  b.root('calculusMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'calculusBody' })
  b.block('calculusBody', ['printDerivative', 'printIntegral'])
  b.print('printDerivative', 'derivativeCall')
  b.call('derivativeCall', 'derivativeImportRef', ['threeDerivative']); b.make('derivativeImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'derivativeImport' } }); b.make('threeDerivative', 'Literal', { type: doubleType, value: '3.0' })
  b.print('printIntegral', 'integralCall')
  b.call('integralCall', 'integralImportRef', ['zeroIntegral', 'oneIntegral']); b.make('integralImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'integralImport' } }); b.make('zeroIntegral', 'Literal', { type: doubleType, value: '0.0' }); b.make('oneIntegral', 'Literal', { type: doubleType, value: '1.0' })
  b.project.modules.find((module) => module.id === 'calculus').exports.push({ nodeId: 'derivativeFunction', name: 'derivative' }, { nodeId: 'integralFunction', name: 'integral' })
  b.project.modules.find((module) => module.id === 'calculusDemo').imports.push({ id: 'derivativeImport', moduleId: 'calculus', nodeId: 'derivativeFunction', localName: 'derivative' }, { id: 'integralImport', moduleId: 'calculus', nodeId: 'integralFunction', localName: 'integral' })
  return workspace(b.project, [note('calculusNote', 'Calculus', 'Dérivée centrale de x² en 3 : (f(3,5) − f(2,5)) / 1 = 6. Intégrale de Simpson de x² sur [0, 1] : (1/6) × (f(0) + 4f(0,5) + f(1)) = 1/3. $$ \\frac{d}{dx}x^2 = 2x $$ et $$ \\int_0^1 x^2\\,dx = \\frac{1}{3} $$.', 600, 0)])
}

// Domaines touchés par les exemples : ils pilotent uniquement le regroupement du menu.
// Deux écrans pixel 15×9 pilotés par les fonctions natives de leur module caché.
function pixelScreens() {
  const b = builder()
  const one = createScreenModule('screenOne', 'Screen one', 1)
  const two = createScreenModule('screenTwo', 'Screen two', 2)
  b.project.modules.push(one.module, two.module)
  b.project.nodes.push(...one.nodes, ...two.nodes)
  b.useModule('screenPatterns', 'Screen patterns')

  // Construit l'indice de la traînée : base + signe × max(frame - 1, 0) × pas.
  function trailIndex(prefix, base, sign, step) {
    b.binary(`${prefix}Previous`, '-', `${prefix}Frame`, `${prefix}One`)
    b.ref(`${prefix}Frame`, 'frame')
    b.intValue(`${prefix}One`, 1)
    b.intValue(`${prefix}Zero`, 0)
    b.make(`${prefix}Clamped`, 'MathCall', { name: 'max' }, { arguments: [`${prefix}Previous`, `${prefix}Zero`] })
    b.binary(`${prefix}Offset`, '*', `${prefix}Clamped`, `${prefix}Step`)
    b.intValue(`${prefix}Step`, step)
    b.intValue(`${prefix}Base`, base)
    b.binary(`${prefix}Index`, sign > 0 ? '+' : '-', `${prefix}Base`, `${prefix}Offset`)
    return `${prefix}Index`
  }

  // Construit l'indice de la tête : base + signe × frame × pas.
  function headIndex(prefix, base, sign, step) {
    b.binary(`${prefix}Offset`, '*', `${prefix}Frame`, `${prefix}Step`)
    b.ref(`${prefix}Frame`, 'frame')
    b.intValue(`${prefix}Step`, step)
    b.intValue(`${prefix}Base`, base)
    b.binary(`${prefix}Index`, sign > 0 ? '+' : '-', `${prefix}Base`, `${prefix}Offset`)
    return `${prefix}Index`
  }

  // Ajoute un appel d'écriture de pixel avec ses cinq arguments.
  function pixelCall(prefix, importId, pixel, red, green, blue, alpha) {
    b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    b.call(`${prefix}Call`, `${prefix}Callee`, [pixel, `${prefix}Red`, `${prefix}Green`, `${prefix}Blue`, `${prefix}Alpha`])
    b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
    b.intValue(`${prefix}Red`, red)
    b.intValue(`${prefix}Green`, green)
    b.intValue(`${prefix}Blue`, blue)
    b.intValue(`${prefix}Alpha`, alpha)
    return `${prefix}Statement`
  }

  // Chaque fonction déplace une tête lumineuse et laisse la position précédente en traînée.
  b.root('drawOne', 'FunctionDeclaration', { name: 'drawOne', type: voidType }, { parameters: ['drawOneFrame'], body: 'drawOneBody' })
  b.make('drawOneFrame', 'Parameter', { name: 'frame', type: intType })
  b.block('drawOneBody', [
    pixelCall('oneTrail', 'setOneImport', trailIndex('oneTrail', 0, 1, 16), 92, 76, 24, 120),
    pixelCall('oneHead', 'setOneImport', headIndex('oneHead', 0, 1, 16), 255, 213, 71, 255),
  ])
  b.root('drawTwo', 'FunctionDeclaration', { name: 'drawTwo', type: voidType }, { parameters: ['drawTwoFrame'], body: 'drawTwoBody' })
  b.make('drawTwoFrame', 'Parameter', { name: 'frame', type: intType })
  b.block('drawTwoBody', [
    pixelCall('twoTrail', 'setTwoImport', trailIndex('twoTrail', 134, -1, 16), 78, 68, 104, 120),
    pixelCall('twoHead', 'setTwoImport', headIndex('twoHead', 134, -1, 16), 196, 177, 255, 255),
  ])
  const patterns = b.project.modules.find((module) => module.id === 'screenPatterns')
  patterns.exports.push({ nodeId: 'drawOne', name: 'drawOne' }, { nodeId: 'drawTwo', name: 'drawTwo' })
  const setOne = one.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const setTwo = two.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_2')
  patterns.imports.push({ id: 'setOneImport', moduleId: 'screenOne', nodeId: setOne.nodeId, localName: 'setOne' }, { id: 'setTwoImport', moduleId: 'screenTwo', nodeId: setTwo.nodeId, localName: 'setTwo' })

  b.useModule('screenApp', 'Screen app')
  b.root('screenMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'screenMainBody' })
  b.block('screenMainBody', ['screenLoop', 'screenPrint'])
  b.make('screenFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'screenFrameStart' })
  b.intValue('screenFrameStart', 0)
  b.make('screenTest', 'BinaryExpression', { operator: '<' }, { left: 'screenFrameIndex', right: 'screenFrameEnd' })
  b.ref('screenFrameIndex', 'frame')
  b.intValue('screenFrameEnd', 9)
  b.make('screenUpdate', 'AssignmentStatement', {}, { target: 'screenFrameTarget', value: 'screenFrameNext' })
  b.ref('screenFrameTarget', 'frame')
  b.binary('screenFrameNext', '+', 'screenFrameLeft', 'screenFrameOne')
  b.ref('screenFrameLeft', 'frame')
  b.intValue('screenFrameOne', 1)
  b.make('screenOneStatement', 'ExpressionStatement', {}, { expression: 'screenOneCall' })
  b.call('screenOneCall', 'screenOneRef', ['screenOneFrame'])
  b.make('screenOneRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'drawOneImport' } })
  b.ref('screenOneFrame', 'frame')
  b.make('screenTwoStatement', 'ExpressionStatement', {}, { expression: 'screenTwoCall' })
  b.call('screenTwoCall', 'screenTwoRef', ['screenTwoFrame'])
  b.make('screenTwoRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'drawTwoImport' } })
  b.ref('screenTwoFrame', 'frame')
  b.block('screenLoopBody', ['screenOneStatement', 'screenTwoStatement'])
  b.make('screenLoop', 'ForStatement', {}, { initializer: 'screenFrame', test: 'screenTest', update: 'screenUpdate', body: 'screenLoopBody' })
  b.print('screenPrint', 'screenMessage')
  b.make('screenMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Screens moving' })
  const app = b.project.modules.find((module) => module.id === 'screenApp')
  app.imports.push({ id: 'drawOneImport', moduleId: 'screenPatterns', nodeId: 'drawOne', localName: 'drawOne' }, { id: 'drawTwoImport', moduleId: 'screenPatterns', nodeId: 'drawTwo', localName: 'drawTwo' })

  return workspace(b.project, [
    note('screenOneNote', 'Screen one', 'Écran 15×9. drawOne(frame) fait avancer une tête jaune sur une diagonale et laisse une traînée sombre derrière elle.', 0, 620, 420, 170),
    note('screenTwoNote', 'Screen two', 'Écran 15×9. drawTwo(frame) fait avancer une tête violette sur la diagonale inverse, avec sa propre traînée.', 600, 620, 420, 170),
    note('screenMainNote', 'Two screens', 'main boucle sur 9 images et appelle drawOne puis drawTwo à chaque tour. Run rejoue les images capturées sur les deux écrans puis conserve la dernière image ; Debug permet de suivre chaque écriture.', 1200, 0, 420, 220),
  ])
}

// Jeu de la vie : convolution, table de transition et blit écran.
function gameOfLife() {
  const b = builder()
  const screen = createScreenModule('lifeScreen', 'Game of life screen', 1, { width: 90, height: 56 })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  b.useModule('lifePatterns', 'Life patterns')

  // Déclare un tableau constant global.
  function constantArray(id, values) {
    b.root(id, 'ConstantDeclaration', { name: id, type: intArrayType }, { initializer: `${id}Init` })
    b.make(`${id}Init`, 'ArrayLiteral', { elementType: intType }, { elements: values.map((value, index) => {
      const child = `${id}Value${index}`
      b.intValue(child, value)
      return child
    }) })
  }

  // Grille 90×56 initialisée à zéro, plus les buffers de calcul.
  b.root('lifeGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: 'lifeGridInit' })
  b.make('lifeGridInit', 'ArrayCreation', { elementType: intType }, { size: 'lifeGridSize', initializer: 'lifeGridZero' })
  b.intValue('lifeGridSize', 90 * 56)
  b.intValue('lifeGridZero', 0)
  b.root('lifeCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType })
  b.root('lifeNext', 'VariableDeclaration', { name: 'next', type: intArrayType })
  constantArray('kernel', [1, 1, 1, 1, 0, 1, 1, 1, 1])
  constantArray('rule', [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0])
  constantArray('palette', [0, 0, 0, 0, 255, 213, 71, 255])

  // Pulsar 13×13, deux clignotants, un crapaud et quatre still lifes.
  const pulsar = [
    [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
    [0, 2], [5, 2], [7, 2], [12, 2],
    [0, 3], [5, 3], [7, 3], [12, 3],
    [0, 4], [5, 4], [7, 4], [12, 4],
    [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
    [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
    [0, 8], [5, 8], [7, 8], [12, 8],
    [0, 9], [5, 9], [7, 9], [12, 9],
    [0, 10], [5, 10], [7, 10], [12, 10],
    [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12],
  ]
  const seeds = []
  const add = (baseX, baseY, cells) => { for (const [x, y] of cells) seeds.push([baseX + x, baseY + y]) }
  add(10, 10, pulsar)
  add(70, 20, [[0, 0], [1, 0], [2, 0]])
  add(30, 44, [[0, 0], [1, 0], [2, 0]])
  add(70, 40, [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]])
  add(50, 5, [[0, 0], [1, 0], [0, 1], [1, 1]])
  add(80, 30, [[0, 0], [1, 0], [0, 1], [1, 1]])
  add(5, 40, [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]])
  add(50, 25, [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]])

  // Affecte les cellules de départ de la grille.
  const seedStatements = seeds.map(([x, y], index) => {
    const prefix = `lifeSeed${index}`
    b.make(`${prefix}Target`, 'ArrayAccess', {}, { array: `${prefix}Grid`, index: `${prefix}Index` })
    b.ref(`${prefix}Grid`, 'grid')
    b.intValue(`${prefix}Index`, y * 90 + x)
    b.make(`${prefix}Value`, 'Literal', { type: intType, value: 1 })
    b.make(`${prefix}Statement`, 'AssignmentStatement', {}, { target: `${prefix}Target`, value: `${prefix}Value` })
    return `${prefix}Statement`
  })

  // Appelle les natives génériques de grille.
  function gridCall(id, name, args) {
    b.make(id, 'MathCall', { name }, { arguments: args })
    return id
  }
  const countsCall = gridCall('lifeConvolve', 'arrayConvolve', ['lifeGridRef', 'lifeWidth', 'lifeHeight', 'lifeKernelRef', 'lifeKernelWidth', 'lifeKernelHeight'])
  b.ref('lifeGridRef', 'grid')
  b.intValue('lifeWidth', 90)
  b.intValue('lifeHeight', 56)
  b.ref('lifeKernelRef', 'kernel')
  b.intValue('lifeKernelWidth', 3)
  b.intValue('lifeKernelHeight', 3)
  const lookupCall = gridCall('lifeLookup', 'arrayLookup', ['lifeCountsRef', 'lifeGridLookupRef', 'lifeRuleRef'])
  b.ref('lifeCountsRef', 'counts')
  b.ref('lifeGridLookupRef', 'grid')
  b.ref('lifeRuleRef', 'rule')

  // Importe blit/present depuis l'écran.
  const blitExport = screen.module.exports.find((entry) => entry.name === screen.functions.blit)
  const presentExport = screen.module.exports.find((entry) => entry.name === screen.functions.present)
  const patterns = b.project.modules.find((module) => module.id === 'lifePatterns')
  patterns.imports.push(
    { id: 'lifeBlitImport', moduleId: 'lifeScreen', nodeId: blitExport.nodeId, localName: 'blit' },
    { id: 'lifePresentImport', moduleId: 'lifeScreen', nodeId: presentExport.nodeId, localName: 'present' },
  )

  // runLife : sème la grille, puis applique 72 générations.
  b.root('runLife', 'FunctionDeclaration', { name: 'runLife', type: voidType }, { parameters: [], body: 'runLifeBody' })
  b.make('lifeCountsAssign', 'AssignmentStatement', {}, { target: 'lifeCountsTarget', value: countsCall })
  b.ref('lifeCountsTarget', 'counts')
  b.make('lifeNextAssign', 'AssignmentStatement', {}, { target: 'lifeNextTarget', value: lookupCall })
  b.ref('lifeNextTarget', 'next')
  b.make('lifeGridAssign', 'AssignmentStatement', {}, { target: 'lifeGridTarget', value: 'lifeNextRef' })
  b.ref('lifeGridTarget', 'grid')
  b.ref('lifeNextRef', 'next')
  b.make('lifeBlitStatement', 'ExpressionStatement', {}, { expression: 'lifeBlitCall' })
  b.call('lifeBlitCall', 'lifeBlitCallee', ['lifeGridBlitRef', 'lifePaletteRef'])
  b.make('lifeBlitCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'lifeBlitImport' } })
  b.ref('lifeGridBlitRef', 'grid')
  b.ref('lifePaletteRef', 'palette')
  b.make('lifePresentStatement', 'ExpressionStatement', {}, { expression: 'lifePresentCall' })
  b.call('lifePresentCall', 'lifePresentCallee', [])
  b.make('lifePresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'lifePresentImport' } })
  b.make('lifeGeneration', 'VariableDeclaration', { name: 'generation', type: intType }, { initializer: 'lifeGenerationStart' })
  b.intValue('lifeGenerationStart', 0)
  b.binary('lifeGenerationTest', '<', 'lifeGenerationIndex', 'lifeGenerationEnd')
  b.ref('lifeGenerationIndex', 'generation')
  b.intValue('lifeGenerationEnd', 72)
  b.make('lifeGenerationUpdate', 'AssignmentStatement', {}, { target: 'lifeGenerationTarget', value: 'lifeGenerationNext' })
  b.ref('lifeGenerationTarget', 'generation')
  b.binary('lifeGenerationNext', '+', 'lifeGenerationLeft', 'lifeGenerationOne')
  b.ref('lifeGenerationLeft', 'generation')
  b.intValue('lifeGenerationOne', 1)
  b.block('lifeGenerationBody', ['lifeCountsAssign', 'lifeNextAssign', 'lifeGridAssign', 'lifeBlitStatement', 'lifePresentStatement'])
  b.make('lifeGenerationLoop', 'ForStatement', {}, { initializer: 'lifeGeneration', test: 'lifeGenerationTest', update: 'lifeGenerationUpdate', body: 'lifeGenerationBody' })
  b.block('runLifeBody', [...seedStatements, 'lifeGenerationLoop'])
  patterns.exports.push({ nodeId: 'runLife', name: 'runLife' })

  b.useModule('lifeApp', 'Life app')
  b.root('lifeMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'lifeMainBody' })
  b.make('lifeRunStatement', 'ExpressionStatement', {}, { expression: 'lifeRunCall' })
  b.call('lifeRunCall', 'lifeRunCallee', [])
  b.make('lifeRunCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'lifeRunImport' } })
  b.print('lifePrint', 'lifeMessage')
  b.make('lifeMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Game of life' })
  b.block('lifeMainBody', ['lifeRunStatement', 'lifePrint'])
  const app = b.project.modules.find((module) => module.id === 'lifeApp')
  app.imports.push({ id: 'lifeRunImport', moduleId: 'lifePatterns', nodeId: 'runLife', localName: 'runLife' })

  const result = workspace(b.project, [
    note('lifeScreenNote', 'Game of life', 'Écran 90×56. Les règles de Conway sont calculées par convolution et table de transition. Un pulsar, deux clignotants, un crapaud et quatre still lifes servent de départ. $$90 \\times \\lfloor 90/\\varphi \\rfloor = 90 \\times 56$$', 0, 580, 760, 220),
    note('lifePatternsNote', 'Real Life rules', 'La grille évolue avec arrayConvolve + arrayLookup, puis screenBlit et screenPresent. Les motifs sont isolés et reviennent à leur état initial après six générations.', 820, 460, 520, 220),
    note('lifeAppNote', '72 generations', 'runLife sème la grille puis applique 72 générations, soit douze cycles de six. L’UI rejoue les images en aller-retour continu, sans remise à zéro visible.', 1440, 460, 520, 220),
  ])
  const cards = result.presentation.cards
  const screenCard = cards.find((card) => card.id === 'lifeScreen')
  if (screenCard) Object.assign(screenCard, { width: 760, height: 540, screenScale: 1 })
  const patternsCard = cards.find((card) => card.id === 'lifePatterns')
  if (patternsCard) patternsCard.x = 820
  const appCard = cards.find((card) => card.id === 'lifeApp')
  if (appCard) appCard.x = 1440
  return result
}
export const exampleCategories = [
  { id: 'algorithms', labelKey: 'examples.category.algorithms' },
  { id: 'arrays', labelKey: 'examples.category.arrays' },
  { id: 'functions', labelKey: 'examples.category.functions' },
  { id: 'pointers', labelKey: 'examples.category.pointers' },
  { id: 'operations', labelKey: 'examples.category.operations' },
  { id: 'screens', labelKey: 'examples.category.screens' },
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
  { id: 'calculus', labelKey: 'examples.calculus', category: 'operations', build: calculus },
  { id: 'pixelScreens', labelKey: 'examples.pixelScreens', category: 'screens', build: pixelScreens },
  { id: 'gameOfLife', labelKey: 'examples.gameOfLife', category: 'screens', build: gameOfLife },
]
