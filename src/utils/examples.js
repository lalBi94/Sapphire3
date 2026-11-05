import { createProject, createModule, createNode } from './logic/index.js'
import { createScreenModule, screenDefaults } from './screenNode.js'
import { createGaugeModule, gaugeDefaults } from './gaugeNode.js'
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
    ? { id: module.id, type: 'screen', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.screen.width, height: moduleTypes.screen.height, screenWidth: module.screen.width, screenHeight: module.screen.height, expandedNodeIds: [] }
    : module.gauge
      ? { id: module.id, type: 'gauge', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.gauge.width, height: moduleTypes.gauge.height, expandedNodeIds: [] }
      : module.led
        ? { id: module.id, type: 'led', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.led.width, height: moduleTypes.led.height, expandedNodeIds: [] }
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
  b.block('arraysBody', ['writeFirst', 'printFirst', 'printSecond', 'printBufferLength'])
  b.make('writeFirst', 'AssignmentStatement', {}, { target: 'firstElement', value: 'seven' })
  b.access('firstElement', 'valuesRefWrite', 'zeroWrite'); b.ref('valuesRefWrite', 'values'); b.intValue('zeroWrite', 0)
  b.intValue('seven', 7)
  b.print('printFirst', 'readFirst')
  b.access('readFirst', 'valuesRefRead', 'zeroRead'); b.ref('valuesRefRead', 'values'); b.intValue('zeroRead', 0)
  b.print('printSecond', 'readSecond')
  b.access('readSecond', 'valuesRefSecond', 'oneRead'); b.ref('valuesRefSecond', 'values'); b.intValue('oneRead', 1)
  // `arrayLength` remplace la taille écrite en dur.
  b.print('printBufferLength', 'bufferLengthCall')
  b.make('bufferLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['bufferLengthArray'] }); b.ref('bufferLengthArray', 'buffer')
  return workspace(b.project, [note('arraysNote', 'Arrays', 'values démarre à [2, 4, 6], buffer est une création de 3 cases à 0 ; main écrit values[0] = 7, affiche values[0] (7) et values[1] (4), puis la taille de buffer par arrayLength (3).', 600, 0)])
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
  b.binary('outerTest', '<', 'iReadOuter', 'outerBound'); b.ref('iReadOuter', 'i')
  // Borne = arrayLength(data) − 1, sans taille écrite en dur.
  b.make('outerBound', 'BinaryExpression', { operator: '-' }, { left: 'outerBoundLength', right: 'outerBoundOne' })
  b.make('outerBoundLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['outerBoundArray'] }); b.ref('outerBoundArray', 'data')
  b.intValue('outerBoundOne', 1)
  b.block('outerBody', ['jDecl', 'innerLoop', 'iStep'])
  b.make('jDecl', 'VariableDeclaration', { name: 'j', type: intType }, { initializer: 'jStart' }); b.intValue('jStart', 0)
  b.make('innerLoop', 'WhileStatement', {}, { test: 'innerTest', body: 'innerBody' })
  b.binary('innerTest', '<', 'jReadInner', 'innerBound'); b.ref('jReadInner', 'j')
  b.make('innerBound', 'BinaryExpression', { operator: '-' }, { left: 'innerBoundLength', right: 'innerBoundOne' })
  b.make('innerBoundLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['innerBoundArray'] }); b.ref('innerBoundArray', 'data')
  b.intValue('innerBoundOne', 1)
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
  b.binary('printTest', '<', 'kReadPrint', 'printBound'); b.ref('kReadPrint', 'k')
  b.make('printBound', 'MathCall', { name: 'arrayLength' }, { arguments: ['printBoundArray'] }); b.ref('printBoundArray', 'data')
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
  b.call('quickCall', 'quickImportRef', ['quickMainData', 'quickZeroCall', 'quickHighCall']); b.make('quickImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'quickSortImport' } }); b.ref('quickMainData', 'data'); b.intValue('quickZeroCall', 0)
  // Borne haute = arrayLength(data) − 1.
  b.binary('quickHighCall', '-', 'quickHighLength', 'quickHighOne')
  b.make('quickHighLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['quickHighArray'] }); b.ref('quickHighArray', 'data')
  b.intValue('quickHighOne', 1)
  b.make('quickKDecl', 'VariableDeclaration', { name: 'k', type: intType }, { initializer: 'quickKStart' }); b.intValue('quickKStart', 0)
  b.make('quickPrintLoop', 'WhileStatement', {}, { test: 'quickPrintTest', body: 'quickPrintBody' })
  b.binary('quickPrintTest', '<', 'quickKRead', 'quickPrintBound'); b.ref('quickKRead', 'k')
  b.make('quickPrintBound', 'MathCall', { name: 'arrayLength' }, { arguments: ['quickPrintBoundArray'] }); b.ref('quickPrintBoundArray', 'data')
  b.block('quickPrintBody', ['quickPrintElement', 'quickKStep'])
  b.print('quickPrintElement', 'quickElementRead')
  b.access('quickElementRead', 'quickDataPrint', 'quickKIndex'); b.ref('quickDataPrint', 'data'); b.ref('quickKIndex', 'k')
  b.make('quickKStep', 'AssignmentStatement', {}, { target: 'quickKTarget', value: 'quickKNext' })
  b.ref('quickKTarget', 'k'); b.binary('quickKNext', '+', 'quickKStepRead', 'quickOneK'); b.ref('quickKStepRead', 'k'); b.intValue('quickOneK', 1)
  b.returnValue('quickReturn', null)
  b.project.modules.find((module) => module.id === 'quickSort').exports.push({ nodeId: 'quickSortFunction', name: 'quickSort' })
  b.project.modules.find((module) => module.id === 'quickApp').imports.push({ id: 'quickSortImport', moduleId: 'quickSort', nodeId: 'quickSortFunction', localName: 'quickSort' })
  return workspace(b.project, [note('quickSortNote', 'Quick sort', 'La bibliothèque Quick sort exporte swap, partition et quickSort ; l\'application importe quickSort et trie [8, 3, 5, 1] par récursion et partition autour du pivot. Sortie : 1 3 5 8.', 0, 520)])
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
  return workspace(b.project, [note('coinChangeNote', 'Coin change', 'coins = [25, 10, 5, 1] ; coinChange(63) choisit gloutonnement 25 + 25 + 10 + 1 + 1 + 1 et retourne 6 pièces. La bibliothèque Coins exporte la fonction, l\'application l\'importe.', 0, 520)])
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
  b.root('smallest', 'VariableDeclaration', { name: 'smallest', type: intType }, { initializer: 'minCall' })
  b.make('minCall', 'MathCall', { name: 'min' }, { arguments: ['aRefMin', 'bRefMin'] }); b.ref('aRefMin', 'a'); b.ref('bRefMin', 'b')
  // clamp borne une valeur et gcd calcule un PGCD, deux natives entières supplémentaires.
  b.root('bounded', 'VariableDeclaration', { name: 'bounded', type: intType }, { initializer: 'clampCall' })
  b.make('clampCall', 'MathCall', { name: 'clamp' }, { arguments: ['tenClamp', 'zeroClamp', 'fiveClamp'] })
  b.intValue('tenClamp', 10); b.intValue('zeroClamp', 0); b.intValue('fiveClamp', 5)
  b.root('divisor', 'VariableDeclaration', { name: 'divisor', type: intType }, { initializer: 'gcdCall' })
  b.make('gcdCall', 'MathCall', { name: 'gcd' }, { arguments: ['twelveGcd', 'eighteenGcd'] })
  b.intValue('twelveGcd', 12); b.intValue('eighteenGcd', 18)
  b.root('root', 'VariableDeclaration', { name: 'root', type: doubleType }, { initializer: 'sqrtCall' })
  b.make('sqrtCall', 'MathCall', { name: 'sqrt' }, { arguments: ['eightyOne'] })
  b.make('eightyOne', 'Literal', { type: doubleType, value: '81.0' })
  b.root('power', 'VariableDeclaration', { name: 'power', type: doubleType }, { initializer: 'powCall' })
  b.make('powCall', 'MathCall', { name: 'pow' }, { arguments: ['threeDouble', 'twoDouble'] })
  b.make('threeDouble', 'Literal', { type: doubleType, value: '3.0' })
  b.make('twoDouble', 'Literal', { type: doubleType, value: '2.0' })
  b.root('mathMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mathBody' })
  b.block('mathBody', ['printAbs', 'printMax', 'printMin', 'printClamp', 'printGcd', 'printRoot', 'printPower'])
  b.print('printAbs', 'absRead'); b.ref('absRead', 'absolute')
  b.print('printMax', 'maxRead'); b.ref('maxRead', 'largest')
  b.print('printMin', 'minRead'); b.ref('minRead', 'smallest')
  b.print('printClamp', 'clampRead'); b.ref('clampRead', 'bounded')
  b.print('printGcd', 'gcdRead'); b.ref('gcdRead', 'divisor')
  b.print('printRoot', 'rootRead'); b.ref('rootRead', 'root')
  b.print('printPower', 'powerRead'); b.ref('powerRead', 'power')
  return workspace(b.project, [note('mathNote', 'Native maths', 'Opérations SP3 natives : abs(-7) = 7, max(-7, 3) = 3, min(-7, 3) = -7, clamp(10, 0, 5) = 5, gcd(12, 18) = 6, sqrt(81) = 9, pow(3, 2) = 9. Une note peut aussi afficher une formule : $$ \\sqrt{81} = 9 $$.', 600, 0)])
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
  return workspace(b.project, [note('calculusNote', 'Calculus', 'Dérivée centrale de x² en 3 : (f(3,5) − f(2,5)) / 1 = 6. Intégrale de Simpson de x² sur [0, 1] : (1/6) × (f(0) + 4f(0,5) + f(1)) = 1/3. $$ \\frac{d}{dx}x^2 = 2x $$ et $$ \\int_0^1 x^2\\,dx = \\frac{1}{3} $$.', 0, 520)])
}

// Deux écrans 30×18 avec chacun un logo 3×3 qui ricoche sur les bords, façon DVD.
function pixelScreens() {
  const b = builder()
  const screenWidth = 34
  const screenHeight = 18
  const logo = 2
  const maxX = screenWidth - logo
  const maxY = screenHeight - logo
  const one = createScreenModule('screenOne', 'Screen one', 1, { width: screenWidth, height: screenHeight })
  const two = createScreenModule('screenTwo', 'Screen two', 2, { width: screenWidth, height: screenHeight })
  b.project.modules.push(one.module, two.module)
  b.project.nodes.push(...one.nodes, ...two.nodes)
  b.useModule('screenPatterns', 'Screen patterns')

  // Déclare une globale entière avec sa valeur initiale.
  function globalVariable(id, name, value) {
    b.root(id, 'VariableDeclaration', { name, type: intType }, { initializer: `${id}Start` })
    b.intValue(`${id}Start`, value)
  }

  // Position et vitesse d'un logo, conservées entre deux images.
  function logoState(prefix, x, y, dx, dy) {
    globalVariable(`${prefix}X`, `${prefix}X`, x)
    globalVariable(`${prefix}Y`, `${prefix}Y`, y)
    globalVariable(`${prefix}DX`, `${prefix}DX`, dx)
    globalVariable(`${prefix}DY`, `${prefix}DY`, dy)
  }

  logoState('one', 4, 2, 4, 2)
  logoState('two', 20, 10, -4, 2)

  // Écrit un pixel : index = base + décalage constant dans un tampon 30×18.
  function pixelSet(id, importId, base, offset, red, green, blue, alpha) {
    b.make(`${id}Statement`, 'ExpressionStatement', {}, { expression: `${id}Call` })
    b.call(`${id}Call`, `${id}Callee`, [`${id}Pixel`, `${id}Red`, `${id}Green`, `${id}Blue`, `${id}Alpha`])
    b.make(`${id}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
    b.binary(`${id}Pixel`, '+', `${id}Base`, `${id}Offset`)
    b.ref(`${id}Base`, base)
    b.intValue(`${id}Offset`, offset)
    b.intValue(`${id}Red`, red)
    b.intValue(`${id}Green`, green)
    b.intValue(`${id}Blue`, blue)
    b.intValue(`${id}Alpha`, alpha)
    return `${id}Statement`
  }

  // Affecte `base = Y × largeur + X`, la position linéaire du coin du logo.
  function assignBase(prefix) {
    b.make(`${prefix}BaseAssign`, 'AssignmentStatement', {}, { target: `${prefix}BaseTarget`, value: `${prefix}BaseValue` })
    b.ref(`${prefix}BaseTarget`, `${prefix}Base`)
    b.binary(`${prefix}BaseValue`, '+', `${prefix}BaseRow`, `${prefix}BaseX`)
    b.binary(`${prefix}BaseRow`, '*', `${prefix}BaseY`, `${prefix}BaseWidth`)
    b.ref(`${prefix}BaseY`, `${prefix}Y`)
    b.intValue(`${prefix}BaseWidth`, screenWidth)
    b.ref(`${prefix}BaseX`, `${prefix}X`)
    return `${prefix}BaseAssign`
  }

  // Change un axe d'une case, puis inverse la vitesse si un bord est atteint.
  function advance(prefix, axis, maximum) {
    const id = `${prefix}${axis}`
    b.make(`${id}Move`, 'AssignmentStatement', {}, { target: `${id}MoveTarget`, value: `${id}MoveValue` })
    b.ref(`${id}MoveTarget`, `${prefix}${axis}`)
    b.binary(`${id}MoveValue`, '+', `${id}MoveLeft`, `${id}MoveRight`)
    b.ref(`${id}MoveLeft`, `${prefix}${axis}`)
    b.ref(`${id}MoveRight`, `${prefix}D${axis}`)

    b.binary(`${id}Low`, '<', `${id}LowLeft`, `${id}LowZero`)
    b.ref(`${id}LowLeft`, `${prefix}${axis}`)
    b.intValue(`${id}LowZero`, 0)
    b.make(`${id}LowClamp`, 'AssignmentStatement', {}, { target: `${id}LowClampTarget`, value: `${id}LowZeroValue` })
    b.ref(`${id}LowClampTarget`, `${prefix}${axis}`)
    b.intValue(`${id}LowZeroValue`, 0)
    b.make(`${id}LowFlip`, 'AssignmentStatement', {}, { target: `${id}LowFlipTarget`, value: `${id}LowFlipValue` })
    b.ref(`${id}LowFlipTarget`, `${prefix}D${axis}`)
    b.make(`${id}LowFlipValue`, 'UnaryExpression', { operator: '-' }, { operand: `${id}LowFlipOperand` })
    b.ref(`${id}LowFlipOperand`, `${prefix}D${axis}`)
    b.block(`${id}LowBody`, [`${id}LowClamp`, `${id}LowFlip`])
    b.make(`${id}LowIf`, 'IfStatement', {}, { test: `${id}Low`, consequent: `${id}LowBody`, alternate: null })

    b.binary(`${id}High`, '>', `${id}HighLeft`, `${id}HighMaxTest`)
    b.ref(`${id}HighLeft`, `${prefix}${axis}`)
    b.intValue(`${id}HighMaxTest`, maximum)
    b.make(`${id}HighClamp`, 'AssignmentStatement', {}, { target: `${id}HighClampTarget`, value: `${id}HighMaxValue` })
    b.ref(`${id}HighClampTarget`, `${prefix}${axis}`)
    b.intValue(`${id}HighMaxValue`, maximum)
    b.make(`${id}HighFlip`, 'AssignmentStatement', {}, { target: `${id}HighFlipTarget`, value: `${id}HighFlipValue` })
    b.ref(`${id}HighFlipTarget`, `${prefix}D${axis}`)
    b.make(`${id}HighFlipValue`, 'UnaryExpression', { operator: '-' }, { operand: `${id}HighFlipOperand` })
    b.ref(`${id}HighFlipOperand`, `${prefix}D${axis}`)
    b.block(`${id}HighBody`, [`${id}HighClamp`, `${id}HighFlip`])
    b.make(`${id}HighIf`, 'IfStatement', {}, { test: `${id}High`, consequent: `${id}HighBody`, alternate: null })

    return [`${id}Move`, `${id}LowIf`, `${id}HighIf`]
  }

  // Corps d'un logo : base calculée, effacement, avance, rebond, nouvelle base, dessin.
  function logoBody(prefix, importId, red, green, blue) {
    const statements = []
    b.make(`${prefix}Base`, 'VariableDeclaration', { name: `${prefix}Base`, type: intType }, { initializer: `${prefix}BaseInit` })
    b.binary(`${prefix}BaseInit`, '+', `${prefix}BaseInitRow`, `${prefix}BaseInitX`)
    b.binary(`${prefix}BaseInitRow`, '*', `${prefix}BaseInitY`, `${prefix}BaseInitWidth`)
    b.ref(`${prefix}BaseInitY`, `${prefix}Y`)
    b.intValue(`${prefix}BaseInitWidth`, screenWidth)
    b.ref(`${prefix}BaseInitX`, `${prefix}X`)
    statements.push(`${prefix}Base`)
    for (let row = 0; row < logo; row += 1) {
      for (let column = 0; column < logo; column += 1) statements.push(pixelSet(`${prefix}Clear${row}${column}`, importId, `${prefix}Base`, row * screenWidth + column, 0, 0, 0, 0))
    }
    statements.push(...advance(prefix, 'X', maxX))
    statements.push(...advance(prefix, 'Y', maxY))
    statements.push(assignBase(prefix))
    for (let row = 0; row < logo; row += 1) {
      for (let column = 0; column < logo; column += 1) statements.push(pixelSet(`${prefix}Draw${row}${column}`, importId, `${prefix}Base`, row * screenWidth + column, red, green, blue, 255))
    }
    return statements
  }

  b.root('bounceOne', 'FunctionDeclaration', { name: 'bounceOne', type: voidType }, { parameters: [], body: 'bounceOneBody' })
  b.block('bounceOneBody', logoBody('one', 'setOneImport', 255, 213, 71))
  b.root('bounceTwo', 'FunctionDeclaration', { name: 'bounceTwo', type: voidType }, { parameters: [], body: 'bounceTwoBody' })
  b.block('bounceTwoBody', logoBody('two', 'setTwoImport', 148, 190, 255))

  const patterns = b.project.modules.find((module) => module.id === 'screenPatterns')
  patterns.exports.push({ nodeId: 'bounceOne', name: 'bounceOne' }, { nodeId: 'bounceTwo', name: 'bounceTwo' })
  const setOne = one.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const setTwo = two.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_2')
  const presentOne = one.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  patterns.imports.push(
    { id: 'setOneImport', moduleId: 'screenOne', nodeId: setOne.nodeId, localName: 'setOne' },
    { id: 'setTwoImport', moduleId: 'screenTwo', nodeId: setTwo.nodeId, localName: 'setTwo' },
  )

  b.useModule('screenApp', 'Screen app')
  b.root('screenMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'screenMainBody' })
  b.block('screenMainBody', ['screenStartOne', 'screenLoop', 'screenPrint'])
  // Dessine un premier logo avant la boucle : l'écran n'est jamais vide.
  b.make('screenStartOne', 'ExpressionStatement', {}, { expression: 'screenStartOneCall' })
  b.call('screenStartOneCall', 'screenStartOneCallee', [])
  b.make('screenStartOneCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'bounceOneImport' } })
  b.make('screenFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'screenFrameStart' })
  b.intValue('screenFrameStart', 0)
  b.make('screenTest', 'BinaryExpression', { operator: '<' }, { left: 'screenFrameIndex', right: 'screenFrameEnd' })
  b.ref('screenFrameIndex', 'frame')
  b.intValue('screenFrameEnd', 19)
  b.make('screenUpdate', 'AssignmentStatement', {}, { target: 'screenFrameTarget', value: 'screenFrameNext' })
  b.ref('screenFrameTarget', 'frame')
  b.binary('screenFrameNext', '+', 'screenFrameLeft', 'screenFrameOne')
  b.ref('screenFrameLeft', 'frame')
  b.intValue('screenFrameOne', 1)
  b.make('screenOneStatement', 'ExpressionStatement', {}, { expression: 'screenOneCall' })
  b.call('screenOneCall', 'screenOneRef', [])
  b.make('screenOneRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'bounceOneImport' } })
  b.make('screenTwoStatement', 'ExpressionStatement', {}, { expression: 'screenTwoCall' })
  b.call('screenTwoCall', 'screenTwoRef', [])
  b.make('screenTwoRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'bounceTwoImport' } })
  // Une seule image par génération : les deux logos sont écrits, puis présentés ensemble.
  b.make('screenPresentStatement', 'ExpressionStatement', {}, { expression: 'screenPresentCall' })
  b.call('screenPresentCall', 'screenPresentCallee', [])
  b.make('screenPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'presentImport' } })
  b.block('screenLoopBody', ['screenOneStatement', 'screenTwoStatement', 'screenPresentStatement'])
  b.make('screenLoop', 'ForStatement', {}, { initializer: 'screenFrame', test: 'screenTest', update: 'screenUpdate', body: 'screenLoopBody' })
  b.print('screenPrint', 'screenMessage')
  b.make('screenMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Logos bouncing' })
  const app = b.project.modules.find((module) => module.id === 'screenApp')
  app.imports.push({ id: 'bounceOneImport', moduleId: 'screenPatterns', nodeId: 'bounceOne', localName: 'bounceOne' }, { id: 'bounceTwoImport', moduleId: 'screenPatterns', nodeId: 'bounceTwo', localName: 'bounceTwo' }, { id: 'presentImport', moduleId: 'screenOne', nodeId: presentOne.nodeId, localName: 'present' })

  return workspace(b.project, [
    note('screenOneNote', 'Bouncing logo', 'Écran 30×18. bounceOne() fait ricocher un logo jaune 3×3 : il avance d’une case par image et inverse sa vitesse en touchant un bord. $$x \\leftarrow x + v_x,\\quad v_x \\leftarrow -v_x$$', 0, 980, 460, 200),
    note('screenTwoNote', 'Second logo', 'Écran 30×18. bounceTwo() anime un logo bleu décalé, avec sa propre position et sa propre vitesse.', 620, 980, 460, 200),
    note('screenMainNote', 'Bouncing logos', 'main dessine un premier logo puis boucle sur 30 images : les deux logos rebondissent en continu. Run rejoue les images en boucle ; Debug permet de suivre chaque écriture.', 1240, 980, 460, 200),
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

  // Grille 90×56 remplie de zéro par une seule opération, plus les buffers de calcul.
  b.root('lifeGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: 'lifeGridInit' })
  b.make('lifeGridInit', 'MathCall', { name: 'arrayFill' }, { arguments: ['lifeGridSize', 'lifeGridZero'] })
  b.intValue('lifeGridSize', 90 * 56)
  b.intValue('lifeGridZero', 0)
  b.root('lifeCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType })
  b.root('lifeNext', 'VariableDeclaration', { name: 'next', type: intArrayType })
  constantArray('kernel', [1, 1, 1, 1, 0, 1, 1, 1, 1])
  constantArray('rule', [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0])
  constantArray('palette', [0, 0, 0, 0, 255, 213, 71, 255])

  // Motifs classiques dont les périodes divisent 30 : pulsar (3), pentadécathlon (15),
  // clignotants et crapauds (2), still lifes (1). La génération 30 égale donc la génération 0,
  // ce qui permet une boucle avant infinie et sans raccord visible.
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
  const pentadecathlon = [
    [2, 0], [7, 0],
    [0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [9, 1],
    [2, 2], [7, 2],
  ]
  const blinker = [[0, 0], [1, 0], [2, 0]]
  const toad = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]]
  const block = [[0, 0], [1, 0], [0, 1], [1, 1]]
  const beehive = [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]]
  const tub = [[1, 0], [0, 1], [2, 1], [1, 2]]
  const boat = [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2]]

  const seeds = []
  const add = (baseX, baseY, cells) => { for (const [x, y] of cells) seeds.push([baseX + x, baseY + y]) }
  add(6, 6, pulsar)
  add(66, 6, pulsar)
  add(30, 4, pentadecathlon)
  add(30, 24, pentadecathlon)
  add(52, 4, blinker)
  add(52, 20, blinker)
  add(76, 26, blinker)
  add(30, 40, toad)
  add(60, 40, toad)
  add(5, 30, block)
  add(20, 30, block)
  add(43, 30, block)
  add(60, 32, block)
  add(80, 34, block)
  add(5, 42, beehive)
  add(21, 44, beehive)
  add(45, 44, tub)
  add(72, 44, tub)
  add(12, 50, boat)
  add(56, 50, boat)

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
  b.intValue('lifeGenerationEnd', 60)
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
    note('lifeScreenNote', 'Game of life', 'Écran 90×56. Les règles de Conway sont calculées par convolution et table de transition. Tous les motifs ont une période qui divise 30, donc la boucle est sans raccord. $$90 \\times \\lfloor 90/\\varphi \\rfloor = 90 \\times 56$$', 0, 580, 760, 220),
    note('lifePatternsNote', 'Real Life rules', 'La grille évolue avec arrayConvolve + arrayLookup, puis screenBlit et screenPresent. Pulsars (3), pentadécathlons (15), clignotants et crapauds (2), still lifes (1) : la période commune est 30.', 820, 460, 520, 220),
    note('lifeAppNote', 'Infinite loop', 'runLife sème les motifs puis applique 60 générations. L’UI détecte la période 30 et rejoue 30 images en boucle avant, à l’infini et sans remise à zéro visible.', 1440, 460, 520, 220),
  ])
  const cards = result.presentation.cards
  const screenCard = cards.find((card) => card.id === 'lifeScreen')
  if (screenCard) Object.assign(screenCard, { width: 760, height: 540 })
  const patternsCard = cards.find((card) => card.id === 'lifePatterns')
  if (patternsCard) patternsCard.x = 820
  const appCard = cards.find((card) => card.id === 'lifeApp')
  if (appCard) appCard.x = 1440
  return result
}
// Pluie matricielle : quatre colonnes tombent avec une traînée, sur un écran 90×18.
function rain() {
  const b = builder()
  const screenWidth = 90
  const screenHeight = 18
  const columns = 3
  const spacing = 30
  const trail = 3
  const generations = 19
  const screen = createScreenModule('rainScreen', 'Rain screen', 1, { width: screenWidth, height: screenHeight })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  b.useModule('rainApp', 'Rain app')

  const setPixel = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const present = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  const module = b.project.modules.find((entry) => entry.id === 'rainApp')
  module.imports.push(
    { id: 'rainSetImport', moduleId: 'rainScreen', nodeId: setPixel.nodeId, localName: 'setOne' },
    { id: 'rainPresentImport', moduleId: 'rainScreen', nodeId: present.nodeId, localName: 'present' },
  )

  // Écrit un pixel d'écran : index = y × largeur + x.
  function pixelSet(id, yName, xName, red, green, blue, alpha) {
    b.make(`${id}Statement`, 'ExpressionStatement', {}, { expression: `${id}Call` })
    b.call(`${id}Call`, `${id}Callee`, [`${id}Pixel`, `${id}Red`, `${id}Green`, `${id}Blue`, `${id}Alpha`])
    b.make(`${id}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'rainSetImport' } })
    b.binary(`${id}Pixel`, '+', `${id}Row`, `${id}Column`)
    b.binary(`${id}Row`, '*', `${id}RowY`, `${id}RowWidth`)
    b.ref(`${id}RowY`, yName)
    b.intValue(`${id}RowWidth`, screenWidth)
    b.ref(`${id}Column`, xName)
    b.intValue(`${id}Red`, red)
    b.intValue(`${id}Green`, green)
    b.intValue(`${id}Blue`, blue)
    b.intValue(`${id}Alpha`, alpha)
    return `${id}Statement`
  }

  // Chaque image est une pure fonction des hauteurs : aucune traînée conservée,
  // donc aucun transitoire et une séquence exactement périodique.
  const dropColors = [
    [60, 255, 120, 255],
    [40, 185, 88, 205],
    [22, 112, 55, 150],
  ]

  b.root('rainDrops', 'VariableDeclaration', { name: 'drops', type: intArrayType }, { initializer: 'rainDropsInit' })
  b.make('rainDropsInit', 'MathCall', { name: 'arrayFill' }, { arguments: ['rainSize', 'rainZero'] })
  b.intValue('rainSize', columns)
  b.intValue('rainZero', 0)
  for (let index = 0; index < columns; index += 1) {
    b.make(`rainSeed${index}`, 'AssignmentStatement', {}, { target: `rainSeed${index}Target`, value: `rainSeed${index}Value` })
    b.make(`rainSeed${index}Target`, 'ArrayAccess', {}, { array: `rainSeed${index}Array`, index: `rainSeed${index}Index` })
    b.ref(`rainSeed${index}Array`, 'drops')
    b.intValue(`rainSeed${index}Index`, index)
    b.make(`rainSeed${index}Value`, 'MathCall', { name: 'randomInt' }, { arguments: [`rainSeed${index}Min`, `rainSeed${index}Max`] })
    b.intValue(`rainSeed${index}Min`, 0)
    b.intValue(`rainSeed${index}Max`, screenHeight - 1)
  }
  b.block('rainSeedBody', Array.from({ length: columns }, (_, index) => `rainSeed${index}`))

  b.root('rainMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'rainMainBody' })

  b.make('rainGeneration', 'VariableDeclaration', { name: 'generation', type: intType }, { initializer: 'rainGenerationStart' })
  b.intValue('rainGenerationStart', 0)
  b.binary('rainGenerationTest', '<', 'rainGenerationIndex', 'rainGenerationEnd')
  b.ref('rainGenerationIndex', 'generation')
  b.intValue('rainGenerationEnd', generations)
  b.make('rainGenerationUpdate', 'AssignmentStatement', {}, { target: 'rainGenerationTarget', value: 'rainGenerationValue' })
  b.ref('rainGenerationTarget', 'generation')
  b.binary('rainGenerationValue', '+', 'rainGenerationLeft', 'rainGenerationOne')
  b.ref('rainGenerationLeft', 'generation')
  b.intValue('rainGenerationOne', 1)

  b.make('rainColumn', 'VariableDeclaration', { name: 'column', type: intType }, { initializer: 'rainColumnStart' })
  b.intValue('rainColumnStart', 0)
  b.binary('rainColumnTest', '<', 'rainColumnIndex', 'rainColumnEnd')
  b.ref('rainColumnIndex', 'column')
  b.intValue('rainColumnEnd', columns)
  b.make('rainColumnUpdate', 'AssignmentStatement', {}, { target: 'rainColumnTarget', value: 'rainColumnValue' })
  b.ref('rainColumnTarget', 'column')
  b.binary('rainColumnValue', '+', 'rainColumnLeft', 'rainColumnOne')
  b.ref('rainColumnLeft', 'column')
  b.intValue('rainColumnOne', 1)

  b.make('rainHead', 'VariableDeclaration', { name: 'head', type: intType }, { initializer: 'rainHeadValue' })
  b.make('rainHeadValue', 'ArrayAccess', {}, { array: 'rainHeadArray', index: 'rainHeadIndex' })
  b.ref('rainHeadArray', 'drops')
  b.ref('rainHeadIndex', 'column')
  b.make('rainX', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'rainXValue' })
  b.binary('rainXValue', '*', 'rainXColumn', 'rainXSpacing')
  b.ref('rainXColumn', 'column')
  b.intValue('rainXSpacing', spacing)
  b.make('rainNext', 'VariableDeclaration', { name: 'next', type: intType }, { initializer: 'rainNextValue' })
  b.binary('rainNextValue', '%', 'rainNextSum', 'rainNextHeight')
  b.binary('rainNextSum', '+', 'rainNextHead', 'rainNextOne')
  b.ref('rainNextHead', 'head')
  b.intValue('rainNextOne', 1)
  b.intValue('rainNextHeight', screenHeight)
  b.make('rainDropsAssign', 'AssignmentStatement', {}, { target: 'rainDropsTarget', value: 'rainNextRef' })
  b.make('rainDropsTarget', 'ArrayAccess', {}, { array: 'rainDropsArray', index: 'rainDropsIndex' })
  b.ref('rainDropsArray', 'drops')
  b.ref('rainDropsIndex', 'column')
  b.ref('rainNextRef', 'next')

  // Traînée dessinée entièrement à chaque image, du plus sombre à la tête.
  const columnBody = ['rainHead', 'rainX', 'rainNext']
  b.make('rainClearY', 'VariableDeclaration', { name: 'clearY', type: intType }, { initializer: 'rainClearYValue' })
  b.binary('rainClearYValue', '%', 'rainClearYSum', 'rainClearYHeight')
  b.binary('rainClearYSum', '+', 'rainClearYHead', 'rainClearYOffset')
  b.ref('rainClearYHead', 'head')
  b.intValue('rainClearYOffset', screenHeight - trail)
  b.intValue('rainClearYHeight', screenHeight)
  columnBody.push('rainClearY', pixelSet('rainClearPixel', 'clearY', 'x', 0, 0, 0, 0))
  for (let step = trail - 1; step >= 1; step -= 1) {
    const [red, green, blue, alpha] = dropColors[step] ?? dropColors[0]
    b.make(`rainY${step}`, 'VariableDeclaration', { name: `y${step}`, type: intType }, { initializer: `rainY${step}Value` })
    b.binary(`rainY${step}Value`, '%', `rainY${step}Sum`, `rainY${step}Height`)
    b.binary(`rainY${step}Sum`, '+', `rainY${step}Head`, `rainY${step}Offset`)
    b.ref(`rainY${step}Head`, 'head')
    b.intValue(`rainY${step}Offset`, screenHeight - step)
    b.intValue(`rainY${step}Height`, screenHeight)
    columnBody.push(`rainY${step}`, pixelSet(`rainPixel${step}`, `y${step}`, 'x', red, green, blue, alpha))
  }
  columnBody.push(pixelSet('rainPixel0', 'head', 'x', dropColors[0][0], dropColors[0][1], dropColors[0][2], dropColors[0][3]))
  columnBody.push('rainDropsAssign')
  b.block('rainColumnBody', columnBody)
  b.make('rainColumnLoop', 'ForStatement', {}, { initializer: 'rainColumn', test: 'rainColumnTest', update: 'rainColumnUpdate', body: 'rainColumnBody' })

  b.make('rainPresent', 'ExpressionStatement', {}, { expression: 'rainPresentCall' })
  b.call('rainPresentCall', 'rainPresentCallee', [])
  b.make('rainPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'rainPresentImport' } })

  b.block('rainGenerationBody', ['rainColumnLoop', 'rainPresent'])
  b.make('rainGenerationLoop', 'ForStatement', {}, { initializer: 'rainGeneration', test: 'rainGenerationTest', update: 'rainGenerationUpdate', body: 'rainGenerationBody' })
  b.print('rainPrint', 'rainMessage')
  b.make('rainMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Rain' })
  b.block('rainMainBody', ['rainSeedBody', 'rainGenerationLoop', 'rainPrint'])

  return workspace(b.project, [
    note('rainNote', 'Matrix rain', 'Écran 90×18. Trois colonnes démarrent à une hauteur tirée au hasard ; chaque image redessine la tête en vert vif et sa traînée de trois pixels, sans état conservé. La séquence est donc exactement périodique et boucle sans raccord. $$y \\leftarrow (y + 1) \\bmod 18$$', 0, 620, 760, 240),
  ])
}

// Jauge pilotée depuis un module normal : la valeur monte par paliers pendant l'exécution.
function gaugeDemo() {
  const b = builder()
  const gauge = createGaugeModule('progressGauge', 'Progress gauge', 1, { min: 0, max: 100 })
  b.project.modules.push(gauge.module)
  b.project.nodes.push(...gauge.nodes)
  b.useModule('gaugeApp', 'Gauge app')

  const find = (name) => gauge.module.exports.find((entry) => entry.name === name).nodeId
  const app = b.project.modules.find((module) => module.id === 'gaugeApp')
  app.imports.push(
    { id: 'addImport', moduleId: 'progressGauge', nodeId: find('GAUGE_SP3_ADD_VALUE_1'), localName: 'addValue' },
    { id: 'resetImport', moduleId: 'progressGauge', nodeId: find('GAUGE_SP3_RESET_1'), localName: 'resetGauge' },
  )

  // Appelle une fonction importée avec ses arguments.
  function importedCall(prefix, importId, args) {
    b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    b.call(`${prefix}Call`, `${prefix}Callee`, args)
    b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
    return `${prefix}Statement`
  }

  b.root('gaugeMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'gaugeMainBody' })
  b.make('gaugeReset', 'ExpressionStatement', {}, { expression: 'gaugeResetCall' })
  b.call('gaugeResetCall', 'gaugeResetCallee', [])
  b.make('gaugeResetCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'resetImport' } })
  b.make('gaugeIndex', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'gaugeIndexStart' })
  b.intValue('gaugeIndexStart', 0)
  b.binary('gaugeTest', '<', 'gaugeTestIndex', 'gaugeTestEnd')
  b.ref('gaugeTestIndex', 'i')
  b.intValue('gaugeTestEnd', 5)
  b.make('gaugeUpdate', 'AssignmentStatement', {}, { target: 'gaugeUpdateTarget', value: 'gaugeUpdateValue' })
  b.ref('gaugeUpdateTarget', 'i')
  b.binary('gaugeUpdateValue', '+', 'gaugeUpdateLeft', 'gaugeUpdateOne')
  b.ref('gaugeUpdateLeft', 'i')
  b.intValue('gaugeUpdateOne', 1)
  b.make('gaugeStepValue', 'Literal', { type: doubleType, value: '20.0' })
  b.block('gaugeLoopBody', [importedCall('gaugeAdd', 'addImport', ['gaugeStepValue'])])
  b.make('gaugeLoop', 'ForStatement', {}, { initializer: 'gaugeIndex', test: 'gaugeTest', update: 'gaugeUpdate', body: 'gaugeLoopBody' })
  b.print('gaugePrint', 'gaugeMessage')
  b.make('gaugeMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Gauge full' })
  b.block('gaugeMainBody', ['gaugeReset', 'gaugeLoop', 'gaugePrint'])

  return workspace(b.project, [
    note('gaugeNote', 'Gauge', 'La jauge est pilotée depuis Gauge app : RESET puis cinq ADD_VALUE(20) la remplissent de 0 à 100. Son module caché exporte SET_VALUE, ADD_VALUE, GET_VALUE, GET_MIN, GET_MAX, SET_RANGE et RESET.', 0, 520, 620, 240),
  ])
}

// Tableau de bord : un pixel-voiture avance selon une vitesse lissée et aléatoire, affichée par la jauge.
function carDashboard() {
  const b = builder()
  const width = 90
  const height = 14
  const frames = 56
  const screen = createScreenModule('carScreen', 'Road', 1, { width, height })
  const gauge = createGaugeModule('carGauge', 'Speed', 1, { min: 0, max: 100 })
  b.project.modules.push(screen.module, gauge.module)
  b.project.nodes.push(...screen.nodes, ...gauge.nodes)
  b.useModule('carApp', 'Car dashboard')

  const app = b.project.modules.find((module) => module.id === 'carApp')
  const setPixel = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const present = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  const setSpeed = gauge.module.exports.find((entry) => entry.name === 'GAUGE_SP3_SET_VALUE_1')
  app.imports.push(
    { id: 'carPixelImport', moduleId: 'carScreen', nodeId: setPixel.nodeId, localName: 'setPixel' },
    { id: 'carPresentImport', moduleId: 'carScreen', nodeId: present.nodeId, localName: 'present' },
    { id: 'carGaugeImport', moduleId: 'carGauge', nodeId: setSpeed.nodeId, localName: 'setSpeed' },
  )

  // Écrit un pixel d'écran à un index fixe, hors de la boucle.
  function fixedPixel(prefix, index, red, green, blue, alpha) {
    b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    b.call(`${prefix}Call`, `${prefix}Callee`, [`${prefix}Index`, `${prefix}Red`, `${prefix}Green`, `${prefix}Blue`, `${prefix}Alpha`])
    b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'carPixelImport' } })
    b.intValue(`${prefix}Index`, index)
    b.intValue(`${prefix}Red`, red); b.intValue(`${prefix}Green`, green); b.intValue(`${prefix}Blue`, blue); b.intValue(`${prefix}Alpha`, alpha)
    return `${prefix}Statement`
  }

  // Écrit la voiture à `position` sur la ligne de route, avec un repli circulaire.
  function carPixel(prefix, red, green, blue, alpha) {
    b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    b.call(`${prefix}Call`, `${prefix}Callee`, [`${prefix}Index`, `${prefix}Red`, `${prefix}Green`, `${prefix}Blue`, `${prefix}Alpha`])
    b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'carPixelImport' } })
    b.binary(`${prefix}Index`, '+', `${prefix}Row`, `${prefix}Column`)
    b.binary(`${prefix}Row`, '*', `${prefix}RowY`, `${prefix}RowWidth`)
    b.intValue(`${prefix}RowY`, 6)
    b.intValue(`${prefix}RowWidth`, width)
    b.binary(`${prefix}Column`, '%', `${prefix}ColumnSum`, `${prefix}ColumnWidth`)
    b.binary(`${prefix}ColumnSum`, '+', `${prefix}ColumnBase`, `${prefix}ColumnOffset`)
    b.ref(`${prefix}ColumnBase`, 'position')
    b.intValue(`${prefix}ColumnOffset`, 0)
    b.intValue(`${prefix}ColumnWidth`, width)
    b.intValue(`${prefix}Red`, red); b.intValue(`${prefix}Green`, green); b.intValue(`${prefix}Blue`, blue); b.intValue(`${prefix}Alpha`, alpha)
    return `${prefix}Statement`
  }

  // Ligne de route en pointillés, dessinée une fois avant les images.
  const roadStatements = []
  for (let x = 0; x < width; x += 6) roadStatements.push(fixedPixel(`carDash${x}`, 10 * width + x, 48, 52, 66, 255))

  // Position, vitesse et cible aléatoire, conservées entre deux images.
  const globalVariable = (id, name, value) => {
    b.root(id, 'VariableDeclaration', { name, type: intType }, { initializer: `${id}Start` })
    b.intValue(`${id}Start`, value)
  }
  globalVariable('carPosition', 'position', 0)
  globalVariable('carSpeed', 'speed', 0)
  globalVariable('carTarget', 'target', 0)

  b.root('carMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'carMainBody' })
  b.make('carFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'carFrameStart' })
  b.intValue('carFrameStart', 0)
  b.binary('carFrameTest', '<', 'carFrameRead', 'carFrameEnd')
  b.ref('carFrameRead', 'frame')
  b.intValue('carFrameEnd', frames)
  b.make('carFrameUpdate', 'AssignmentStatement', {}, { target: 'carFrameTarget', value: 'carFrameNext' })
  b.ref('carFrameTarget', 'frame')
  b.binary('carFrameNext', '+', 'carFrameNextRead', 'carFrameOne')
  b.ref('carFrameNextRead', 'frame')
  b.intValue('carFrameOne', 1)

  // Cible aléatoire rafraîchie toutes les huit images, puis vitesse qui s'en approche par pas de 10.
  b.make('carTargetIf', 'IfStatement', {}, { test: 'carTargetTest', consequent: 'carTargetBody', alternate: null })
  b.binary('carTargetTest', '==', 'carFrameModulo', 'carTargetZero')
  b.binary('carFrameModulo', '%', 'carFrameModuloRead', 'carTargetEvery')
  b.ref('carFrameModuloRead', 'frame')
  b.intValue('carTargetEvery', 8)
  b.intValue('carTargetZero', 0)
  b.block('carTargetBody', ['carTargetAssign'])
  b.make('carTargetAssign', 'AssignmentStatement', {}, { target: 'carTargetTarget', value: 'carTargetCall' })
  b.ref('carTargetTarget', 'target')
  b.make('carTargetCall', 'MathCall', { name: 'randomInt' }, { arguments: ['carTargetMin', 'carTargetMax'] })
  b.intValue('carTargetMin', 0); b.intValue('carTargetMax', 100)
  b.make('carSpeedAssign', 'AssignmentStatement', {}, { target: 'carSpeedTarget', value: 'carSpeedClamp' })
  b.ref('carSpeedTarget', 'speed')
  b.make('carSpeedClamp', 'MathCall', { name: 'clamp' }, { arguments: ['carSpeedNext', 'carZero', 'carHundred'] })
  b.binary('carSpeedNext', '+', 'carSpeedRead', 'carSpeedStep')
  b.ref('carSpeedRead', 'speed')
  b.binary('carSpeedStep', '*', 'carSpeedSign', 'carSpeedFive')
  b.make('carSpeedSign', 'MathCall', { name: 'sign' }, { arguments: ['carSpeedDelta'] })
  b.binary('carSpeedDelta', '-', 'carTargetRead', 'carSpeedCurrent')
  b.ref('carTargetRead', 'target'); b.ref('carSpeedCurrent', 'speed')
  b.intValue('carSpeedFive', 10); b.intValue('carZero', 0); b.intValue('carHundred', 100)

  // Une case par tranche de 10 de vitesse : 0 à 10 cases par image, repliées sur la largeur.
  b.make('carPositionAssign', 'AssignmentStatement', {}, { target: 'carPositionTarget', value: 'carPositionNext' })
  b.ref('carPositionTarget', 'position')
  b.binary('carPositionNext', '%', 'carPositionSum', 'carPositionWidth')
  b.binary('carPositionSum', '+', 'carPositionRead', 'carCells')
  b.ref('carPositionRead', 'position')
  b.binary('carCells', '/', 'carSpeedCells', 'carCellsTen')
  b.ref('carSpeedCells', 'speed'); b.intValue('carCellsTen', 10)
  b.intValue('carPositionWidth', width)

  // Le pixel avance réellement de `position`, puis l'image est publiée et la jauge mise à jour.
  b.make('carPresentStatement', 'ExpressionStatement', {}, { expression: 'carPresentCall' })
  b.call('carPresentCall', 'carPresentCallee', [])
  b.make('carPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'carPresentImport' } })
  b.make('carGaugeStatement', 'ExpressionStatement', {}, { expression: 'carGaugeCall' })
  b.call('carGaugeCall', 'carGaugeCallee', ['carSpeedDouble'])
  b.make('carGaugeCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'carGaugeImport' } })
  b.make('carSpeedDouble', 'CastExpression', { type: doubleType }, { argument: 'carSpeedDoubleArg' })
  b.ref('carSpeedDoubleArg', 'speed')

  b.block('carLoopBody', [
    'carTargetIf', 'carSpeedAssign',
    carPixel('carClear', 0, 0, 0, 0),
    'carPositionAssign',
    carPixel('carDraw', 255, 213, 71, 255),
    'carGaugeStatement', 'carPresentStatement',
  ])
  b.make('carLoop', 'ForStatement', {}, { initializer: 'carFrame', test: 'carFrameTest', update: 'carFrameUpdate', body: 'carLoopBody' })
  b.print('carPrint', 'carMessage')
  b.make('carMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Car dashboard' })
  b.block('carMainBody', [...roadStatements, 'carLoop', 'carPrint'])

  const result = workspace(b.project, [
    note('carRoadNote', 'Road', 'Un pixel-voiture avance de `vitesse / 10` cases par image et se replie au bord. La ligne de route reste fixe ; seuls le pixel et la jauge changent.', 0, 820, 620, 240),
    note('carGaugeNote', 'Speed', 'Toutes les huit images, une cible aléatoire entre 0 et 100 remplace la précédente ; la vitesse s’en approche par pas de 10 : la jauge reste dans ses bornes et suit une accélération progressive. $$v \\leftarrow \\operatorname{clamp}(v + 10\\,\\operatorname{sign}(cible - v),\\, 0,\\, 100)$$', 660, 820, 620, 240),
    note('carAppNote', 'Car dashboard', 'main dessine les pointillés, puis 56 images : cible aléatoire, vitesse lissée, déplacement du pixel, présentation et mise à jour de la jauge. Lecture à 24 fps.', 0, 520, 620, 240),
  ])
  const cards = result.presentation.cards
  const screenCard = cards.find((card) => card.id === 'carScreen')
  if (screenCard) Object.assign(screenCard, { width: 760, height: 300 })
  const gaugeCard = cards.find((card) => card.id === 'carGauge')
  if (gaugeCard) gaugeCard.x = 820
  const appCard = cards.find((card) => card.id === 'carApp')
  if (appCard) appCard.x = 1240
  return result
}
// Programmation dynamique : sac à dos 0/1, table `dp` remplie de droite à gauche.
function knapsack() {
  const b = builder()
  b.useModule('knapsack', 'Knapsack')
  b.root('knapBest', 'FunctionDeclaration', { name: 'bestValue', type: intType }, { parameters: ['knapWeights', 'knapValues', 'knapCapacity'], body: 'knapBody' })
  b.make('knapWeights', 'Parameter', { name: 'weights', type: intArrayType })
  b.make('knapValues', 'Parameter', { name: 'values', type: intArrayType })
  b.make('knapCapacity', 'Parameter', { name: 'capacity', type: intType })
  b.block('knapBody', ['knapDp', 'knapI', 'knapOuter', 'knapReturn'])
  // dp = arrayFill(capacity + 1, 0) : meilleure valeur pour chaque capacité de 0 à capacity.
  b.make('knapDp', 'VariableDeclaration', { name: 'dp', type: intArrayType }, { initializer: 'knapDpInit' })
  b.make('knapDpInit', 'MathCall', { name: 'arrayFill' }, { arguments: ['knapCapacityPlus', 'knapZero'] })
  b.binary('knapCapacityPlus', '+', 'knapCapacityRef', 'knapOne'); b.ref('knapCapacityRef', 'capacity'); b.intValue('knapOne', 1)
  b.intValue('knapZero', 0)
  b.make('knapI', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'knapIStart' }); b.intValue('knapIStart', 0)
  b.make('knapOuter', 'WhileStatement', {}, { test: 'knapOuterTest', body: 'knapOuterBody' })
  b.binary('knapOuterTest', '<', 'knapIRead', 'knapWeightsLength'); b.ref('knapIRead', 'i')
  b.make('knapWeightsLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['knapWeightsRef'] }); b.ref('knapWeightsRef', 'weights')
  b.block('knapOuterBody', ['knapC', 'knapInner', 'knapIStep'])
  b.make('knapC', 'VariableDeclaration', { name: 'c', type: intType }, { initializer: 'knapCStart' }); b.ref('knapCStart', 'capacity')
  b.make('knapInner', 'WhileStatement', {}, { test: 'knapInnerTest', body: 'knapInnerBody' })
  // Parcours de la capacité vers le bas : chaque objet n'est utilisé qu'une fois.
  b.binary('knapInnerTest', '>=', 'knapCRead', 'knapWeightItem'); b.ref('knapCRead', 'c')
  b.access('knapWeightItem', 'knapWeightsItemArray', 'knapWeightsItemIndex'); b.ref('knapWeightsItemArray', 'weights'); b.ref('knapWeightsItemIndex', 'i')
  b.block('knapInnerBody', ['knapAssign', 'knapCStep'])
  b.make('knapAssign', 'AssignmentStatement', {}, { target: 'knapDpTarget', value: 'knapBestCall' })
  b.access('knapDpTarget', 'knapDpTargetArray', 'knapDpTargetIndex'); b.ref('knapDpTargetArray', 'dp'); b.ref('knapDpTargetIndex', 'c')
  b.make('knapBestCall', 'MathCall', { name: 'max' }, { arguments: ['knapDpCurrent', 'knapTakeValue'] })
  b.access('knapDpCurrent', 'knapDpCurrentArray', 'knapDpCurrentIndex'); b.ref('knapDpCurrentArray', 'dp'); b.ref('knapDpCurrentIndex', 'c')
  b.binary('knapTakeValue', '+', 'knapDpRemaining', 'knapItemValue')
  b.access('knapDpRemaining', 'knapDpRemainingArray', 'knapDpRemainingIndex'); b.ref('knapDpRemainingArray', 'dp')
  b.binary('knapDpRemainingIndex', '-', 'knapCRemaining', 'knapWeightRemaining'); b.ref('knapCRemaining', 'c')
  b.access('knapWeightRemaining', 'knapWeightsRemainingArray', 'knapWeightsRemainingIndex'); b.ref('knapWeightsRemainingArray', 'weights'); b.ref('knapWeightsRemainingIndex', 'i')
  b.access('knapItemValue', 'knapValuesItemArray', 'knapValuesItemIndex'); b.ref('knapValuesItemArray', 'values'); b.ref('knapValuesItemIndex', 'i')
  b.make('knapCStep', 'AssignmentStatement', {}, { target: 'knapCTarget', value: 'knapCNext' })
  b.ref('knapCTarget', 'c'); b.binary('knapCNext', '-', 'knapCStepRead', 'knapCOne'); b.ref('knapCStepRead', 'c'); b.intValue('knapCOne', 1)
  b.make('knapIStep', 'AssignmentStatement', {}, { target: 'knapITarget', value: 'knapINext' })
  b.ref('knapITarget', 'i'); b.binary('knapINext', '+', 'knapIStepRead', 'knapIOne'); b.ref('knapIStepRead', 'i'); b.intValue('knapIOne', 1)
  b.returnValue('knapReturn', 'knapDpFinal')
  b.access('knapDpFinal', 'knapDpFinalArray', 'knapDpFinalIndex'); b.ref('knapDpFinalArray', 'dp'); b.ref('knapDpFinalIndex', 'capacity')

  b.useModule('knapsackApp', 'Knapsack demo')
  b.root('knapWeightsData', 'VariableDeclaration', { name: 'weights', type: intArrayType }, { initializer: 'knapWeightsList' })
  b.make('knapWeightsList', 'ArrayLiteral', { elementType: intType }, { elements: ['knapWeight1', 'knapWeight3', 'knapWeight4', 'knapWeight5'] })
  b.intValue('knapWeight1', 1); b.intValue('knapWeight3', 3); b.intValue('knapWeight4', 4); b.intValue('knapWeight5', 5)
  b.root('knapValuesData', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'knapValuesList' })
  b.make('knapValuesList', 'ArrayLiteral', { elementType: intType }, { elements: ['knapValue1', 'knapValue4', 'knapValue5', 'knapValue7'] })
  b.intValue('knapValue1', 1); b.intValue('knapValue4', 4); b.intValue('knapValue5', 5); b.intValue('knapValue7', 7)
  b.root('knapMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'knapMainBody' })
  b.block('knapMainBody', ['knapPrint'])
  b.print('knapPrint', 'knapCall')
  b.call('knapCall', 'knapImportRef', ['knapWeightsArg', 'knapValuesArg', 'knapCapacityArg'])
  b.make('knapImportRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'knapImport' } })
  b.ref('knapWeightsArg', 'weights'); b.ref('knapValuesArg', 'values'); b.intValue('knapCapacityArg', 7)
  b.project.modules.find((module) => module.id === 'knapsack').exports.push({ nodeId: 'knapBest', name: 'bestValue' })
  b.project.modules.find((module) => module.id === 'knapsackApp').imports.push({ id: 'knapImport', moduleId: 'knapsack', nodeId: 'knapBest', localName: 'bestValue' })
  return workspace(b.project, [note('knapsackNote', 'Knapsack', 'Sac à dos 0/1 par programmation dynamique : `dp[c]` garde la meilleure valeur atteignable avec la capacité `c`. Pour chaque objet, la capacité est parcourue de haut en bas afin de ne le compter qu’une fois. `bestValue([1, 3, 4, 5], [1, 4, 5, 7], 7)` renvoie 9. $$dp[c] \\leftarrow \\max(dp[c],\\; dp[c - w] + v)$$', 0, 520, 620, 240)])
}

// Trois niveaux de difficulté, du plus simple au plus avancé.
export const exampleCategories = [
  { id: 'simple', labelKey: 'examples.category.simple' },
  { id: 'medium', labelKey: 'examples.category.medium' },
  { id: 'hard', labelKey: 'examples.category.hard' },
]

// Catalogue local, ouvrable sans réseau ni fichier externe, classé par difficulté puis par thème.
export const examples = [
  { id: 'fibonacci', labelKey: 'examples.fibonacci', category: 'simple', subcategory: 'basics', build: fibonacci },
  { id: 'recursion', labelKey: 'examples.recursion', category: 'simple', subcategory: 'basics', build: recursion },
  { id: 'arrays', labelKey: 'examples.arrays', category: 'simple', subcategory: 'arrays', build: arrays },
  { id: 'foreach', labelKey: 'examples.forEach', category: 'simple', subcategory: 'arrays', build: forEach },
  { id: 'sorting', labelKey: 'examples.sorting', category: 'simple', subcategory: 'sorting', build: sorting },
  { id: 'maths', labelKey: 'examples.maths', category: 'simple', subcategory: 'operations', build: maths },
  { id: 'imports', labelKey: 'examples.imports', category: 'simple', subcategory: 'modules', build: imports },
  { id: 'pointers', labelKey: 'examples.pointers', category: 'medium', subcategory: 'pointers', build: pointers },
  { id: 'higherOrder', labelKey: 'examples.higherOrder', category: 'medium', subcategory: 'functions', build: higherOrder },
  { id: 'quickSort', labelKey: 'examples.quickSort', category: 'medium', subcategory: 'sorting', build: quickSort },
  { id: 'coinChange', labelKey: 'examples.coinChange', category: 'medium', subcategory: 'dynamic', build: coinChange },
  { id: 'gaugeDemo', labelKey: 'examples.gaugeDemo', category: 'medium', subcategory: 'widgets', build: gaugeDemo },
  { id: 'carDashboard', labelKey: 'examples.carDashboard', category: 'medium', subcategory: 'widgets', build: carDashboard },
  { id: 'pixelScreens', labelKey: 'examples.pixelScreens', category: 'medium', subcategory: 'animation', build: pixelScreens },
  { id: 'rain', labelKey: 'examples.rain', category: 'medium', subcategory: 'animation', build: rain },
  { id: 'knapsack', labelKey: 'examples.knapsack', category: 'hard', subcategory: 'dynamic', build: knapsack },
  { id: 'calculus', labelKey: 'examples.calculus', category: 'hard', subcategory: 'operations', build: calculus },
  { id: 'gameOfLife', labelKey: 'examples.gameOfLife', category: 'hard', subcategory: 'automata', build: gameOfLife },
]

// Sous-catégories facultatives à l'intérieur d'une catégorie du volet Examples.
export const exampleSubcategories = [
  { id: 'basics', labelKey: 'examples.sub.basics' },
  { id: 'arrays', labelKey: 'examples.sub.arrays' },
  { id: 'sorting', labelKey: 'examples.sub.sorting' },
  { id: 'operations', labelKey: 'examples.sub.operations' },
  { id: 'modules', labelKey: 'examples.sub.modules' },
  { id: 'pointers', labelKey: 'examples.sub.pointers' },
  { id: 'functions', labelKey: 'examples.sub.functions' },
  { id: 'widgets', labelKey: 'examples.sub.widgets' },
  { id: 'dynamic', labelKey: 'examples.sub.dynamic' },
  { id: 'animation', labelKey: 'examples.sub.animation' },
  { id: 'automata', labelKey: 'examples.sub.automata' },
]
