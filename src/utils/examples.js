import { createProject, createModule, createNode, bindInputButtonCallback } from './logic/index.js'
import { createScreenModule, screenDefaults } from './screenNode.js'
import { createGaugeModule, gaugeDefaults } from './gaugeNode.js'
import { createLedModule, ledDefaults } from './ledNode.js'
import { createRgbLedModule, rgbLedDefaults } from './rgbLedNode.js'
import { createInputButtonModule, inputButtonDefaults } from './inputButtonNode.js'
import { createProgressModule, progressDefaults } from './progressNode.js'
import { createBarChartModule, barChartDefaults } from './barChartNode.js'
import { createXyPlotModule } from './xyPlotNode.js'
import { createOscilloscopeModule } from './oscilloscopeNode.js'
import { createHeatmapModule } from './heatmapNode.js'
import { moduleTypes } from './moduleTypes.js'
import { workspaceFileVersion } from './workspaceFile.js'
import { widgetExamples } from './widgetExamples.js'
import { showcaseExamples } from './showcaseExamples.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
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
  const assign = (id, target, value) => make(id, 'AssignmentStatement', {}, { target, value })
  const variable = (id, name, type, initializer = null) => make(id, 'VariableDeclaration', { name, type }, { initializer })
  const math = (id, name, args) => make(id, 'MathCall', { name }, { arguments: args })
  const ifThen = (id, test, consequent, alternate = null) => make(id, 'IfStatement', {}, { test, consequent, alternate })
  const forLoop = (id, initializer, test, update, body) => make(id, 'ForStatement', {}, { initializer, test, update, body })
  const doubleValue = (id, value) => make(id, 'Literal', { type: doubleType, value })
  const stringValue = (id, value) => make(id, 'Literal', { type: { kind: 'primitive', name: 'string' }, value })
  // Boucle `for` enti?re standard, avec des identifiants pr?fix?s pour rester lisibles.
  const countedLoop = (prefix, name, limitId, body, start = 0) => {
    variable(`${prefix}Decl`, name, intType, `${prefix}Start`)
    intValue(`${prefix}Start`, start)
    binary(`${prefix}Test`, '<', `${prefix}Read`, limitId)
    ref(`${prefix}Read`, name)
    assign(`${prefix}Update`, `${prefix}Target`, `${prefix}Next`)
    ref(`${prefix}Target`, name)
    binary(`${prefix}Next`, '+', `${prefix}NextRead`, `${prefix}One`)
    ref(`${prefix}NextRead`, name)
    intValue(`${prefix}One`, 1)
    block(`${prefix}Body`, body)
    forLoop(`${prefix}Loop`, `${prefix}Decl`, `${prefix}Test`, `${prefix}Update`, `${prefix}Body`)
    return `${prefix}Loop`
  }
  // Déclare le drapeau interne qui prolonge une boucle d'animation en live.
  const liveFlag = () => {
    make('sp3LiveFalse', 'Literal', { type: booleanType, value: false })
    root('sp3Live', 'VariableDeclaration', { name: 'SP3_LIVE', type: booleanType }, { initializer: 'sp3LiveFalse' })
  }
  // Condition de boucle pour un `for` manuel : SP3_LIVE ou borne.
  const liveTest = (prefix, frameRef, limitRef) => {
    ref(`${prefix}Live`, 'SP3_LIVE')
    binary(`${prefix}Below`, '<', frameRef, limitRef)
    binary(`${prefix}Test`, 'or', `${prefix}Live`, `${prefix}Below`)
    return `${prefix}Test`
  }
  // Répète une séquence d'images précalculées en live, une seule fois en borné.
  const liveRepeat = (prefix, body) => {
    variable(`${prefix}Pass`, 'pass', intType, `${prefix}PassStart`)
    intValue(`${prefix}PassStart`, 0)
    ref(`${prefix}Live`, 'SP3_LIVE')
    binary(`${prefix}Below`, '<', `${prefix}PassRead`, `${prefix}PassEnd`)
    ref(`${prefix}PassRead`, 'pass')
    intValue(`${prefix}PassEnd`, 1)
    binary(`${prefix}Test`, 'or', `${prefix}Live`, `${prefix}Below`)
    assign(`${prefix}Update`, `${prefix}PassTarget`, `${prefix}PassNext`)
    ref(`${prefix}PassTarget`, 'pass')
    binary(`${prefix}PassNext`, '+', `${prefix}PassNextRead`, `${prefix}PassOne`)
    ref(`${prefix}PassNextRead`, 'pass')
    intValue(`${prefix}PassOne`, 1)
    block(`${prefix}LoopBody`, body)
    forLoop(`${prefix}Loop`, `${prefix}Pass`, `${prefix}Test`, `${prefix}Update`, `${prefix}LoopBody`)
    return `${prefix}Loop`
  }
  // Boucle d'animation : finie en Run borné, infinie en Run live.
  const liveLoop = (prefix, name, limitId, body, start = 0) => {
    variable(`${prefix}Decl`, name, intType, `${prefix}Start`)
    intValue(`${prefix}Start`, start)
    ref(`${prefix}Live`, 'SP3_LIVE')
    binary(`${prefix}Below`, '<', `${prefix}Read`, limitId)
    ref(`${prefix}Read`, name)
    binary(`${prefix}Test`, 'or', `${prefix}Live`, `${prefix}Below`)
    assign(`${prefix}Update`, `${prefix}Target`, `${prefix}Next`)
    ref(`${prefix}Target`, name)
    binary(`${prefix}Next`, '+', `${prefix}NextRead`, `${prefix}One`)
    ref(`${prefix}NextRead`, name)
    intValue(`${prefix}One`, 1)
    block(`${prefix}Body`, body)
    forLoop(`${prefix}Loop`, `${prefix}Decl`, `${prefix}Test`, `${prefix}Update`, `${prefix}Body`)
    return `${prefix}Loop`
  }
  // D?r?f?rencement `*p` (lecture ou cible d'?criture) et prise d'adresse `&x`.
  const deref = (id, operand) => make(id, 'UnaryExpression', { operator: '*' }, { operand })
  const address = (id, operand) => make(id, 'UnaryExpression', { operator: '&' }, { operand })
  return { project, useModule, make, root, ref, intValue, binary, access, print, returnValue, call, block, assign, variable, math, ifThen, forLoop, countedLoop, liveFlag, liveTest, liveRepeat, liveLoop, doubleValue, stringValue, deref, address }
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
      : module.progress
        ? { id: module.id, type: 'progress', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.progress.width, height: moduleTypes.progress.height, expandedNodeIds: [] }
        : module.heatmap
          ? { id: module.id, type: 'heatmap', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.heatmap.width, height: moduleTypes.heatmap.height, expandedNodeIds: [] }
        : module.barChart
          ? { id: module.id, type: 'barChart', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.barChart.width, height: moduleTypes.barChart.height, expandedNodeIds: [] }
          : module.xyPlot
            ? { id: module.id, type: 'xyPlot', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.xyPlot.width, height: moduleTypes.xyPlot.height, expandedNodeIds: [] }
            : module.oscilloscope
              ? { id: module.id, type: 'oscilloscope', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.oscilloscope.width, height: moduleTypes.oscilloscope.height, expandedNodeIds: [] }
            : module.led
            ? { id: module.id, type: 'led', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.led.width, height: moduleTypes.led.height, expandedNodeIds: [] }
            : module.rgbLed
              ? { id: module.id, type: 'rgbLed', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.rgbLed.width, height: moduleTypes.rgbLed.height, expandedNodeIds: [] }
              : module.inputButton
                ? (() => {
                  const type = module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton'
                  return { id: module.id, type, name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes[type].width, height: moduleTypes[type].height, expandedNodeIds: [], pressed: false }
                })()
              : module.kind === 'class'
                ? { id: module.id, type: 'class', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: moduleTypes.class.width, height: moduleTypes.class.height, expandedNodeIds: [] }
                : { id: module.id, type: 'module', name: module.name, x: (position % 3) * 600, y: Math.floor(position / 3) * 520, width: Math.max(definition.width, 520), height: Math.max(definition.height, 420), expandedNodeIds: [] })
  cards.push(...notes)
  return { application: 'Sapphire 3', workspaceVersion: workspaceFileVersion, project, presentation: { cards, camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null } }
}

// Ajoute une importation de fonction au module courant.
function importFunction(module, id, moduleId, nodeId, localName) {
  module.imports.push({ id, moduleId, nodeId, localName })
}

// Produit une instruction d'appel à une fonction importée.
function callStatement(b, prefix, importId, args = []) {
  b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
  b.call(`${prefix}Call`, `${prefix}Callee`, args)
  b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
  return `${prefix}Statement`
}

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
  b.liveFlag()
  b.root('screenMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'screenMainBody' })
  b.block('screenMainBody', ['screenStartOne', 'screenLoop', 'screenPrint'])
  // Dessine un premier logo avant la boucle : l'écran n'est jamais vide.
  b.make('screenStartOne', 'ExpressionStatement', {}, { expression: 'screenStartOneCall' })
  b.call('screenStartOneCall', 'screenStartOneCallee', [])
  b.make('screenStartOneCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'bounceOneImport' } })
  b.make('screenFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'screenFrameStart' })
  b.intValue('screenFrameStart', 0)
  b.liveTest('screen', 'screenFrameIndex', 'screenFrameEnd')
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
  b.liveFlag()

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
  b.liveTest('lifeGeneration', 'lifeGenerationIndex', 'lifeGenerationEnd')
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
  b.liveFlag()

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
  b.liveTest('rainGeneration', 'rainGenerationIndex', 'rainGenerationEnd')
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

// Trafic routier : grille de charge, files par voie et débit global.
function trafficControl() {
  const b = builder()
  const heat = createHeatmapModule('trafficHeat', 'Road load', 1, { width: 10, height: 5 })
  const bars = createBarChartModule('trafficBars', 'Lane queues', 1, { size: 6 })
  const flow = createProgressModule('trafficFlow', 'Flow rate', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, flow.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...flow.nodes)
  b.useModule('trafficApp', 'Traffic control')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'trafficApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'heatCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'heatCell')
  importFunction(app, 'laneValue', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'laneValue')
  importFunction(app, 'flowValue', flow.module.id, exported(flow, 'PROGRESS_SP3_SET_VALUE_1'), 'flowValue')
  importFunction(app, 'flowRange', flow.module.id, exported(flow, 'PROGRESS_SP3_SET_RANGE_1'), 'flowRange')

  b.intValue('trafficWidth', 10); b.intValue('trafficHeight', 5); b.intValue('trafficPhases', 2); b.intValue('trafficLanes', 6)
  b.intValue('trafficEleven', 11); b.intValue('trafficNine', 9); b.intValue('trafficSeven', 7); b.intValue('trafficFive', 5)
  b.intValue('trafficSevenLane', 7); b.intValue('trafficFiveLane', 5)
  b.intValue('trafficThree', 3); b.intValue('trafficTwo', 2); b.intValue('trafficForty', 40); b.intValue('trafficHundred', 100)
  b.intValue('trafficSeedMin', 0); b.intValue('trafficSeedMax', 10)
  b.make('trafficSeedDecl', 'VariableDeclaration', { name: 'trafficSeed', type: intType }, { initializer: 'trafficSeedValue' })
  b.make('trafficSeedValue', 'MathCall', { name: 'randomInt' }, { arguments: ['trafficSeedMin', 'trafficSeedMax'] })
  b.doubleValue('trafficMin', '0.0'); b.doubleValue('trafficMax', '100.0')
  const range = callStatement(b, 'trafficRange', 'flowRange', ['trafficMin', 'trafficMax'])

  // Charge : (x × 3 + y × 5 + phase × 2) mod 11, amplifiée sur 0..90.
  b.binary('trafficX3', '*', 'trafficX3Read', 'trafficThree'); b.ref('trafficX3Read', 'x')
  b.binary('trafficY5', '*', 'trafficY5Read', 'trafficFive'); b.ref('trafficY5Read', 'y')
  b.binary('trafficP2', '*', 'trafficP2Read', 'trafficTwo'); b.ref('trafficP2Read', 'phase')
  b.binary('trafficSum1', '+', 'trafficX3', 'trafficY5')
  b.binary('trafficSum2', '+', 'trafficSum1', 'trafficP2')
  b.binary('trafficSumSeed', '+', 'trafficSum2', 'trafficSeedRef')
  b.ref('trafficSeedRef', 'trafficSeed')
  b.binary('trafficDensity', '%', 'trafficSumSeed', 'trafficEleven')
  b.binary('trafficLoad', '*', 'trafficDensity', 'trafficNine')
  callStatement(b, 'trafficCell', 'heatCell', ['trafficXRef', 'trafficYRef', 'trafficLoad'])
  b.ref('trafficXRef', 'x'); b.ref('trafficYRef', 'y')
  const yLoop = b.countedLoop('trafficY', 'y', 'trafficHeight', ['trafficCellStatement'])
  const xLoop = b.countedLoop('trafficX', 'x', 'trafficWidth', [yLoop])

  // Files par voie : motif court, différent à chaque phase.
  b.binary('trafficLane7', '*', 'trafficLane7Read', 'trafficSevenLane'); b.ref('trafficLane7Read', 'lane')
  b.binary('trafficLanePhase', '*', 'trafficLanePhaseRead', 'trafficFiveLane'); b.ref('trafficLanePhaseRead', 'phase')
  b.binary('trafficLaneSum', '+', 'trafficLane7', 'trafficLanePhase')
  b.binary('trafficLaneSeed', '+', 'trafficLaneSum', 'trafficLaneSeedRef')
  b.ref('trafficLaneSeedRef', 'trafficSeed')
  b.binary('trafficQueue', '%', 'trafficLaneSeed', 'trafficForty')
  callStatement(b, 'trafficLaneSet', 'laneValue', ['trafficLaneRef', 'trafficQueue'])
  b.ref('trafficLaneRef', 'lane')
  const laneLoop = b.countedLoop('trafficLane', 'lane', 'trafficLanes', ['trafficLaneSetStatement'])

  // Débit : 100 au départ, puis -7 par phase.
  b.binary('trafficFlowDrop', '*', 'trafficFlowDropRead', 'trafficSeven'); b.ref('trafficFlowDropRead', 'phase')
  b.binary('trafficFlowInt', '-', 'trafficHundred', 'trafficFlowDrop')
  b.make('trafficFlowDouble', 'CastExpression', { type: doubleType }, { argument: 'trafficFlowInt' })
  callStatement(b, 'trafficFlowSet', 'flowValue', ['trafficFlowDouble'])
  const phaseLoop = b.liveLoop('trafficPhase', 'phase', 'trafficPhases', [xLoop, laneLoop, 'trafficFlowSetStatement'])

  b.root('trafficMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'trafficBody' })
  b.stringValue('trafficMessage', 'Traffic control')
  b.print('trafficPrint', 'trafficMessage')
  b.block('trafficBody', ['trafficSeedDecl', range, phaseLoop, 'trafficPrint'])

  return workspace(b.project, [
    note('trafficNote', 'Traffic control', 'Deux phases de trafic. La heatmap 10×5 calcule une charge de route déterministe par cellule ; le graphique à barres montre six files de véhicules ; la barre de progression suit le débit global. Chaque phase met à jour les trois widgets, donc Run les anime pas à pas. Aucune horloge ni image écran.', 0, 1000, 900, 220),
  ])
}


// ADN : comptage de bases, contenu GC et carte de signaux par codon.
function dnaAnalyzer() {
  const b = builder()
  const bars = createBarChartModule('dnaBars', 'Base counts', 1, { size: 4 })
  const heat = createHeatmapModule('dnaHeat', 'Codon signal', 1, { width: 6, height: 6 })
  const gc = createProgressModule('dnaGc', 'GC content', 1, { min: 0, max: 100 })
  b.project.modules.push(bars.module, heat.module, gc.module)
  b.project.nodes.push(...bars.nodes, ...heat.nodes, ...gc.nodes)
  b.useModule('dnaApp', 'DNA analyzer')
  const app = b.project.modules.find((module) => module.id === 'dnaApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'dnaBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'setBaseCount')
  importFunction(app, 'dnaData', bars.module.id, exported(bars, 'BARCHART_SP3_SET_DATA_1'), 'setBaseCounts')
  importFunction(app, 'dnaCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setCodon')
  importFunction(app, 'dnaGcValue', gc.module.id, exported(gc, 'PROGRESS_SP3_SET_VALUE_1'), 'setGc')
  importFunction(app, 'dnaGcRange', gc.module.id, exported(gc, 'PROGRESS_SP3_SET_RANGE_1'), 'setGcRange')

  b.root('dnaSequence', 'VariableDeclaration', { name: 'sequence', type: intArrayType }, { initializer: 'dnaSequenceList' })
  b.make('dnaSequenceList', 'ArrayLiteral', { elementType: intType }, { elements: Array.from({ length: 20 }, (_, index) => {
    b.intValue(`dnaBase${index}`, [0, 1, 2, 3, 1, 1, 2, 0, 3, 2, 1, 0, 0, 2, 3, 1, 1, 2, 3, 0][index])
    return `dnaBase${index}`
  }) })
  b.root('dnaCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType }, { initializer: 'dnaCountsInit' })
  b.math('dnaCountsInit', 'arrayFill', ['dnaFour', 'dnaZero'])
  b.intValue('dnaFour', 4); b.intValue('dnaZero', 0); b.intValue('dnaLength', 20); b.intValue('dnaHundred', 100)
  b.intValue('dnaSix', 6); b.intValue('dnaSixY', 6); b.intValue('dnaTwenty', 20)
  b.doubleValue('dnaMin', '0.0'); b.doubleValue('dnaMax', '100.0')
  const range = callStatement(b, 'dnaRangeCall', 'dnaGcRange', ['dnaMin', 'dnaMax'])

  // Comptage : chaque base met à jour sa barre, ce qui anime le graphique pendant la lecture.
  b.variable('dnaIndex', 'i', intType, 'dnaIndexStart'); b.intValue('dnaIndexStart', 0)
  b.binary('dnaIndexTest', '<', 'dnaIndexRead', 'dnaLengthRead'); b.ref('dnaIndexRead', 'i')
  b.make('dnaLengthRead', 'MathCall', { name: 'arrayLength' }, { arguments: ['dnaSequenceRef'] }); b.ref('dnaSequenceRef', 'sequence')
  b.assign('dnaIndexUpdate', 'dnaIndexTarget', 'dnaIndexNext')
  b.ref('dnaIndexTarget', 'i'); b.binary('dnaIndexNext', '+', 'dnaIndexNextRead', 'dnaIndexOne'); b.ref('dnaIndexNextRead', 'i'); b.intValue('dnaIndexOne', 1)
  b.make('dnaBaseVar', 'VariableDeclaration', { name: 'base', type: intType }, { initializer: 'dnaBaseRead' })
  b.access('dnaBaseRead', 'dnaSequenceAccess', 'dnaIndexBase'); b.ref('dnaSequenceAccess', 'sequence'); b.ref('dnaIndexBase', 'i')
  b.access('dnaCountRead', 'dnaCountsRef', 'dnaBaseIndex'); b.ref('dnaCountsRef', 'counts'); b.ref('dnaBaseIndex', 'base')
  b.binary('dnaCountNext', '+', 'dnaCountRead', 'dnaCountOne'); b.intValue('dnaCountOne', 1)
  b.access('dnaCountTarget', 'dnaCountsWrite', 'dnaBaseWrite'); b.ref('dnaCountsWrite', 'counts'); b.ref('dnaBaseWrite', 'base')
  b.assign('dnaCountStore', 'dnaCountTarget', 'dnaCountNext')
  b.access('dnaBarValue', 'dnaCountsBar', 'dnaBaseBar'); b.ref('dnaCountsBar', 'counts'); b.ref('dnaBaseBar', 'base')
  callStatement(b, 'dnaBarCall', 'dnaBar', ['dnaBaseArg', 'dnaBarValue']); b.ref('dnaBaseArg', 'base')
  b.block('dnaCountBody', ['dnaBaseVar', 'dnaCountStore', 'dnaBarCallStatement'])
  b.forLoop('dnaCountLoop', 'dnaIndex', 'dnaIndexTest', 'dnaIndexUpdate', 'dnaCountBody')

  // Carte : chaque cellule combine une base et une position de codon.
  b.binary('dnaCellBaseIndex', '%', 'dnaCellSum', 'dnaFourRead')
  b.binary('dnaCellSum', '+', 'dnaCellX', 'dnaCellY')
  b.ref('dnaCellX', 'x'); b.ref('dnaCellY', 'y'); b.intValue('dnaFourRead', 4)
  b.access('dnaCellCount', 'dnaCountsCellRef', 'dnaCellBaseIndex'); b.ref('dnaCountsCellRef', 'counts')
  b.binary('dnaCellSum2', '+', 'dnaCellCount', 'dnaCellX2'); b.ref('dnaCellX2', 'x')
  b.binary('dnaCellRaw', '+', 'dnaCellSum2', 'dnaCellY2'); b.ref('dnaCellY2', 'y')
  b.binary('dnaCellValue', '%', 'dnaCellRaw', 'dnaTwenty')
  callStatement(b, 'dnaCellCall', 'dnaCell', ['dnaCellXRef', 'dnaCellYRef', 'dnaCellValue']); b.ref('dnaCellXRef', 'x'); b.ref('dnaCellYRef', 'y')
  const dnaY = b.countedLoop('dnaY', 'y', 'dnaSixY', ['dnaCellCallStatement'])
  const dnaX = b.countedLoop('dnaX', 'x', 'dnaSix', [dnaY])

  // GC = (C + G) × 100 / longueur.
  b.access('dnaC', 'dnaCountsCRef', 'dnaCIndex'); b.ref('dnaCountsCRef', 'counts'); b.intValue('dnaCIndex', 1)
  b.access('dnaG', 'dnaCountsGRef', 'dnaGIndex'); b.ref('dnaCountsGRef', 'counts'); b.intValue('dnaGIndex', 2)
  b.binary('dnaGcSum', '+', 'dnaC', 'dnaG')
  b.binary('dnaGcScaled', '*', 'dnaGcSum', 'dnaHundred')
  b.binary('dnaGcValue', '/', 'dnaGcScaled', 'dnaLength')
  b.make('dnaGcDouble', 'CastExpression', { type: doubleType }, { argument: 'dnaGcValue' })
  callStatement(b, 'dnaGcCall', 'dnaGcValue', ['dnaGcDouble'])
  callStatement(b, 'dnaDataCall', 'dnaData', ['dnaCountsArg']); b.ref('dnaCountsArg', 'counts')

  b.root('dnaMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'dnaBody' })
  b.stringValue('dnaMessage', 'DNA analyzer')
  b.print('dnaPrint', 'dnaMessage')
  b.block('dnaBody', [range, 'dnaCountLoop', dnaX, 'dnaGcCallStatement', 'dnaDataCallStatement', 'dnaPrint'])

  return workspace(b.project, [
    note('dnaNote', 'DNA analyzer', 'Séquence de 20 bases (A, C, G, T codées 0..3). Le graphique à barres suit les quatre compteurs en direct ; la heatmap combine comptage, x et y pour dessiner un motif de codons ; la barre de progression donne le taux GC. `SET_DATA` consolide les compteurs en fin de parcours.', 0, 1000, 900, 220),
  ])
}


// Traitement du signal : échantillons, énergie, spectre grossier et fenêtre temps-fréquence.
function signalProcessing() {
  const b = builder()
  const bars = createBarChartModule('signalBars', 'Spectrum bins', 1, { size: 8 })
  const heat = createHeatmapModule('signalHeat', 'Window energy', 1, { width: 8, height: 6 })
  const quality = createProgressModule('signalQuality', 'Signal quality', 1, { min: 0, max: 100 })
  b.project.modules.push(bars.module, heat.module, quality.module)
  b.project.nodes.push(...bars.nodes, ...heat.nodes, ...quality.nodes)
  b.useModule('signalApp', 'Signal processing')
  const app = b.project.modules.find((module) => module.id === 'signalApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'signalBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'setBin')
  importFunction(app, 'signalCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setWindow')
  importFunction(app, 'signalQuality', quality.module.id, exported(quality, 'PROGRESS_SP3_SET_VALUE_1'), 'setQuality')
  importFunction(app, 'signalRange', quality.module.id, exported(quality, 'PROGRESS_SP3_SET_RANGE_1'), 'setQualityRange')

  b.intValue('signalLengthInit', 24); b.intValue('signalLengthLoop', 24)
  b.intValue('signalEightBin', 8); b.intValue('signalEightX', 8); b.intValue('signalFive', 6)
  b.intValue('signalThreeK', 3); b.intValue('signalThreeDiv', 3); b.intValue('signalThreeOffset', 3)
  b.intValue('signalTwo', 2); b.intValue('signalHundredMinus', 100); b.intValue('signalHundredClamp', 100)
  b.intValue('signalZeroInit', 0); b.intValue('signalZeroClamp', 0)
  b.intValue('signalTwentyFour', 24); b.intValue('signalThirtySeven', 37); b.intValue('signalEleven', 11)
  b.intValue('signalOneHundredOne', 101); b.intValue('signalFifty', 50); b.intValue('signalNinetyNine', 99)
  b.doubleValue('signalMin', '0.0'); b.doubleValue('signalMax', '100.0')
  const range = callStatement(b, 'signalRangeCall', 'signalRange', ['signalMin', 'signalMax'])

  // Signal déterministe : une dent de scie centrée autour de zéro.
  b.make('signalSamples', 'VariableDeclaration', { name: 'samples', type: intArrayType }, { initializer: 'signalSamplesInit' })
  b.math('signalSamplesInit', 'arrayFill', ['signalLengthInit', 'signalZeroInit'])
  b.make('signalEnergy', 'VariableDeclaration', { name: 'energy', type: intType }, { initializer: 'signalEnergyStart' })
  b.intValue('signalEnergyStart', 0)
  b.variable('signalIndex', 'i', intType, 'signalIndexStart'); b.intValue('signalIndexStart', 0)
  b.binary('signalIndexTest', '<', 'signalIndexRead', 'signalLengthLoop'); b.ref('signalIndexRead', 'i')
  b.assign('signalIndexUpdate', 'signalIndexTarget', 'signalIndexNext'); b.ref('signalIndexTarget', 'i')
  b.binary('signalIndexNext', '+', 'signalIndexNextRead', 'signalIndexOne'); b.ref('signalIndexNextRead', 'i'); b.intValue('signalIndexOne', 1)
  b.binary('signalProduct', '+', 'signalProductRead', 'signalEleven'); b.ref('signalProductRead', 'i')
  b.binary('signalProductScaled', '*', 'signalProduct', 'signalThirtySeven')
  b.binary('signalModulo', '%', 'signalProductScaled', 'signalOneHundredOne')
  b.binary('signalSample', '-', 'signalModulo', 'signalFifty')
  b.make('signalSampleVar', 'VariableDeclaration', { name: 'sample', type: intType }, { initializer: 'signalSample' })
  b.access('signalSampleTarget', 'signalSamplesRef', 'signalIndexWrite'); b.ref('signalSamplesRef', 'samples'); b.ref('signalIndexWrite', 'i')
  b.assign('signalSampleStore', 'signalSampleTarget', 'signalSampleRead'); b.ref('signalSampleRead', 'sample')
  b.math('signalAbs', 'abs', ['signalSampleAbs']); b.ref('signalSampleAbs', 'sample')
  b.binary('signalEnergyNext', '+', 'signalEnergyRead', 'signalAbs'); b.ref('signalEnergyRead', 'energy')
  b.assign('signalEnergyStore', 'signalEnergyTarget', 'signalEnergyNext'); b.ref('signalEnergyTarget', 'energy')
  b.block('signalSampleBody', ['signalSampleVar', 'signalSampleStore', 'signalEnergyStore'])
  b.forLoop('signalSampleLoop', 'signalIndex', 'signalIndexTest', 'signalIndexUpdate', 'signalSampleBody')

  // Spectre : moyenne des amplitudes absolues par paquet de trois échantillons.
  b.variable('signalBinIndex', 'bin', intType, 'signalBinStart'); b.intValue('signalBinStart', 0)
  b.binary('signalBinTest', '<', 'signalBinRead', 'signalEightBin'); b.ref('signalBinRead', 'bin')
  b.assign('signalBinUpdate', 'signalBinTarget', 'signalBinNext'); b.ref('signalBinTarget', 'bin')
  b.binary('signalBinNext', '+', 'signalBinNextRead', 'signalBinOne'); b.ref('signalBinNextRead', 'bin'); b.intValue('signalBinOne', 1)
  b.make('signalSum', 'VariableDeclaration', { name: 'sum', type: intType }, { initializer: 'signalSumStart' })
  b.intValue('signalSumStart', 0)
  b.variable('signalK', 'k', intType, 'signalKStart'); b.intValue('signalKStart', 0)
  b.binary('signalKTest', '<', 'signalKRead', 'signalThreeK'); b.ref('signalKRead', 'k')
  b.assign('signalKUpdate', 'signalKTarget', 'signalKNext'); b.ref('signalKTarget', 'k')
  b.binary('signalKNext', '+', 'signalKNextRead', 'signalKOne'); b.ref('signalKNextRead', 'k'); b.intValue('signalKOne', 1)
  b.binary('signalOffset', '*', 'signalOffsetRead', 'signalThreeOffset'); b.ref('signalOffsetRead', 'bin')
  b.binary('signalSampleIndex', '+', 'signalOffset', 'signalKIndex'); b.ref('signalKIndex', 'k')
  b.access('signalBinSample', 'signalSamplesSpectrum', 'signalSampleIndex'); b.ref('signalSamplesSpectrum', 'samples')
  b.math('signalBinAbs', 'abs', ['signalBinSample'])
  b.binary('signalSumNext', '+', 'signalSumRead', 'signalBinAbs'); b.ref('signalSumRead', 'sum')
  b.assign('signalSumStore', 'signalSumTarget', 'signalSumNext'); b.ref('signalSumTarget', 'sum')
  b.block('signalKBody', ['signalSumStore'])
  b.forLoop('signalKLoop', 'signalK', 'signalKTest', 'signalKUpdate', 'signalKBody')
  b.binary('signalBinValue', '/', 'signalSumValue', 'signalThreeDiv')
  b.ref('signalSumValue', 'sum')
  callStatement(b, 'signalBinCall', 'signalBar', ['signalBinArg', 'signalBinValue']); b.ref('signalBinArg', 'bin')
  b.block('signalBinBody', ['signalSum', 'signalKLoop', 'signalBinCallStatement'])
  b.forLoop('signalBinLoop', 'signalBinIndex', 'signalBinTest', 'signalBinUpdate', 'signalBinBody')

  // Fenêtre temps-fréquence : différence locale, amplifiée par la ligne.
  b.binary('signalXPlusOne', '+', 'signalXPlusOneRead', 'signalXPlusOneLiteral'); b.ref('signalXPlusOneRead', 'x'); b.intValue('signalXPlusOneLiteral', 1)
  b.access('signalXSample', 'signalSamplesHeat', 'signalXHeat'); b.ref('signalSamplesHeat', 'samples'); b.ref('signalXHeat', 'x')
  b.access('signalXNextSample', 'signalSamplesHeatNext', 'signalXPlusOne'); b.ref('signalSamplesHeatNext', 'samples')
  b.binary('signalDifference', '-', 'signalXSample', 'signalXNextSample')
  b.math('signalDifferenceAbs', 'abs', ['signalDifference'])
  b.binary('signalRowEnergy', '*', 'signalRowEnergyRead', 'signalTwo'); b.ref('signalRowEnergyRead', 'row')
  b.binary('signalWindowRaw', '+', 'signalDifferenceAbs', 'signalRowEnergy')
  b.math('signalWindowValue', 'min', ['signalWindowRaw', 'signalNinetyNine'])
  callStatement(b, 'signalWindowCall', 'signalCell', ['signalXArg', 'signalRowArg', 'signalWindowValue']); b.ref('signalXArg', 'x'); b.ref('signalRowArg', 'row')
  const signalRow = b.countedLoop('signalRow', 'row', 'signalFive', ['signalWindowCallStatement'])
  const signalX = b.countedLoop('signalX', 'x', 'signalEightX', [signalRow])

  b.binary('signalEnergyAverage', '/', 'signalEnergyValue', 'signalTwentyFour')
  b.ref('signalEnergyValue', 'energy')
  b.binary('signalQualityRaw', '-', 'signalHundredMinus', 'signalEnergyAverage')
  b.math('signalQualityValue', 'clamp', ['signalQualityRaw', 'signalZeroClamp', 'signalHundredClamp'])
  b.make('signalQualityDouble', 'CastExpression', { type: doubleType }, { argument: 'signalQualityValue' })
  callStatement(b, 'signalQualityCall', 'signalQuality', ['signalQualityDouble'])

  b.root('signalMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'signalBody' })
  b.stringValue('signalMessage', 'Signal processing')
  b.print('signalPrint', 'signalMessage')
  b.block('signalBody', ['signalSamples', 'signalEnergy', range, 'signalSampleLoop', 'signalBinLoop', signalX, 'signalQualityCallStatement', 'signalPrint'])

  return workspace(b.project, [
    note('signalNote', 'Signal processing', 'Vingt-quatre échantillons déterministes. La boucle calcule l’énergie moyenne, le graphique à barres résume huit bandes spectrales, la heatmap 8×6 montre l’énergie locale par fenêtre et la barre de progression affiche la qualité estimée. Tout est recalculé par le moteur, sans signal externe ni réseau.', 0, 1000, 900, 220),
  ])
}

// Fractale de Mandelbrot : échappement par cellule, bandes et progression.
function mandelbrotEscape() {
  const b = builder()
  const heat = createHeatmapModule('mandelHeat', 'Escape time', 1, { width: 6, height: 4 })
  const bars = createBarChartModule('mandelBars', 'Escape bands', 1, { size: 6 })
  const progress = createProgressModule('mandelProgress', 'Computed pixels', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, progress.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...progress.nodes)
  b.useModule('mandelApp', 'Mandelbrot escape')
  const app = b.project.modules.find((module) => module.id === 'mandelApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'mandelCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setEscape')
  importFunction(app, 'mandelBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_DATA_1'), 'setBands')
  importFunction(app, 'mandelValue', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_VALUE_1'), 'setComputed')
  importFunction(app, 'mandelRange', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_RANGE_1'), 'setComputedRange')

  b.intValue('mandelWidth', 6); b.intValue('mandelWidthIndex', 6); b.intValue('mandelHeight', 4); b.intValue('mandelMaxIter', 5)
  b.intValue('mandelBands', 6); b.intValue('mandelOne', 1); b.intValue('mandelHundred', 100); b.intValue('mandelForty', 24)
  b.intValue('mandelFive', 5); b.intValue('mandelFour', 4)
  b.doubleValue('mandelTwoDouble', '2.0')
  b.doubleValue('mandelCxOffset', '4.0'); b.doubleValue('mandelCxScale', '4.0')
  b.doubleValue('mandelCyOffset', '2.0'); b.doubleValue('mandelCyScale', '3.0')
  b.doubleValue('mandelLimit', '4.0')
  b.doubleValue('mandelMin', '0.0'); b.doubleValue('mandelMax', '100.0')
  const range = callStatement(b, 'mandelRangeCall', 'mandelRange', ['mandelMin', 'mandelMax'])
  b.make('mandelCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType }, { initializer: 'mandelCountsInit' })
  b.math('mandelCountsInit', 'arrayFill', ['mandelBands', 'mandelZeroInt'])
  b.intValue('mandelZeroInt', 0)

  // Coordonnées complexes : x et y entiers convertis en doubles.
  b.make('mandelXDouble', 'CastExpression', { type: doubleType }, { argument: 'mandelXInt' }); b.ref('mandelXInt', 'x')
  b.binary('mandelCx', '/', 'mandelCxSub', 'mandelCxScale')
  b.binary('mandelCxSub', '-', 'mandelXDouble', 'mandelCxOffset')
  b.make('mandelYDouble', 'CastExpression', { type: doubleType }, { argument: 'mandelYInt' }); b.ref('mandelYInt', 'y')
  b.binary('mandelCy', '/', 'mandelCySub', 'mandelCyScale')
  b.binary('mandelCySub', '-', 'mandelYDouble', 'mandelCyOffset')

  b.block('mandelCellBody', ['mandelZr', 'mandelZi', 'mandelZr2', 'mandelIter', 'mandelLoop', 'mandelBand', 'mandelCount', 'mandelCellCallStatement', 'mandelProgressCallStatement'])
  b.make('mandelZr', 'VariableDeclaration', { name: 'zr', type: doubleType }, { initializer: 'mandelZrStart' }); b.doubleValue('mandelZrStart', '0.0')
  b.make('mandelZi', 'VariableDeclaration', { name: 'zi', type: doubleType }, { initializer: 'mandelZiStart' }); b.doubleValue('mandelZiStart', '0.0')
  b.make('mandelZr2', 'VariableDeclaration', { name: 'zr2', type: doubleType }, { initializer: 'mandelZr2Start' }); b.doubleValue('mandelZr2Start', '0.0')
  b.make('mandelIter', 'VariableDeclaration', { name: 'iter', type: intType }, { initializer: 'mandelIterStart' }); b.intValue('mandelIterStart', 0)

  // Tant que |z|² ≤ 4 et que le budget d'itérations n'est pas épuisé.
  b.binary('mandelIterTest', '<', 'mandelIterRead', 'mandelMaxIter'); b.ref('mandelIterRead', 'iter')
  b.binary('mandelZrSquare', '*', 'mandelZrRead', 'mandelZrRead2'); b.ref('mandelZrRead', 'zr'); b.ref('mandelZrRead2', 'zr')
  b.binary('mandelZiSquare', '*', 'mandelZiRead', 'mandelZiRead2'); b.ref('mandelZiRead', 'zi'); b.ref('mandelZiRead2', 'zi')
  b.binary('mandelMag', '+', 'mandelZrSquare', 'mandelZiSquare')
  b.binary('mandelMagTest', '<=', 'mandelMag', 'mandelLimit')
  b.binary('mandelContinue', 'and', 'mandelIterTest', 'mandelMagTest')
  b.binary('mandelZrSquare2', '*', 'mandelZrR', 'mandelZrR2'); b.ref('mandelZrR', 'zr'); b.ref('mandelZrR2', 'zr')
  b.binary('mandelZiSquare2', '*', 'mandelZiR', 'mandelZiR2'); b.ref('mandelZiR', 'zi'); b.ref('mandelZiR2', 'zi')
  b.binary('mandelZrNext', '-', 'mandelZrSquare2', 'mandelZiSquare2')
  b.binary('mandelZrAdd', '+', 'mandelZrNext', 'mandelCx')
  b.assign('mandelZrStore', 'mandelZrTarget2', 'mandelZrAdd'); b.ref('mandelZrTarget2', 'zr2')
  b.binary('mandelZiProduct', '*', 'mandelZrOld', 'mandelZiOld'); b.ref('mandelZrOld', 'zr'); b.ref('mandelZiOld', 'zi')
  b.binary('mandelZiTwice', '*', 'mandelZiProduct', 'mandelTwoDouble')
  b.binary('mandelZiNext', '+', 'mandelZiTwice', 'mandelCy')
  b.assign('mandelZiStore', 'mandelZiTarget', 'mandelZiNext'); b.ref('mandelZiTarget', 'zi')
  b.assign('mandelZrCopy', 'mandelZrTarget3', 'mandelZr2Value'); b.ref('mandelZrTarget3', 'zr'); b.ref('mandelZr2Value', 'zr2')
  b.assign('mandelIterStep', 'mandelIterTarget', 'mandelIterNext'); b.ref('mandelIterTarget', 'iter')
  b.binary('mandelIterNext', '+', 'mandelIterRead2', 'mandelOne'); b.ref('mandelIterRead2', 'iter')
  b.block('mandelWhileBody', ['mandelZrStore', 'mandelZiStore', 'mandelZrCopy', 'mandelIterStep'])
  b.make('mandelLoop', 'WhileStatement', {}, { test: 'mandelContinue', body: 'mandelWhileBody' })

  b.make('mandelBand', 'VariableDeclaration', { name: 'band', type: intType }, { initializer: 'mandelBandValue' })
  b.math('mandelBandValue', 'min', ['mandelIterValue', 'mandelFive']); b.ref('mandelIterValue', 'iter')
  b.access('mandelCountRead', 'mandelCountsRead', 'mandelBandIndex'); b.ref('mandelCountsRead', 'counts'); b.ref('mandelBandIndex', 'band')
  b.binary('mandelCountNext', '+', 'mandelCountRead', 'mandelOneCount'); b.intValue('mandelOneCount', 1)
  b.access('mandelCountTarget', 'mandelCountsWrite', 'mandelBandWrite'); b.ref('mandelCountsWrite', 'counts'); b.ref('mandelBandWrite', 'band')
  b.assign('mandelCount', 'mandelCountTarget', 'mandelCountNext')
  b.binary('mandelHeatRaw', '*', 'mandelIterRead3', 'mandelFour'); b.ref('mandelIterRead3', 'iter')
  callStatement(b, 'mandelCellCall', 'mandelCell', ['mandelXArg', 'mandelYArg', 'mandelHeatRaw']); b.ref('mandelXArg', 'x'); b.ref('mandelYArg', 'y')
  b.binary('mandelCellIndex', '*', 'mandelYProgress', 'mandelWidthIndex'); b.ref('mandelYProgress', 'y')
  b.binary('mandelIndex', '+', 'mandelCellIndex', 'mandelXProgress')
  b.ref('mandelXProgress', 'x'); b.intValue('mandelOneProgress', 1)
  b.binary('mandelIndexOne', '+', 'mandelIndex', 'mandelOneProgress')
  b.binary('mandelScaled', '*', 'mandelIndexOne', 'mandelHundred')
  b.binary('mandelPercent', '/', 'mandelScaled', 'mandelForty')
  b.make('mandelPercentDouble', 'CastExpression', { type: doubleType }, { argument: 'mandelPercent' })
  callStatement(b, 'mandelProgressCall', 'mandelValue', ['mandelPercentDouble'])

  const yLoop = b.countedLoop('mandelY', 'y', 'mandelHeight', ['mandelCellBody'])
  const xLoop = b.countedLoop('mandelX', 'x', 'mandelWidth', [yLoop])
  callStatement(b, 'mandelBarsCall', 'mandelBar', ['mandelCountsArg']); b.ref('mandelCountsArg', 'counts')

  b.root('mandelMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mandelBody' })
  b.stringValue('mandelMessage', 'Mandelbrot escape')
  b.print('mandelPrint', 'mandelMessage')
  b.block('mandelBody', ['mandelCounts', range, xLoop, 'mandelBarsCallStatement', 'mandelPrint'])

  return workspace(b.project, [
    note('mandelNote', 'Mandelbrot escape', 'Grille de 6×4 nombres complexes. Pour chaque pixel, z² + c est itéré jusqu’à échapper au disque de rayon 2 ou atteindre cinq itérations. La heatmap montre le temps d’échappement, les barres comptent les bandes, la progression mesure les pixels calculés. $$z_{n+1}=z_n^2+c$$', 0, 1000, 900, 220),
  ])
}


// Suite de Collatz : temps d'arrêt sur une petite grille et distribution par bande.
function collatzAtlas() {
  const b = builder()
  const heat = createHeatmapModule('collatzHeat', 'Stopping time', 1, { width: 6, height: 4 })
  const bars = createBarChartModule('collatzBars', 'Run length bands', 1, { size: 8 })
  const progress = createProgressModule('collatzProgress', 'Atlas coverage', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, progress.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...progress.nodes)
  b.useModule('collatzApp', 'Collatz atlas')
  const app = b.project.modules.find((module) => module.id === 'collatzApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'collatzCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setStop')
  importFunction(app, 'collatzBars', bars.module.id, exported(bars, 'BARCHART_SP3_SET_DATA_1'), 'setBands')
  importFunction(app, 'collatzValue', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_VALUE_1'), 'setCoverage')
  importFunction(app, 'collatzRange', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_RANGE_1'), 'setCoverageRange')

  b.intValue('collatzCount', 24); b.intValue('collatzTwelve', 12)
  b.intValue('collatzOne', 1); b.intValue('collatzTwo', 2); b.intValue('collatzTwoHalf', 2)
  b.intValue('collatzThreeBand', 3); b.intValue('collatzSeven', 7); b.intValue('collatzBands', 8); b.intValue('collatzZero', 0)
  b.intValue('collatzSixX', 6); b.intValue('collatzTwentyFour', 24)
  b.doubleValue('collatzMin', '0.0'); b.doubleValue('collatzMax', '100.0')
  const range = callStatement(b, 'collatzRangeCall', 'collatzRange', ['collatzMin', 'collatzMax'])
  b.make('collatzCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType }, { initializer: 'collatzCountsInit' })
  b.math('collatzCountsInit', 'arrayFill', ['collatzBands', 'collatzZero'])

  b.make('collatzCurrent', 'VariableDeclaration', { name: 'current', type: intType }, { initializer: 'collatzCurrentStart' })
  b.binary('collatzCurrentStart', '+', 'collatzIndexValue', 'collatzOne'); b.ref('collatzIndexValue', 'i')
  b.make('collatzSteps', 'VariableDeclaration', { name: 'steps', type: intType }, { initializer: 'collatzStepsStart' })
  b.intValue('collatzStepsStart', 0)
  b.binary('collatzCurrentTest', '>', 'collatzCurrentRead', 'collatzOneCompare'); b.ref('collatzCurrentRead', 'current'); b.intValue('collatzOneCompare', 1)
  b.binary('collatzStepsTest', '<', 'collatzStepsRead', 'collatzTwelve'); b.ref('collatzStepsRead', 'steps')
  b.binary('collatzContinue', 'and', 'collatzCurrentTest', 'collatzStepsTest')
  b.binary('collatzParity', '%', 'collatzParityRead', 'collatzTwo'); b.ref('collatzParityRead', 'current')
  b.binary('collatzEven', '==', 'collatzParity', 'collatzZeroParity'); b.intValue('collatzZeroParity', 0)
  b.binary('collatzHalf', '/', 'collatzHalfRead', 'collatzTwoHalf'); b.ref('collatzHalfRead', 'current')
  b.assign('collatzHalfStore', 'collatzCurrentEvenTarget', 'collatzHalf'); b.ref('collatzCurrentEvenTarget', 'current')
  b.binary('collatzTriple', '*', 'collatzTripleRead', 'collatzThreeOdd'); b.ref('collatzTripleRead', 'current'); b.intValue('collatzThreeOdd', 3)
  b.binary('collatzOddNext', '+', 'collatzTriple', 'collatzOneOdd'); b.intValue('collatzOneOdd', 1)
  b.assign('collatzOddStore', 'collatzCurrentOddTarget', 'collatzOddNext'); b.ref('collatzCurrentOddTarget', 'current')
  b.ifThen('collatzIf', 'collatzEven', 'collatzEvenBody', 'collatzOddBody')
  b.block('collatzEvenBody', ['collatzHalfStore']); b.block('collatzOddBody', ['collatzOddStore'])
  b.binary('collatzStepNext', '+', 'collatzStepRead', 'collatzOneStep'); b.ref('collatzStepRead', 'steps'); b.intValue('collatzOneStep', 1)
  b.assign('collatzStepStore', 'collatzStepTarget', 'collatzStepNext'); b.ref('collatzStepTarget', 'steps')
  b.block('collatzWhileBody', ['collatzIf', 'collatzStepStore'])
  b.make('collatzLoop', 'WhileStatement', {}, { test: 'collatzContinue', body: 'collatzWhileBody' })

  b.binary('collatzBand', '/', 'collatzStepsBand', 'collatzThreeBand'); b.ref('collatzStepsBand', 'steps')
  b.math('collatzBandValue', 'min', ['collatzBand', 'collatzSeven'])
  b.variable('collatzBandDecl', 'band', intType, 'collatzBandValue')
  b.access('collatzCountRead', 'collatzCountsRead', 'collatzBandRead'); b.ref('collatzCountsRead', 'counts'); b.ref('collatzBandRead', 'band')
  b.binary('collatzCountNext', '+', 'collatzCountRead', 'collatzOneCount'); b.intValue('collatzOneCount', 1)
  b.access('collatzCountTarget', 'collatzCountsWrite', 'collatzBandWrite'); b.ref('collatzCountsWrite', 'counts'); b.ref('collatzBandWrite', 'band')
  b.assign('collatzCountStore', 'collatzCountTarget', 'collatzCountNext')
  b.binary('collatzCellX', '%', 'collatzIndexX', 'collatzSixX'); b.ref('collatzIndexX', 'i')
  b.binary('collatzCellY', '/', 'collatzIndexY', 'collatzSixY'); b.ref('collatzIndexY', 'i'); b.intValue('collatzSixY', 6)
  b.binary('collatzHeatValue', '*', 'collatzStepsHeat', 'collatzSevenHeat'); b.ref('collatzStepsHeat', 'steps'); b.intValue('collatzSevenHeat', 7)
  callStatement(b, 'collatzCellCall', 'collatzCell', ['collatzCellX', 'collatzCellY', 'collatzHeatValue'])
  b.binary('collatzProgressIndex', '+', 'collatzIndexProgress', 'collatzOneProgress'); b.ref('collatzIndexProgress', 'i'); b.intValue('collatzOneProgress', 1)
  b.binary('collatzProgressScaled', '*', 'collatzProgressIndex', 'collatzHundredProgress'); b.intValue('collatzHundredProgress', 100)
  b.binary('collatzProgressValue', '/', 'collatzProgressScaled', 'collatzTwentyFour')
  b.make('collatzProgressDouble', 'CastExpression', { type: doubleType }, { argument: 'collatzProgressValue' })
  callStatement(b, 'collatzProgressCall', 'collatzValue', ['collatzProgressDouble'])
  const collatzLoop = b.countedLoop('collatzIndexLoop', 'i', 'collatzCount', ['collatzCurrent', 'collatzSteps', 'collatzLoop', 'collatzBandDecl', 'collatzCountStore', 'collatzCellCallStatement', 'collatzProgressCallStatement'])
  callStatement(b, 'collatzBarsCall', 'collatzBars', ['collatzCountsArg']); b.ref('collatzCountsArg', 'counts')

  b.root('collatzMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'collatzBody' })
  b.stringValue('collatzMessage', 'Collatz atlas')
  b.print('collatzPrint', 'collatzMessage')
  b.block('collatzBody', ['collatzCounts', range, collatzLoop, 'collatzBarsCallStatement', 'collatzPrint'])

  return workspace(b.project, [
    note('collatzNote', 'Collatz atlas', 'Pour les 24 premiers départs, la suite de Collatz est arrêtée après douze étapes. La heatmap 6×4 montre le temps d’arrêt, les barres regroupent les longueurs par bande et la progression couvre l’atlas. Le cas pair divise par 2, le cas impair applique 3n + 1.', 0, 1000, 900, 220),
  ])
}

// Course de tris : deux graphiques à barres animés, bulles et insertion.
function sortRace() {
  const b = builder()
  const bubbleBars = createBarChartModule('raceBubbleBars', 'Bubble sort', 1, { size: 10 })
  const insertionBars = createBarChartModule('raceInsertionBars', 'Insertion sort', 2, { size: 10 })
  const progress = createProgressModule('raceProgress', 'Sorted fraction', 1, { min: 0, max: 100 })
  b.project.modules.push(bubbleBars.module, insertionBars.module, progress.module)
  b.project.nodes.push(...bubbleBars.nodes, ...insertionBars.nodes, ...progress.nodes)
  b.useModule('raceApp', 'Sort race')
  const app = b.project.modules.find((module) => module.id === 'raceApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'raceBubbleData', bubbleBars.module.id, exported(bubbleBars, 'BARCHART_SP3_SET_DATA_1'), 'setBubble')
  importFunction(app, 'raceInsertionData', insertionBars.module.id, exported(insertionBars, 'BARCHART_SP3_SET_DATA_2'), 'setInsertion')
  importFunction(app, 'raceProgressValue', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_VALUE_1'), 'setSorted')
  importFunction(app, 'raceProgressRange', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_RANGE_1'), 'setSortedRange')

  const arrayVariable = (id, name, values) => {
    b.make(id, 'VariableDeclaration', { name, type: intArrayType }, { initializer: `${id}Init` })
    b.make(`${id}Init`, 'ArrayLiteral', { elementType: intType }, { elements: values.map((value, index) => {
      b.intValue(`${id}Value${index}`, value)
      return `${id}Value${index}`
    }) })
  }
  arrayVariable('raceBubble', 'bubble', [9, 3, 7, 1, 8, 2, 6, 4, 5, 0])
  arrayVariable('raceInsertion', 'insertion', [9, 3, 7, 1, 8, 2, 6, 4, 5, 0])
  b.intValue('raceNine', 9); b.intValue('raceTen', 10)
  b.intValue('raceNineInner', 9)
  b.doubleValue('raceMin', '0.0'); b.doubleValue('raceMax', '100.0')
  const range = callStatement(b, 'raceRangeCall', 'raceProgressRange', ['raceMin', 'raceMax'])
  callStatement(b, 'raceBubbleStart', 'raceBubbleData', ['raceBubbleArg']); b.ref('raceBubbleArg', 'bubble')
  callStatement(b, 'raceInsertionStart', 'raceInsertionData', ['raceInsertionArg']); b.ref('raceInsertionArg', 'insertion')

  // Tri à bulles : comparaison des voisins et échange dans le tableau.
  b.variable('raceBubbleJ', 'j', intType, 'raceBubbleJStart'); b.intValue('raceBubbleJStart', 0)
  b.binary('raceBubbleBound', '-', 'raceNineInner', 'raceBubbleIRead'); b.ref('raceBubbleIRead', 'i')
  b.binary('raceBubbleJTest', '<', 'raceBubbleJRead', 'raceBubbleBound'); b.ref('raceBubbleJRead', 'j')
  b.assign('raceBubbleJUpdate', 'raceBubbleJTarget', 'raceBubbleJNext'); b.ref('raceBubbleJTarget', 'j')
  b.binary('raceBubbleJNext', '+', 'raceBubbleJNextRead', 'raceOneJ'); b.ref('raceBubbleJNextRead', 'j'); b.intValue('raceOneJ', 1)
  b.access('raceBubbleLeft', 'raceBubbleArrayLeft', 'raceBubbleJLeft'); b.ref('raceBubbleArrayLeft', 'bubble'); b.ref('raceBubbleJLeft', 'j')
  b.binary('raceBubbleJPlus', '+', 'raceBubbleJPlusRead', 'raceOnePlus'); b.ref('raceBubbleJPlusRead', 'j'); b.intValue('raceOnePlus', 1)
  b.access('raceBubbleRight', 'raceBubbleArrayRight', 'raceBubbleJPlus'); b.ref('raceBubbleArrayRight', 'bubble')
  b.binary('raceBubbleCompare', '>', 'raceBubbleLeft', 'raceBubbleRight')
  b.access('raceBubbleLeftSave', 'raceBubbleLeftArraySave', 'raceBubbleJLeftSave'); b.ref('raceBubbleLeftArraySave', 'bubble'); b.ref('raceBubbleJLeftSave', 'j')
  b.assign('raceBubbleSave', 'raceBubbleTempTarget', 'raceBubbleLeftSave'); b.ref('raceBubbleTempTarget', 'temp')
  b.access('raceBubbleWriteLeft', 'raceBubbleArrayWriteLeft', 'raceBubbleJWriteLeft'); b.ref('raceBubbleArrayWriteLeft', 'bubble'); b.ref('raceBubbleJWriteLeft', 'j')
  b.binary('raceBubbleJPlusShift', '+', 'raceBubbleJPlusShiftRead', 'raceOneShift'); b.ref('raceBubbleJPlusShiftRead', 'j'); b.intValue('raceOneShift', 1)
  b.access('raceBubbleRightShift', 'raceBubbleRightArrayShift', 'raceBubbleJPlusShift'); b.ref('raceBubbleRightArrayShift', 'bubble')
  b.assign('raceBubbleShift', 'raceBubbleWriteLeft', 'raceBubbleRightShift')
  b.access('raceBubbleWriteRight', 'raceBubbleArrayWriteRight', 'raceBubbleJPlusWrite'); b.ref('raceBubbleArrayWriteRight', 'bubble')
  b.binary('raceBubbleJPlusWrite', '+', 'raceBubbleJPlusWriteRead', 'raceOneWrite'); b.ref('raceBubbleJPlusWriteRead', 'j'); b.intValue('raceOneWrite', 1)
  b.assign('raceBubbleRestore', 'raceBubbleWriteRight', 'raceBubbleTempRead'); b.ref('raceBubbleTempRead', 'temp')
  b.ifThen('raceBubbleSwap', 'raceBubbleCompare', 'raceBubbleSwapBody', null)
  b.block('raceBubbleSwapBody', ['raceBubbleSave', 'raceBubbleShift', 'raceBubbleRestore'])
  b.block('raceBubbleInnerBody', ['raceBubbleSwap'])
  b.forLoop('raceBubbleInner', 'raceBubbleJ', 'raceBubbleJTest', 'raceBubbleJUpdate', 'raceBubbleInnerBody')
  callStatement(b, 'raceBubbleDataCall', 'raceBubbleData', ['raceBubbleCallArg']); b.ref('raceBubbleCallArg', 'bubble')
  b.binary('raceBubbleProgressRaw', '+', 'raceBubbleIProgress', 'raceOneProgress'); b.ref('raceBubbleIProgress', 'i'); b.intValue('raceOneProgress', 1)
  b.binary('raceBubbleProgressValue', '*', 'raceBubbleProgressRaw', 'raceTenProgress'); b.intValue('raceTenProgress', 10)
  b.make('raceBubbleProgressDouble', 'CastExpression', { type: doubleType }, { argument: 'raceBubbleProgressValue' })
  callStatement(b, 'raceBubbleProgressCall', 'raceProgressValue', ['raceBubbleProgressDouble'])
  const bubbleOuter = b.countedLoop('raceBubbleOuter', 'i', 'raceNine', ['raceBubbleInner', 'raceBubbleDataCallStatement', 'raceBubbleProgressCallStatement'])

  // Tri par insertion : décalage des valeurs supérieures puis insertion de la clé.
  b.make('raceInsertionKey', 'VariableDeclaration', { name: 'key', type: intType }, { initializer: 'raceInsertionKeyRead' })
  b.access('raceInsertionKeyRead', 'raceInsertionArrayKey', 'raceInsertionIKey'); b.ref('raceInsertionArrayKey', 'insertion'); b.ref('raceInsertionIKey', 'i')
  b.variable('raceInsertionJ', 'j', intType, 'raceInsertionJStart')
  b.binary('raceInsertionJStart', '-', 'raceInsertionIStart', 'raceOneJStart'); b.ref('raceInsertionIStart', 'i'); b.intValue('raceOneJStart', 1)
  b.binary('raceInsertionJZero', '>=', 'raceInsertionJRead', 'raceZeroJ'); b.ref('raceInsertionJRead', 'j'); b.intValue('raceZeroJ', 0)
  b.access('raceInsertionCurrent', 'raceInsertionArrayCurrent', 'raceInsertionJCurrent'); b.ref('raceInsertionArrayCurrent', 'insertion'); b.ref('raceInsertionJCurrent', 'j')
  b.binary('raceInsertionGreater', '>', 'raceInsertionCurrent', 'raceInsertionKeyCompare'); b.ref('raceInsertionKeyCompare', 'key')
  b.binary('raceInsertionContinue', 'and', 'raceInsertionJZero', 'raceInsertionGreater')
  b.binary('raceInsertionJPlus', '+', 'raceInsertionJPlusRead', 'raceOneHole'); b.ref('raceInsertionJPlusRead', 'j'); b.intValue('raceOneHole', 1)
  b.access('raceInsertionHole', 'raceInsertionArrayHole', 'raceInsertionJPlus'); b.ref('raceInsertionArrayHole', 'insertion')
  b.access('raceInsertionValue', 'raceInsertionArrayValue', 'raceInsertionJValue'); b.ref('raceInsertionArrayValue', 'insertion'); b.ref('raceInsertionJValue', 'j')
  b.assign('raceInsertionShift', 'raceInsertionHole', 'raceInsertionValue')
  b.assign('raceInsertionJStep', 'raceInsertionJTarget', 'raceInsertionJNext'); b.ref('raceInsertionJTarget', 'j')
  b.binary('raceInsertionJNext', '-', 'raceInsertionJStepRead', 'raceOneStep'); b.ref('raceInsertionJStepRead', 'j'); b.intValue('raceOneStep', 1)
  b.block('raceInsertionWhileBody', ['raceInsertionShift', 'raceInsertionJStep'])
  b.make('raceInsertionLoop', 'WhileStatement', {}, { test: 'raceInsertionContinue', body: 'raceInsertionWhileBody' })
  b.binary('raceInsertionFinalPlus', '+', 'raceInsertionFinalRead', 'raceOneFinal'); b.ref('raceInsertionFinalRead', 'j'); b.intValue('raceOneFinal', 1)
  b.access('raceInsertionFinalTarget', 'raceInsertionArrayFinal', 'raceInsertionFinalPlus'); b.ref('raceInsertionArrayFinal', 'insertion')
  b.assign('raceInsertionPlace', 'raceInsertionFinalTarget', 'raceInsertionKeyPlace'); b.ref('raceInsertionKeyPlace', 'key')
  callStatement(b, 'raceInsertionDataCall', 'raceInsertionData', ['raceInsertionCallArg']); b.ref('raceInsertionCallArg', 'insertion')
  b.binary('raceInsertionProgressRaw', '+', 'raceInsertionIProgress', 'raceOneInsertionProgress'); b.ref('raceInsertionIProgress', 'i'); b.intValue('raceOneInsertionProgress', 1)
  b.binary('raceInsertionProgressValue', '*', 'raceInsertionProgressRaw', 'raceTenInsertionProgress'); b.intValue('raceTenInsertionProgress', 10)
  b.make('raceInsertionProgressDouble', 'CastExpression', { type: doubleType }, { argument: 'raceInsertionProgressValue' })
  callStatement(b, 'raceInsertionProgressCall', 'raceProgressValue', ['raceInsertionProgressDouble'])
  const insertionOuter = b.countedLoop('raceInsertionOuter', 'i', 'raceTen', ['raceInsertionKey', 'raceInsertionJ', 'raceInsertionLoop', 'raceInsertionPlace', 'raceInsertionDataCallStatement', 'raceInsertionProgressCallStatement'], 1)

  b.root('raceMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'raceBody' })
  b.make('raceTemp', 'VariableDeclaration', { name: 'temp', type: intType }, { initializer: 'raceTempStart' }); b.intValue('raceTempStart', 0)
  b.stringValue('raceMessage', 'Sort race')
  b.print('racePrint', 'raceMessage')
  b.block('raceBody', ['raceBubble', 'raceInsertion', 'raceTemp', range, 'raceBubbleStartStatement', 'raceInsertionStartStatement', bubbleOuter, insertionOuter, 'racePrint'])

  return workspace(b.project, [
    note('raceNote', 'Sort race', 'Deux copies du même tableau de dix valeurs. Le premier graphique suit le tri à bulles, le second le tri par insertion. Chaque passe republie le tableau par `SET_DATA`, ce qui anime les barres pendant Run ; la barre de progression indique la fraction triée.', 0, 1000, 900, 220),
  ])
}


// Diffusion thermique : lissage d'une grille, températures et moyennes par ligne.
function heatDiffusion() {
  const b = builder()
  const heat = createHeatmapModule('diffusionHeat', 'Temperature field', 1, { width: 8, height: 4 })
  const bars = createBarChartModule('diffusionBars', 'Row averages', 1, { size: 6 })
  const progress = createProgressModule('diffusionProgress', 'Diffusion steps', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, progress.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...progress.nodes)
  b.useModule('diffusionApp', 'Heat diffusion')
  const app = b.project.modules.find((module) => module.id === 'diffusionApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'diffusionCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setTemperature')
  importFunction(app, 'diffusionBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'setRowAverage')
  importFunction(app, 'diffusionValue', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_VALUE_1'), 'setStep')
  importFunction(app, 'diffusionRange', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_RANGE_1'), 'setStepRange')

  b.intValue('diffusionWidth', 8); b.intValue('diffusionHeight', 4); b.intValue('diffusionInteriorX', 7); b.intValue('diffusionInteriorY', 3)
  b.intValue('diffusionSixty', 32); b.intValue('diffusionSixtyFill', 32); b.intValue('diffusionZero', 0); b.intValue('diffusionZeroFill', 0)
  b.intValue('diffusionHundred', 100); b.intValue('diffusionTenGrid', 8)
  b.intValue('diffusionTenHeat', 8); b.intValue('diffusionTenRow', 8); b.intValue('diffusionFour', 4)
  b.intValue('diffusionEight', 8); b.intValue('diffusionTenRows', 8); b.intValue('diffusionSteps', 2); b.intValue('diffusionStepWeight', 50)
  b.intValue('diffusionHeightRow', 4)
  b.doubleValue('diffusionMin', '0.0'); b.doubleValue('diffusionMax', '100.0')
  const range = callStatement(b, 'diffusionRangeCall', 'diffusionRange', ['diffusionMin', 'diffusionMax'])
  b.make('diffusionGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: 'diffusionGridInit' })
  b.math('diffusionGridInit', 'arrayFill', ['diffusionSixty', 'diffusionZero'])
  b.make('diffusionNext', 'VariableDeclaration', { name: 'next', type: intArrayType }, { initializer: 'diffusionNextInit' })
  b.math('diffusionNextInit', 'arrayFill', ['diffusionSixtyFill', 'diffusionZeroFill'])
  b.access('diffusionSourceTarget', 'diffusionGridSource', 'diffusionSourceIndex'); b.ref('diffusionGridSource', 'grid'); b.intValue('diffusionSourceIndex', 20)
  b.assign('diffusionSourceStore', 'diffusionSourceTarget', 'diffusionHundred')

  // Une étape : remise à zéro de next, puis moyenne des quatre voisins et du centre.
  b.math('diffusionNextReset', 'arrayFill', ['diffusionSixtyNext', 'diffusionZeroNext']); b.intValue('diffusionSixtyNext', 32); b.intValue('diffusionZeroNext', 0)
  b.assign('diffusionNextStore', 'diffusionNextTarget', 'diffusionNextReset'); b.ref('diffusionNextTarget', 'next')
  b.make('diffusionSmoothIndexDecl', 'VariableDeclaration', { name: 'idx', type: intType }, { initializer: 'diffusionSmoothIndexValue' })
  b.binary('diffusionSmoothIndexValue', '+', 'diffusionSmoothY', 'diffusionSmoothX'); b.binary('diffusionSmoothY', '*', 'diffusionSmoothYRead', 'diffusionTenGrid'); b.ref('diffusionSmoothYRead', 'sy')
  b.ref('diffusionSmoothX', 'sx')
  b.access('diffusionCenter', 'diffusionGridCenter', 'diffusionSmoothIndex'); b.ref('diffusionGridCenter', 'grid'); b.ref('diffusionSmoothIndex', 'idx')
  b.binary('diffusionCenter4', '*', 'diffusionCenter', 'diffusionFour')
  b.binary('diffusionLeftIndex', '-', 'diffusionSmoothIndexLeft', 'diffusionOneLeft'); b.ref('diffusionSmoothIndexLeft', 'idx'); b.intValue('diffusionOneLeft', 1)
  b.access('diffusionLeft', 'diffusionGridLeft', 'diffusionLeftIndex'); b.ref('diffusionGridLeft', 'grid')
  b.binary('diffusionRightIndex', '+', 'diffusionSmoothIndexRight', 'diffusionOneRight'); b.ref('diffusionSmoothIndexRight', 'idx'); b.intValue('diffusionOneRight', 1)
  b.access('diffusionRight', 'diffusionGridRight', 'diffusionRightIndex'); b.ref('diffusionGridRight', 'grid')
  b.binary('diffusionUpIndex', '-', 'diffusionSmoothIndexUp', 'diffusionWidthUp'); b.ref('diffusionSmoothIndexUp', 'idx'); b.intValue('diffusionWidthUp', 8)
  b.access('diffusionUp', 'diffusionGridUp', 'diffusionUpIndex'); b.ref('diffusionGridUp', 'grid')
  b.binary('diffusionDownIndex', '+', 'diffusionSmoothIndexDown', 'diffusionWidthDown'); b.ref('diffusionSmoothIndexDown', 'idx'); b.intValue('diffusionWidthDown', 8)
  b.access('diffusionDown', 'diffusionGridDown', 'diffusionDownIndex'); b.ref('diffusionGridDown', 'grid')
  b.binary('diffusionSum1', '+', 'diffusionCenter4', 'diffusionLeft')
  b.binary('diffusionSum2', '+', 'diffusionSum1', 'diffusionRight')
  b.binary('diffusionSum3', '+', 'diffusionSum2', 'diffusionUp')
  b.binary('diffusionSum4', '+', 'diffusionSum3', 'diffusionDown')
  b.binary('diffusionAverage', '/', 'diffusionSum4', 'diffusionEight')
  b.access('diffusionNextCell', 'diffusionNextArray', 'diffusionNextIndex'); b.ref('diffusionNextArray', 'next'); b.ref('diffusionNextIndex', 'idx')
  b.assign('diffusionNextWrite', 'diffusionNextCell', 'diffusionAverage')
  b.block('diffusionSmoothBody', ['diffusionSmoothIndexDecl', 'diffusionNextWrite'])
  const smoothY = b.countedLoop('diffusionSmoothYLoop', 'sy', 'diffusionInteriorY', [b.countedLoop('diffusionSmoothX', 'sx', 'diffusionInteriorX', ['diffusionSmoothBody'], 1)], 1)
  b.assign('diffusionSwap', 'diffusionGridTarget', 'diffusionNextRead'); b.ref('diffusionGridTarget', 'grid'); b.ref('diffusionNextRead', 'next')

  // Affichage de la grille : une cellule par coordonnée.
  b.make('diffusionHeatIndexDecl', 'VariableDeclaration', { name: 'hidx', type: intType }, { initializer: 'diffusionHeatIndexValue' })
  b.binary('diffusionHeatIndexValue', '+', 'diffusionHeatY', 'diffusionHeatX')
  b.binary('diffusionHeatY', '*', 'diffusionHeatYRead', 'diffusionTenHeat'); b.ref('diffusionHeatYRead', 'hy')
  b.ref('diffusionHeatX', 'hx')
  b.access('diffusionHeatCell', 'diffusionGridHeat', 'diffusionHeatIndex'); b.ref('diffusionGridHeat', 'grid'); b.ref('diffusionHeatIndex', 'hidx')
  callStatement(b, 'diffusionHeatCall', 'diffusionCell', ['diffusionHeatXArg', 'diffusionHeatYArg', 'diffusionHeatCell']); b.ref('diffusionHeatXArg', 'hx'); b.ref('diffusionHeatYArg', 'hy')
  const heatY = b.countedLoop('diffusionHeatYLoop', 'hy', 'diffusionHeight', [b.countedLoop('diffusionHeatX', 'hx', 'diffusionWidth', ['diffusionHeatIndexDecl', 'diffusionHeatCallStatement'])])

  // Moyenne de chaque ligne pour le graphique à barres.
  b.make('diffusionRowSum', 'VariableDeclaration', { name: 'sum', type: intType }, { initializer: 'diffusionRowSumStart' })
  b.intValue('diffusionRowSumStart', 0)
  b.binary('diffusionRowIndex', '+', 'diffusionRowY', 'diffusionRowX')
  b.binary('diffusionRowY', '*', 'diffusionRowYRead', 'diffusionTenRow'); b.ref('diffusionRowYRead', 'r')
  b.ref('diffusionRowX', 'c')
  b.access('diffusionRowValue', 'diffusionGridRow', 'diffusionRowIndex'); b.ref('diffusionGridRow', 'grid')
  b.binary('diffusionRowSumNext', '+', 'diffusionRowSumRead', 'diffusionRowValue'); b.ref('diffusionRowSumRead', 'sum')
  b.assign('diffusionRowSumStore', 'diffusionRowSumTarget', 'diffusionRowSumNext'); b.ref('diffusionRowSumTarget', 'sum')
  b.block('diffusionRowInnerBody', ['diffusionRowSumStore'])
  const rowInner = b.forLoop('diffusionRowInner', 'diffusionRowCInit', 'diffusionRowCTest', 'diffusionRowCUpdate', 'diffusionRowInnerBody')
  b.make('diffusionRowCInit', 'VariableDeclaration', { name: 'c', type: intType }, { initializer: 'diffusionRowCStart' }); b.intValue('diffusionRowCStart', 0)
  b.binary('diffusionRowCTest', '<', 'diffusionRowCRead', 'diffusionTenRows'); b.ref('diffusionRowCRead', 'c')
  b.assign('diffusionRowCUpdate', 'diffusionRowCTarget', 'diffusionRowCNext'); b.ref('diffusionRowCTarget', 'c')
  b.binary('diffusionRowCNext', '+', 'diffusionRowCNextRead', 'diffusionRowCOne'); b.ref('diffusionRowCNextRead', 'c'); b.intValue('diffusionRowCOne', 1)
  b.binary('diffusionRowAverage', '/', 'diffusionRowSumValue', 'diffusionTenAverage'); b.intValue('diffusionTenAverage', 8)
  b.ref('diffusionRowSumValue', 'sum')
  callStatement(b, 'diffusionRowCall', 'diffusionBar', ['diffusionRowArg', 'diffusionRowAverage']); b.ref('diffusionRowArg', 'r')
  b.block('diffusionRowBody', ['diffusionRowSum', rowInner, 'diffusionRowCallStatement'])
  const rowLoop = b.countedLoop('diffusionRowLoop', 'r', 'diffusionHeightRow', ['diffusionRowBody'])

  b.binary('diffusionStepPlus', '+', 'diffusionStepRead', 'diffusionOneStep'); b.ref('diffusionStepRead', 'step'); b.intValue('diffusionOneStep', 1)
  b.binary('diffusionProgressRaw', '*', 'diffusionStepPlus', 'diffusionStepWeight')
  b.make('diffusionProgressDouble', 'CastExpression', { type: doubleType }, { argument: 'diffusionProgressRaw' })
  callStatement(b, 'diffusionProgressCall', 'diffusionValue', ['diffusionProgressDouble'])
  const stepLoop = b.countedLoop('diffusionStepLoop', 'step', 'diffusionSteps', ['diffusionNextStore', smoothY, 'diffusionSwap', heatY, rowLoop, 'diffusionProgressCallStatement'])

  b.root('diffusionMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'diffusionBody' })
  b.stringValue('diffusionMessage', 'Heat diffusion')
  b.print('diffusionPrint', 'diffusionMessage')
  b.block('diffusionBody', ['diffusionGrid', 'diffusionNext', 'diffusionSourceStore', range, stepLoop, 'diffusionPrint'])

  return workspace(b.project, [
    note('diffusionNote', 'Heat diffusion', 'Une source chaude est posée au centre d’une grille 8×4. Deux étapes remplacent chaque cellule intérieure par la moyenne pondérée du centre et de ses quatre voisins. La heatmap montre le champ, les barres les moyennes de lignes et la progression le nombre d’étapes.', 0, 1000, 900, 220),
  ])
}

// Convolution d'image : motif source, flou 3×3 et histogramme de sortie.
function imageConvolution() {
  const b = builder()
  const heat = createHeatmapModule('imageHeat', 'Filtered image', 1, { width: 8, height: 6 })
  const bars = createBarChartModule('imageBars', 'Output bands', 1, { size: 8 })
  const progress = createProgressModule('imageProgress', 'Filter progress', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, progress.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...progress.nodes)
  b.useModule('imageApp', 'Image convolution')
  const app = b.project.modules.find((module) => module.id === 'imageApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'imageCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setFiltered')
  importFunction(app, 'imageBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_DATA_1'), 'setHistogram')
  importFunction(app, 'imageValue', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_VALUE_1'), 'setProgress')
  importFunction(app, 'imageRange', progress.module.id, exported(progress, 'PROGRESS_SP3_SET_RANGE_1'), 'setProgressRange')

  b.intValue('imageWidth', 8); b.intValue('imageWidthLoop', 8); b.intValue('imageHeight', 6); b.intValue('imageInteriorX', 7); b.intValue('imageInteriorY', 5)
  b.intValue('imageSizeSource', 48); b.intValue('imageSizeOutput', 48); b.intValue('imageSizeHist', 48)
  b.intValue('imageBands', 8); b.intValue('imageZeroSource', 0); b.intValue('imageZeroOutput', 0); b.intValue('imageZeroCounts', 0)
  b.intValue('imageEightValue', 8); b.intValue('imageEightAverage', 8)
  b.intValue('imageSeven', 7); b.intValue('imageFive', 5); b.intValue('imageThree', 3); b.intValue('imageEleven', 11)
  b.intValue('imageTen', 10); b.intValue('imageLimit', 7); b.intValue('imageFour', 4); b.intValue('imageOne', 1)
  b.intValue('imageThirty', 30); b.intValue('imageSeventy', 70); b.intValue('imageHundred', 100)
  b.doubleValue('imageMin', '0.0'); b.doubleValue('imageMax', '100.0')
  const range = callStatement(b, 'imageRangeCall', 'imageRange', ['imageMin', 'imageMax'])
  b.make('imageSource', 'VariableDeclaration', { name: 'source', type: intArrayType }, { initializer: 'imageSourceInit' })
  b.math('imageSourceInit', 'arrayFill', ['imageSizeSource', 'imageZeroSource'])
  b.make('imageOutput', 'VariableDeclaration', { name: 'output', type: intArrayType }, { initializer: 'imageOutputInit' })
  b.math('imageOutputInit', 'arrayFill', ['imageSizeOutput', 'imageZeroOutput'])
  b.make('imageCounts', 'VariableDeclaration', { name: 'counts', type: intArrayType }, { initializer: 'imageCountsInit' })
  b.math('imageCountsInit', 'arrayFill', ['imageBands', 'imageZeroCounts'])

  // Motif source : une texture déterministe de 8×6.
  b.binary('imageSourceX', '*', 'imageSourceXRef', 'imageSeven'); b.ref('imageSourceXRef', 'x')
  b.binary('imageSourceY', '*', 'imageSourceYRef', 'imageFive'); b.ref('imageSourceYRef', 'y')
  b.binary('imageSourceSum', '+', 'imageSourceX', 'imageSourceY')
  b.binary('imageSourceOffset', '+', 'imageSourceSum', 'imageThree')
  b.binary('imageSourceModulo', '%', 'imageSourceOffset', 'imageEleven')
  b.binary('imageSourceValue', '*', 'imageSourceModulo', 'imageEightValue')
  b.binary('imageSourceIndex', '+', 'imageSourceIndexY', 'imageSourceIndexX')
  b.binary('imageSourceIndexY', '*', 'imageSourceIndexYRead', 'imageWidth'); b.ref('imageSourceIndexYRead', 'y')
  b.binary('imageSourceIndexX', '*', 'imageSourceIndexXRead', 'imageOne'); b.ref('imageSourceIndexXRead', 'x')
  b.access('imageSourceTarget', 'imageSourceArray', 'imageSourceIndex'); b.ref('imageSourceArray', 'source')
  b.assign('imageSourceStore', 'imageSourceTarget', 'imageSourceValue')
  const sourceY = b.countedLoop('imageSourceYLoop', 'y', 'imageHeight', [b.countedLoop('imageSourceX', 'x', 'imageWidthLoop', ['imageSourceStore'])])
  const sourceProgress = callStatement(b, 'imageSourceProgress', 'imageValue', ['imageThirtyDouble']); b.make('imageThirtyDouble', 'CastExpression', { type: doubleType }, { argument: 'imageThirty' })

  // Flou 3×3 : centre pondéré et quatre voisins, uniquement sur l'intérieur.
  b.make('imageIndex', 'VariableDeclaration', { name: 'idx', type: intType }, { initializer: 'imageIndexValue' })
  b.binary('imageIndexValue', '+', 'imageIndexY', 'imageIndexX')
  b.binary('imageIndexY', '*', 'imageIndexYRead', 'imageWidthIndex'); b.ref('imageIndexYRead', 'iy'); b.intValue('imageWidthIndex', 8)
  b.ref('imageIndexX', 'ix')
  b.access('imageCenter', 'imageSourceCenter', 'imageIndexCenter'); b.ref('imageSourceCenter', 'source'); b.ref('imageIndexCenter', 'idx')
  b.binary('imageCenter4', '*', 'imageCenter', 'imageFour')
  b.binary('imageLeftIndex', '-', 'imageIndexLeft', 'imageOneLeft'); b.ref('imageIndexLeft', 'idx'); b.intValue('imageOneLeft', 1)
  b.access('imageLeft', 'imageSourceLeft', 'imageLeftIndex'); b.ref('imageSourceLeft', 'source')
  b.binary('imageRightIndex', '+', 'imageIndexRight', 'imageOneRight'); b.ref('imageIndexRight', 'idx'); b.intValue('imageOneRight', 1)
  b.access('imageRight', 'imageSourceRight', 'imageRightIndex'); b.ref('imageSourceRight', 'source')
  b.binary('imageUpIndex', '-', 'imageIndexUp', 'imageWidthUp'); b.ref('imageIndexUp', 'idx'); b.intValue('imageWidthUp', 8)
  b.access('imageUp', 'imageSourceUp', 'imageUpIndex'); b.ref('imageSourceUp', 'source')
  b.binary('imageDownIndex', '+', 'imageIndexDown', 'imageWidthDown'); b.ref('imageIndexDown', 'idx'); b.intValue('imageWidthDown', 8)
  b.access('imageDown', 'imageSourceDown', 'imageDownIndex'); b.ref('imageSourceDown', 'source')
  b.binary('imageSum1', '+', 'imageCenter4', 'imageLeft')
  b.binary('imageSum2', '+', 'imageSum1', 'imageRight')
  b.binary('imageSum3', '+', 'imageSum2', 'imageUp')
  b.binary('imageSum4', '+', 'imageSum3', 'imageDown')
  b.binary('imageAverage', '/', 'imageSum4', 'imageEightAverage')
  b.access('imageOutputTarget', 'imageOutputArray', 'imageIndexOutput'); b.ref('imageOutputArray', 'output'); b.ref('imageIndexOutput', 'idx')
  b.assign('imageOutputStore', 'imageOutputTarget', 'imageAverage')
  b.access('imageOutputRead', 'imageOutputReadArray', 'imageIndexCell'); b.ref('imageOutputReadArray', 'output'); b.ref('imageIndexCell', 'idx')
  callStatement(b, 'imageCellCall', 'imageCell', ['imageXArg', 'imageYArg', 'imageOutputRead']); b.ref('imageXArg', 'ix'); b.ref('imageYArg', 'iy')
  b.block('imageFilterBody', ['imageIndex', 'imageOutputStore', 'imageCellCallStatement'])
  const filterY = b.countedLoop('imageFilterY', 'iy', 'imageInteriorY', [b.countedLoop('imageFilterX', 'ix', 'imageInteriorX', ['imageFilterBody'], 1)], 1)
  const filterProgress = callStatement(b, 'imageFilterProgress', 'imageValue', ['imageSeventyDouble']); b.make('imageSeventyDouble', 'CastExpression', { type: doubleType }, { argument: 'imageSeventy' })

  // Histogramme des valeurs filtrées.
  b.make('imageValueVar', 'VariableDeclaration', { name: 'value', type: intType }, { initializer: 'imageValueRead' })
  b.access('imageValueRead', 'imageOutputHistArray', 'imageHistIndex'); b.ref('imageOutputHistArray', 'output'); b.ref('imageHistIndex', 'h')
  b.binary('imageBandRaw', '/', 'imageValueVarRef', 'imageTen'); b.ref('imageValueVarRef', 'value')
  b.math('imageBand', 'min', ['imageBandRaw', 'imageLimit'])
  b.access('imageCountRead', 'imageCountsReadArray', 'imageBandRead'); b.ref('imageCountsReadArray', 'counts'); b.ref('imageBandRead', 'band')
  b.variable('imageBandVar', 'band', intType, 'imageBand')
  b.binary('imageCountNext', '+', 'imageCountRead', 'imageOneCount'); b.intValue('imageOneCount', 1)
  b.access('imageCountTarget', 'imageCountsWriteArray', 'imageBandWrite'); b.ref('imageCountsWriteArray', 'counts'); b.ref('imageBandWrite', 'band')
  b.assign('imageCountStore', 'imageCountTarget', 'imageCountNext')
  b.block('imageHistBody', ['imageValueVar', 'imageBandVar', 'imageCountStore'])
  const histLoop = b.countedLoop('imageHistLoop', 'h', 'imageSizeHist', ['imageHistBody'])
  callStatement(b, 'imageBarsCall', 'imageBar', ['imageCountsArg']); b.ref('imageCountsArg', 'counts')
  b.make('imageHundredDouble', 'CastExpression', { type: doubleType }, { argument: 'imageHundred' })
  callStatement(b, 'imageDoneCall', 'imageValue', ['imageHundredDouble'])

  b.root('imageMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'imageBody' })
  b.stringValue('imageMessage', 'Image convolution')
  b.print('imagePrint', 'imageMessage')
  b.block('imageBody', ['imageSource', 'imageOutput', 'imageCounts', range, sourceY, 'imageSourceProgressStatement', filterY, 'imageFilterProgressStatement', histLoop, 'imageBarsCallStatement', 'imageDoneCallStatement', 'imagePrint'])

  return workspace(b.project, [
    note('imageNote', 'Image convolution', 'Un motif déterministe de 8×6 est filtré par une moyenne 3×3 sur l’intérieur de l’image. La heatmap affiche le résultat filtré, les barres l’histogramme des valeurs et la progression les trois phases : génération, convolution, histogramme.', 0, 1000, 900, 220),
  ])
}


// Station météo : températures par zone, pluie par jour et indice de confort.
function weatherStation() {
  const b = builder()
  const heat = createHeatmapModule('weatherHeat', 'Temperature map', 1, { width: 7, height: 5 })
  const bars = createBarChartModule('weatherBars', 'Rainfall', 1, { size: 7 })
  const comfort = createProgressModule('weatherComfort', 'Comfort index', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, comfort.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...comfort.nodes)
  b.useModule('weatherApp', 'Weather station')
  const app = b.project.modules.find((module) => module.id === 'weatherApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'weatherCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setTemperature')
  importFunction(app, 'weatherBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'setRain')
  importFunction(app, 'weatherValue', comfort.module.id, exported(comfort, 'PROGRESS_SP3_SET_VALUE_1'), 'setComfort')
  importFunction(app, 'weatherRange', comfort.module.id, exported(comfort, 'PROGRESS_SP3_SET_RANGE_1'), 'setComfortRange')

  b.intValue('weatherDays', 7); b.intValue('weatherDaysRain', 7); b.intValue('weatherZones', 5); b.intValue('weatherTwelve', 12)
  b.intValue('weatherFiveHeat', 5); b.intValue('weatherThreeHeat', 3); b.intValue('weatherSevenHeat', 7); b.intValue('weatherEighteen', 18)
  b.intValue('weatherThirteen', 13); b.intValue('weatherSevenRain', 7); b.intValue('weatherForty', 40)
  b.intValue('weatherThirtyFive', 35); b.intValue('weatherTwentyTwo', 22); b.intValue('weatherFour', 4)
  b.intValue('weatherHundred', 100)
  b.doubleValue('weatherMin', '0.0'); b.doubleValue('weatherMax', '100.0')
  const range = callStatement(b, 'weatherRangeCall', 'weatherRange', ['weatherMin', 'weatherMax'])
  b.make('weatherTotal', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'weatherTotalStart' })
  b.intValue('weatherTotalStart', 0)

  // Températures : 12 + ((jour × 5 + zone × 3 + 7) mod 18).
  b.binary('weatherTempDay', '*', 'weatherTempDayRead', 'weatherFiveHeat'); b.ref('weatherTempDayRead', 'day')
  b.binary('weatherTempZone', '*', 'weatherTempZoneRead', 'weatherThreeHeat'); b.ref('weatherTempZoneRead', 'zone')
  b.binary('weatherTempSum', '+', 'weatherTempDay', 'weatherTempZone')
  b.binary('weatherTempOffset', '+', 'weatherTempSum', 'weatherSevenHeat')
  b.binary('weatherTempModulo', '%', 'weatherTempOffset', 'weatherEighteen')
  b.binary('weatherTemp', '+', 'weatherTwelve', 'weatherTempModulo')
  b.variable('weatherTempVar', 'temp', intType, 'weatherTemp')
  callStatement(b, 'weatherCellCall', 'weatherCell', ['weatherDayArg', 'weatherZoneArg', 'weatherTempArg']); b.ref('weatherDayArg', 'day'); b.ref('weatherZoneArg', 'zone'); b.ref('weatherTempArg', 'temp')
  b.binary('weatherTotalNext', '+', 'weatherTotalRead', 'weatherTempTotal'); b.ref('weatherTotalRead', 'total'); b.ref('weatherTempTotal', 'temp')
  b.assign('weatherTotalStore', 'weatherTotalTarget', 'weatherTotalNext'); b.ref('weatherTotalTarget', 'total')
  b.block('weatherZoneBody', ['weatherTempVar', 'weatherCellCallStatement', 'weatherTotalStore'])
  const zoneLoop = b.countedLoop('weatherZoneLoop', 'zone', 'weatherZones', ['weatherZoneBody'])
  const dayHeatLoop = b.countedLoop('weatherDayHeatLoop', 'day', 'weatherDays', [zoneLoop])

  // Pluie : motif journalier indépendant.
  b.binary('weatherRainDay', '*', 'weatherRainDayRead', 'weatherThirteen'); b.ref('weatherRainDayRead', 'day')
  b.binary('weatherRainOffset', '+', 'weatherRainDay', 'weatherSevenRain')
  b.binary('weatherRain', '%', 'weatherRainOffset', 'weatherForty')
  callStatement(b, 'weatherBarCall', 'weatherBar', ['weatherRainDayArg', 'weatherRain']); b.ref('weatherRainDayArg', 'day')
  const dayRainLoop = b.countedLoop('weatherDayRainLoop', 'day', 'weatherDaysRain', ['weatherBarCallStatement'])

  // Confort : écart à 22 °C, pénalisé de 4 points par degré.
  b.binary('weatherAverage', '/', 'weatherTotalValue', 'weatherThirtyFive'); b.ref('weatherTotalValue', 'total')
  b.binary('weatherGap', '-', 'weatherAverage', 'weatherTwentyTwo')
  b.math('weatherGapAbs', 'abs', ['weatherGap'])
  b.binary('weatherPenalty', '*', 'weatherGapAbs', 'weatherFour')
  b.binary('weatherComfortRaw', '-', 'weatherHundred', 'weatherPenalty')
  b.math('weatherComfortValue', 'clamp', ['weatherComfortRaw', 'weatherZeroClamp', 'weatherHundredClamp'])
  b.intValue('weatherZeroClamp', 0); b.intValue('weatherHundredClamp', 100)
  b.make('weatherComfortDouble', 'CastExpression', { type: doubleType }, { argument: 'weatherComfortValue' })
  callStatement(b, 'weatherComfortCall', 'weatherValue', ['weatherComfortDouble'])

  b.root('weatherMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'weatherBody' })
  b.stringValue('weatherMessage', 'Weather station')
  b.print('weatherPrint', 'weatherMessage')
  b.block('weatherBody', ['weatherTotal', range, dayHeatLoop, dayRainLoop, 'weatherComfortCallStatement', 'weatherPrint'])

  return workspace(b.project, [
    note('weatherNote', 'Weather station', 'Sept jours et cinq zones. La heatmap affiche les températures calculées, les barres la pluie journalière, et la barre de progression l’indice de confort déduit de l’écart moyen à 22 °C. Les trois widgets sont mis à jour pendant le parcours.', 0, 1000, 900, 220),
  ])
}

// Moniteur réseau : charge par port, requêtes par minute et charge globale.
function networkMonitor() {
  const b = builder()
  const heat = createHeatmapModule('networkHeat', 'Port activity', 1, { width: 8, height: 6 })
  const bars = createBarChartModule('networkBars', 'Requests per minute', 1, { size: 8 })
  const load = createProgressModule('networkLoad', 'Global load', 1, { min: 0, max: 100 })
  b.project.modules.push(heat.module, bars.module, load.module)
  b.project.nodes.push(...heat.nodes, ...bars.nodes, ...load.nodes)
  b.useModule('networkApp', 'Network monitor')
  const app = b.project.modules.find((module) => module.id === 'networkApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'networkCell', heat.module.id, exported(heat, 'HEATMAP_SP3_SET_CELL_1'), 'setPortLoad')
  importFunction(app, 'networkBar', bars.module.id, exported(bars, 'BARCHART_SP3_SET_VALUE_1'), 'setMinuteLoad')
  importFunction(app, 'networkValue', load.module.id, exported(load, 'PROGRESS_SP3_SET_VALUE_1'), 'setGlobalLoad')
  importFunction(app, 'networkRange', load.module.id, exported(load, 'PROGRESS_SP3_SET_RANGE_1'), 'setGlobalRange')

  b.intValue('networkMinutes', 8); b.intValue('networkPorts', 6); b.intValue('networkSeven', 7)
  b.intValue('networkEleven', 11); b.intValue('networkFive', 5); b.intValue('networkTwenty', 20)
  b.intValue('networkHundred', 100); b.intValue('networkNineteen', 19)
  b.intValue('networkFortyEight', 48)
  b.doubleValue('networkMin', '0.0'); b.doubleValue('networkMax', '100.0')
  const range = callStatement(b, 'networkRangeCall', 'networkRange', ['networkMin', 'networkMax'])
  b.make('networkTotal', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'networkTotalStart' })
  b.intValue('networkTotalStart', 0)

  // Charge d'un port : (minute × 7 + port × 11 + 5) mod 20.
  b.binary('networkLoadMinute', '*', 'networkLoadMinuteRead', 'networkSeven'); b.ref('networkLoadMinuteRead', 'minute')
  b.binary('networkLoadPort', '*', 'networkLoadPortRead', 'networkEleven'); b.ref('networkLoadPortRead', 'port')
  b.binary('networkLoadSum', '+', 'networkLoadMinute', 'networkLoadPort')
  b.binary('networkLoadOffset', '+', 'networkLoadSum', 'networkFive')
  b.binary('networkLoadModulo', '%', 'networkLoadOffset', 'networkTwenty')
  b.variable('networkLoadVar', 'load', intType, 'networkLoadModulo')
  b.binary('networkHeatValue', '*', 'networkLoadHeatRead', 'networkFiveHeat'); b.ref('networkLoadHeatRead', 'load'); b.intValue('networkFiveHeat', 5)
  callStatement(b, 'networkCellCall', 'networkCell', ['networkMinuteArg', 'networkPortArg', 'networkHeatValue']); b.ref('networkMinuteArg', 'minute'); b.ref('networkPortArg', 'port')
  b.binary('networkPortSumNext', '+', 'networkPortSumRead', 'networkLoadPortSum'); b.ref('networkPortSumRead', 'portSum'); b.ref('networkLoadPortSum', 'load')
  b.assign('networkPortSumStore', 'networkPortSumTarget', 'networkPortSumNext'); b.ref('networkPortSumTarget', 'portSum')
  b.binary('networkTotalNext', '+', 'networkTotalRead', 'networkLoadTotal'); b.ref('networkTotalRead', 'total'); b.ref('networkLoadTotal', 'load')
  b.assign('networkTotalStore', 'networkTotalTarget', 'networkTotalNext'); b.ref('networkTotalTarget', 'total')
  b.block('networkPortBody', ['networkLoadVar', 'networkCellCallStatement', 'networkPortSumStore', 'networkTotalStore'])
  const portLoop = b.countedLoop('networkPortLoop', 'port', 'networkPorts', ['networkPortBody'])
  b.make('networkPortSum', 'VariableDeclaration', { name: 'portSum', type: intType }, { initializer: 'networkPortSumStart' })
  b.intValue('networkPortSumStart', 0)
  callStatement(b, 'networkBarCall', 'networkBar', ['networkMinuteBarArg', 'networkPortSumValue']); b.ref('networkMinuteBarArg', 'minute'); b.ref('networkPortSumValue', 'portSum')
  b.block('networkMinuteBody', ['networkPortSum', portLoop, 'networkBarCallStatement'])
  const minuteLoop = b.countedLoop('networkMinuteLoop', 'minute', 'networkMinutes', ['networkMinuteBody'])

  // Charge globale : total / (8 × 6 × 19), plafonnée à 100.
  b.binary('networkCapacity', '*', 'networkFortyEight', 'networkNineteen')
  b.binary('networkScaled', '*', 'networkTotalValue', 'networkHundred'); b.ref('networkTotalValue', 'total')
  b.binary('networkPercent', '/', 'networkScaled', 'networkCapacity')
  b.math('networkLoadValue', 'clamp', ['networkPercent', 'networkZeroClamp', 'networkHundredClamp'])
  b.intValue('networkZeroClamp', 0); b.intValue('networkHundredClamp', 100)
  b.make('networkLoadDouble', 'CastExpression', { type: doubleType }, { argument: 'networkLoadValue' })
  callStatement(b, 'networkLoadCall', 'networkValue', ['networkLoadDouble'])

  b.root('networkMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'networkBody' })
  b.stringValue('networkMessage', 'Network monitor')
  b.print('networkPrint', 'networkMessage')
  b.block('networkBody', ['networkTotal', range, minuteLoop, 'networkLoadCallStatement', 'networkPrint'])

  return workspace(b.project, [
    note('networkNote', 'Network monitor', 'Huit minutes et six ports. La heatmap affiche la charge de chaque port, les barres la somme des ports par minute et la progression la charge globale normalisée. Les trois widgets évoluent ensemble pendant le parcours.', 0, 1000, 900, 220),
  ])
}


// Moniteur réseau : charge par port, requêtes par minute et charge globale.
// Rover : exploration d'une carte, batterie, LED d'artefact et écran pixel.
function roverSurvey() {
  const b = builder()
  const width = 48
  const height = 18
  const frames = 19
  const interfaceType = { kind: 'function', parameters: [intType], returnType: voidType }
  const screen = createScreenModule('roverScreen', 'Rover map', 1, { width, height })
  const gauge = createGaugeModule('roverGauge', 'Battery', 1, { min: 0, max: 100 })
  const led = createLedModule('roverLed', 'Artifact found', 1, { value: false })
  b.project.modules.push(screen.module, gauge.module, led.module)
  b.project.nodes.push(...screen.nodes, ...gauge.nodes, ...led.nodes)

  const setPixel = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const present = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  const setBattery = gauge.module.exports.find((entry) => entry.name === 'GAUGE_SP3_SET_VALUE_1')
  const setFound = led.module.exports.find((entry) => entry.name === 'LED_SP3_SET_VALUE_1')

  // Carte : alias de type, constante et lecture d'une case.
  b.useModule('roverMap', 'Rover map data')
  b.root('roverTileType', 'TypeDeclaration', { name: 'Tile', type: intType })
  b.root('roverArtifact', 'ConstantDeclaration', { name: 'ARTIFACT', type: intType }, { initializer: 'roverArtifactValue' })
  b.intValue('roverArtifactValue', 2)
  b.root('roverTileAt', 'FunctionDeclaration', { name: 'tileAt', type: intType }, { parameters: ['roverCells', 'roverWidth', 'roverXArg', 'roverYArg'], body: 'roverTileBody' })
  b.make('roverCells', 'Parameter', { name: 'cells', type: intArrayType })
  b.make('roverWidth', 'Parameter', { name: 'width', type: intType })
  b.make('roverXArg', 'Parameter', { name: 'x', type: intType })
  b.make('roverYArg', 'Parameter', { name: 'y', type: intType })
  b.block('roverTileBody', ['roverTileValue', 'roverTileReturn'])
  b.binary('roverTileIndex', '+', 'roverTileRow', 'roverXRead')
  b.binary('roverTileRow', '*', 'roverYRead', 'roverWidthRead')
  b.ref('roverYRead', 'y'); b.ref('roverWidthRead', 'width'); b.ref('roverXRead', 'x')
  b.make('roverTileValue', 'VariableDeclaration', { name: 'tile', type: { kind: 'named', target: { kind: 'name', name: 'Tile' } } }, { initializer: 'roverTileAccess' })
  b.access('roverTileAccess', 'roverCellsRef', 'roverTileIndex')
  b.ref('roverCellsRef', 'cells')
  b.returnValue('roverTileReturn', 'roverTileRef'); b.ref('roverTileRef', 'tile')
  b.root('roverIsArtifact', 'FunctionDeclaration', { name: 'isArtifact', type: { kind: 'primitive', name: 'boolean' } }, { parameters: ['roverFindCells', 'roverFindWidth', 'roverFindX', 'roverFindY'], body: 'roverFindBody' })
  b.make('roverFindCells', 'Parameter', { name: 'cells', type: intArrayType })
  b.make('roverFindWidth', 'Parameter', { name: 'width', type: intType })
  b.make('roverFindX', 'Parameter', { name: 'x', type: intType })
  b.make('roverFindY', 'Parameter', { name: 'y', type: intType })
  b.block('roverFindBody', ['roverFindValue', 'roverFindReturn'])
  b.make('roverFindValue', 'VariableDeclaration', { name: 'tile', type: { kind: 'named', target: { kind: 'name', name: 'Tile' } } }, { initializer: 'roverFindCall' })
  b.call('roverFindCall', 'roverFindRef', ['roverFindCellsArg', 'roverFindWidthArg', 'roverFindXArg', 'roverFindYArg'])
  b.ref('roverFindRef', 'tileAt'); b.ref('roverFindCellsArg', 'cells'); b.ref('roverFindWidthArg', 'width'); b.ref('roverFindXArg', 'x'); b.ref('roverFindYArg', 'y')
  b.returnValue('roverFindReturn', 'roverFindCompare')
  b.binary('roverFindCompare', '==', 'roverFindValueRef', 'roverArtifactRef')
  b.ref('roverFindValueRef', 'tile'); b.ref('roverArtifactRef', 'ARTIFACT')

  // Déplacement : pointeurs, boucle while, sortie par break et drain de batterie.
  b.useModule('roverDrive', 'Rover drive')
  b.root('roverExplore', 'FunctionDeclaration', { name: 'explore', type: { kind: 'primitive', name: 'boolean' } }, { parameters: ['driveCells', 'driveWidth', 'driveHeight', 'driveX', 'driveY', 'driveBattery', 'driveTargetX', 'driveTargetY'], body: 'driveBody' })
  b.make('driveCells', 'Parameter', { name: 'cells', type: intArrayType })
  b.make('driveWidth', 'Parameter', { name: 'width', type: intType })
  b.make('driveHeight', 'Parameter', { name: 'height', type: intType })
  b.make('driveX', 'Parameter', { name: 'x', type: intPointerType })
  b.make('driveY', 'Parameter', { name: 'y', type: intPointerType })
  b.make('driveBattery', 'Parameter', { name: 'battery', type: intPointerType })
  b.make('driveTargetX', 'Parameter', { name: 'targetX', type: intType })
  b.make('driveTargetY', 'Parameter', { name: 'targetY', type: intType })
  b.block('driveBody', ['driveDx', 'driveDy', 'driveAttempts', 'driveMoved', 'driveLoop', 'driveReturn'])
  b.make('driveDx', 'VariableDeclaration', { name: 'dx', type: intType }, { initializer: 'driveDxCall' })
  b.make('driveDxCall', 'MathCall', { name: 'sign' }, { arguments: ['driveDxDelta'] })
  b.binary('driveDxDelta', '-', 'driveTargetXRead', 'driveXNow'); b.ref('driveTargetXRead', 'targetX'); b.deref('driveXNow', 'driveXNowRef'); b.ref('driveXNowRef', 'x')
  b.make('driveDy', 'VariableDeclaration', { name: 'dy', type: intType }, { initializer: 'driveDyCall' })
  b.make('driveDyCall', 'MathCall', { name: 'sign' }, { arguments: ['driveDyDelta'] })
  b.binary('driveDyDelta', '-', 'driveTargetYRead', 'driveYNow'); b.ref('driveTargetYRead', 'targetY'); b.deref('driveYNow', 'driveYNowRef'); b.ref('driveYNowRef', 'y')
  b.make('driveAttempts', 'VariableDeclaration', { name: 'attempts', type: intType }, { initializer: 'driveAttemptsStart' }); b.intValue('driveAttemptsStart', 0)
  b.make('driveMoved', 'VariableDeclaration', { name: 'moved', type: { kind: 'primitive', name: 'boolean' } }, { initializer: 'driveMovedStart' }); b.make('driveMovedStart', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: false })
  b.make('driveLoop', 'WhileStatement', {}, { test: 'driveTest', body: 'driveLoopBody' })
  b.binary('driveTest', '<', 'driveAttemptRead', 'driveFour'); b.ref('driveAttemptRead', 'attempts'); b.intValue('driveFour', 4)
  b.block('driveLoopBody', ['driveNextX', 'driveNextY', 'driveBlocked', 'driveRetryDx', 'driveRetryDy', 'driveStep'])
  b.make('driveNextX', 'VariableDeclaration', { name: 'nextX', type: intType }, { initializer: 'driveNextXCall' })
  b.make('driveNextXCall', 'MathCall', { name: 'clamp' }, { arguments: ['driveNextXSum', 'driveZero', 'driveMaxX'] })
  b.binary('driveNextXSum', '+', 'driveXRead', 'driveDxRead')
  b.deref('driveXRead', 'driveXRef'); b.ref('driveXRef', 'x'); b.ref('driveDxRead', 'dx')
  b.binary('driveMaxX', '-', 'driveWidthRead', 'driveOneX'); b.ref('driveWidthRead', 'width'); b.intValue('driveOneX', 1)
  b.intValue('driveZero', 0)
  b.make('driveNextY', 'VariableDeclaration', { name: 'nextY', type: intType }, { initializer: 'driveNextYCall' })
  b.make('driveNextYCall', 'MathCall', { name: 'clamp' }, { arguments: ['driveNextYSum', 'driveZeroY', 'driveMaxY'] })
  b.binary('driveNextYSum', '+', 'driveYRead', 'driveDyRead')
  b.deref('driveYRead', 'driveYRef'); b.ref('driveYRef', 'y'); b.ref('driveDyRead', 'dy')
  b.binary('driveMaxY', '-', 'driveHeightRead', 'driveOneYMax'); b.ref('driveHeightRead', 'height'); b.intValue('driveOneYMax', 1)
  b.intValue('driveZeroY', 0)
  b.make('driveBlocked', 'IfStatement', {}, { test: 'driveRockTest', consequent: 'driveMoveBody', alternate: null })
  b.binary('driveRockTest', '!=', 'driveCellValue', 'driveRock')
  b.access('driveCellValue', 'driveCellsRef', 'driveCellIndex'); b.ref('driveCellsRef', 'cells')
  b.binary('driveCellIndex', '+', 'driveCellRow', 'driveNextXRef'); b.binary('driveCellRow', '*', 'driveNextYRef', 'driveCellWidth'); b.ref('driveNextYRef', 'nextY'); b.ref('driveCellWidth', 'width'); b.ref('driveNextXRef', 'nextX')
  b.intValue('driveRock', 1)
  b.block('driveMoveBody', ['driveWriteX', 'driveWriteY', 'driveBatteryStep', 'driveMovedTrue', 'driveBreak'])
  b.make('driveWriteX', 'AssignmentStatement', {}, { target: 'driveXTarget', value: 'driveNextXValue' })
  b.deref('driveXTarget', 'driveXTargetRef'); b.ref('driveXTargetRef', 'x'); b.ref('driveNextXValue', 'nextX')
  b.make('driveWriteY', 'AssignmentStatement', {}, { target: 'driveYTarget', value: 'driveNextYValue' })
  b.deref('driveYTarget', 'driveYTargetRef'); b.ref('driveYTargetRef', 'y'); b.ref('driveNextYValue', 'nextY')
  b.make('driveBatteryStep', 'AssignmentStatement', {}, { target: 'driveBatteryTarget', value: 'driveBatteryNext' })
  b.deref('driveBatteryTarget', 'driveBatteryTargetRef'); b.ref('driveBatteryTargetRef', 'battery')
  b.make('driveBatteryNext', 'MathCall', { name: 'clamp' }, { arguments: ['driveBatteryMinus', 'driveBatteryZero', 'driveBatteryHundred'] })
  b.binary('driveBatteryMinus', '-', 'driveBatteryRead', 'driveBatteryCost'); b.deref('driveBatteryRead', 'driveBatteryReadRef'); b.ref('driveBatteryReadRef', 'battery'); b.intValue('driveBatteryCost', 2)
  b.intValue('driveBatteryZero', 0); b.intValue('driveBatteryHundred', 100)
  b.make('driveMovedTrue', 'AssignmentStatement', {}, { target: 'driveMovedTarget', value: 'driveTrue' }); b.ref('driveMovedTarget', 'moved'); b.make('driveTrue', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  b.make('driveBreak', 'BreakStatement')
  b.make('driveRetryDx', 'AssignmentStatement', {}, { target: 'driveDxTarget', value: 'driveDxRandom' })
  b.ref('driveDxTarget', 'dx'); b.make('driveDxRandom', 'MathCall', { name: 'randomInt' }, { arguments: ['driveRetryMinX', 'driveRetryMaxX'] }); b.intValue('driveRetryMinX', -1); b.intValue('driveRetryMaxX', 1)
  b.make('driveRetryDy', 'AssignmentStatement', {}, { target: 'driveDyTarget', value: 'driveDyRandom' })
  b.ref('driveDyTarget', 'dy'); b.make('driveDyRandom', 'MathCall', { name: 'randomInt' }, { arguments: ['driveRetryMinY', 'driveRetryMaxY'] }); b.intValue('driveRetryMinY', -1); b.intValue('driveRetryMaxY', 1)
  b.make('driveStep', 'AssignmentStatement', {}, { target: 'driveAttemptTarget', value: 'driveAttemptNext' })
  b.ref('driveAttemptTarget', 'attempts'); b.binary('driveAttemptNext', '+', 'driveAttemptReadNext', 'driveOneAttempt'); b.ref('driveAttemptReadNext', 'attempts'); b.intValue('driveOneAttempt', 1)
  b.returnValue('driveReturn', 'driveMovedRef'); b.ref('driveMovedRef', 'moved')

  // Parcours : ForEach sur des indices et rappel de type fonction.
  b.useModule('roverSurvey', 'Rover survey tools')
  b.root('roverEach', 'FunctionDeclaration', { name: 'forEachIndex', type: voidType }, { parameters: ['eachIndices', 'eachVisit'], body: 'eachBody' })
  b.make('eachIndices', 'Parameter', { name: 'indices', type: intArrayType })
  b.make('eachVisit', 'Parameter', { name: 'visit', type: interfaceType })
  b.block('eachBody', ['eachStatement'])
  b.make('eachStatement', 'ForEachStatement', {}, { array: 'eachArrayRef', callback: 'eachVisitRef' })
  b.ref('eachArrayRef', 'indices'); b.ref('eachVisitRef', 'visit')

  // Mission : cartographie, boucle de 24 images, jauge, LED et écran.
  b.useModule('roverApp', 'Rover mission')
  b.root('roverCellsData', 'VariableDeclaration', { name: 'cells', type: intArrayType }, { initializer: 'roverCellsCreate' })
  b.make('roverCellsCreate', 'ArrayCreation', { elementType: intType }, { size: 'roverCellsSize', initializer: 'roverCellsZero' })
  b.intValue('roverCellsSize', width * height); b.intValue('roverCellsZero', 0)
  const rocks = []
  for (let index = 0; rocks.length < 30; index += 1) {
    const x = (index * 7 + 3) % (width - 4) + 2
    const y = (index * 5 + 2) % (height - 4) + 2
    const cell = y * width + x
    if (y <= 5 || y >= 15 || x <= 5 || Math.abs(x - y) <= 8) continue
    if (!rocks.includes(cell)) rocks.push(cell)
  }
  b.root('roverRockIndices', 'VariableDeclaration', { name: 'rocks', type: intArrayType }, { initializer: 'roverRockList' })
  b.make('roverRockList', 'ArrayLiteral', { elementType: intType }, { elements: rocks.map((cell, index) => {
    const id = `roverRockValue${index}`
    b.intValue(id, cell)
    return id
  }) })
  // L'artefact tombe dans la bande haute ou la bande basse, à une abscisse quelconque.
  b.root('roverArtifactMode', 'VariableDeclaration', { name: 'artifactMode', type: intType }, { initializer: 'roverArtifactModeValue' })
  b.make('roverArtifactModeValue', 'MathCall', { name: 'randomInt' }, { arguments: ['roverArtifactModeMin', 'roverArtifactModeMax'] })
  b.intValue('roverArtifactModeMin', 0); b.intValue('roverArtifactModeMax', 1)
  b.root('roverArtifactX', 'VariableDeclaration', { name: 'artifactX', type: intType }, { initializer: 'roverArtifactXValue' })
  b.make('roverArtifactXValue', 'MathCall', { name: 'randomInt' }, { arguments: ['roverArtifactXMin', 'roverArtifactXMax'] })
  b.intValue('roverArtifactXMin', 2); b.intValue('roverArtifactXMax', 38)
  b.root('roverArtifactY', 'VariableDeclaration', { name: 'artifactY', type: intType }, { initializer: 'roverArtifactYValue' })
  b.make('roverArtifactYValue', 'MathCall', { name: 'randomInt' }, { arguments: ['roverArtifactYMin', 'roverArtifactYMax'] })
  b.intValue('roverArtifactYMin', 3); b.intValue('roverArtifactYMax', 5)
  b.root('roverArtifactIndex', 'VariableDeclaration', { name: 'ARTIFACT_INDEX', type: intType }, { initializer: 'roverArtifactIndexValue' })
  b.binary('roverArtifactIndexValue', '+', 'roverArtifactIndexRow', 'roverArtifactIndexColumn')
  b.binary('roverArtifactIndexRow', '*', 'roverArtifactIndexYRef', 'roverArtifactIndexWidth')
  b.ref('roverArtifactIndexYRef', 'artifactY'); b.intValue('roverArtifactIndexWidth', width); b.ref('roverArtifactIndexColumn', 'artifactX')
  // En mode bas, l'artefact descend dans la bande basse et l'index est recalculé.
  b.make('roverArtifactBottom', 'IfStatement', {}, { test: 'roverArtifactBottomTest', consequent: 'roverArtifactBottomBody', alternate: null })
  b.binary('roverArtifactBottomTest', '==', 'roverArtifactModeRead', 'roverArtifactBottomMode'); b.ref('roverArtifactModeRead', 'artifactMode'); b.intValue('roverArtifactBottomMode', 1)
  b.block('roverArtifactBottomBody', ['roverArtifactBottomY', 'roverArtifactBottomIndex'])
  b.make('roverArtifactBottomY', 'AssignmentStatement', {}, { target: 'roverArtifactBottomYTarget', value: 'roverArtifactBottomYValue' })
  b.ref('roverArtifactBottomYTarget', 'artifactY'); b.make('roverArtifactBottomYValue', 'MathCall', { name: 'randomInt' }, { arguments: ['roverArtifactBottomYMin', 'roverArtifactBottomYMax'] }); b.intValue('roverArtifactBottomYMin', 15); b.intValue('roverArtifactBottomYMax', 17)
  b.make('roverArtifactBottomIndex', 'AssignmentStatement', {}, { target: 'roverArtifactBottomIndexTarget', value: 'roverArtifactBottomIndexValue' })
  b.ref('roverArtifactBottomIndexTarget', 'ARTIFACT_INDEX')
  b.binary('roverArtifactBottomIndexValue', '+', 'roverArtifactBottomRow', 'roverArtifactBottomColumn')
  b.binary('roverArtifactBottomRow', '*', 'roverArtifactBottomYRef', 'roverArtifactBottomWidth')
  b.ref('roverArtifactBottomYRef', 'artifactY'); b.intValue('roverArtifactBottomWidth', width); b.ref('roverArtifactBottomColumn', 'artifactX')
  b.root('roverBattery', 'VariableDeclaration', { name: 'battery', type: intType }, { initializer: 'roverBatteryStart' }); b.intValue('roverBatteryStart', 100)
  b.root('roverXData', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'roverXStart' }); b.intValue('roverXStart', 1)
  b.root('roverYData', 'VariableDeclaration', { name: 'y', type: intType }, { initializer: 'roverYStart' }); b.intValue('roverYStart', 1)
  b.root('roverFoundData', 'VariableDeclaration', { name: 'found', type: { kind: 'primitive', name: 'boolean' } }, { initializer: 'roverFoundStart' }); b.make('roverFoundStart', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: false })
  b.root('roverPainter', 'ConstantDeclaration', { name: 'painter', type: interfaceType }, { initializer: 'roverPainterRef' }); b.ref('roverPainterRef', 'paintRock')

  b.root('roverMarkRock', 'FunctionDeclaration', { name: 'markRock', type: voidType }, { parameters: ['markIndex'], body: 'markBody' })
  b.make('markIndex', 'Parameter', { name: 'index', type: intType })
  b.block('markBody', ['markAssignment'])
  b.make('markAssignment', 'AssignmentStatement', {}, { target: 'markTarget', value: 'markOne' })
  b.access('markTarget', 'markCellsRef', 'markIndexRef'); b.ref('markCellsRef', 'cells'); b.ref('markIndexRef', 'index'); b.intValue('markOne', 1)

  b.root('roverPaintRock', 'FunctionDeclaration', { name: 'paintRock', type: voidType }, { parameters: ['paintIndex'], body: 'paintBody' })
  b.make('paintIndex', 'Parameter', { name: 'index', type: intType })
  b.block('paintBody', ['paintCallStatement'])
  b.make('paintCallStatement', 'ExpressionStatement', {}, { expression: 'paintCall' })
  b.call('paintCall', 'paintCallee', ['paintIndexRef', 'paintRed', 'paintGreen', 'paintBlue', 'paintAlpha'])
  b.make('paintCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.ref('paintIndexRef', 'index'); b.intValue('paintRed', 72); b.intValue('paintGreen', 86); b.intValue('paintBlue', 112); b.intValue('paintAlpha', 255)

  b.root('roverMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'roverMainBody' })
  b.make('roverRockCursor', 'VariableDeclaration', { name: 'r', type: intType }, { initializer: 'roverRockCursorStart' }); b.intValue('roverRockCursorStart', 0)
  b.binary('roverRockTest', '<', 'roverRockCursorRead', 'roverRockCount'); b.ref('roverRockCursorRead', 'r'); b.intValue('roverRockCount', rocks.length)
  b.make('roverRockStep', 'AssignmentStatement', {}, { target: 'roverRockCursorTarget', value: 'roverRockCursorNext' }); b.ref('roverRockCursorTarget', 'r'); b.binary('roverRockCursorNext', '+', 'roverRockCursorNextRead', 'roverRockOne'); b.ref('roverRockCursorNextRead', 'r'); b.intValue('roverRockOne', 1)
  b.block('roverMarkLoopBody', ['roverMarkCallStatement'])
  b.make('roverMarkCallStatement', 'ExpressionStatement', {}, { expression: 'roverMarkCall' })
  b.call('roverMarkCall', 'roverMarkCallee', ['roverRockCell'])
  b.ref('roverMarkCallee', 'markRock')
  b.access('roverRockCell', 'roverRockArrayRef', 'roverRockCursorIndex'); b.ref('roverRockArrayRef', 'rocks'); b.ref('roverRockCursorIndex', 'r')
  b.make('roverMarkLoop', 'ForStatement', {}, { initializer: 'roverRockCursor', test: 'roverRockTest', update: 'roverRockStep', body: 'roverMarkLoopBody' })

  b.make('roverPaintStatement', 'ExpressionStatement', {}, { expression: 'roverPaintEachCall' })
  b.call('roverPaintEachCall', 'roverPaintEachCallee', ['roverRocksArg', 'roverPainterArg'])
  b.make('roverPaintEachCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverEachImport' } })
  b.ref('roverRocksArg', 'rocks'); b.ref('roverPainterArg', 'painter')
  b.make('roverArtifactMark', 'AssignmentStatement', {}, { target: 'roverArtifactMarkTarget', value: 'roverArtifactTwoMark' })
  b.access('roverArtifactMarkTarget', 'roverArtifactMarkCells', 'roverArtifactMarkIndex')
  b.ref('roverArtifactMarkCells', 'cells'); b.ref('roverArtifactMarkIndex', 'ARTIFACT_INDEX'); b.intValue('roverArtifactTwoMark', 2)
  b.make('roverArtifactPaintStatement', 'ExpressionStatement', {}, { expression: 'roverArtifactPaintCall' })
  b.call('roverArtifactPaintCall', 'roverArtifactPaintCallee', ['roverArtifactIndexRef', 'roverArtifactRed', 'roverArtifactGreen', 'roverArtifactBlue', 'roverArtifactAlpha'])
  b.make('roverArtifactPaintCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.ref('roverArtifactIndexRef', 'ARTIFACT_INDEX'); b.intValue('roverArtifactRed', 148); b.intValue('roverArtifactGreen', 190); b.intValue('roverArtifactBlue', 255); b.intValue('roverArtifactAlpha', 255)
  b.make('roverStartPixelStatement', 'ExpressionStatement', {}, { expression: 'roverStartPixelCall' })
  b.call('roverStartPixelCall', 'roverStartPixelCallee', ['roverStartIndex', 'roverRoverRed', 'roverRoverGreen', 'roverRoverBlue', 'roverRoverAlpha'])
  b.make('roverStartPixelCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.binary('roverStartIndex', '+', 'roverStartRow', 'roverStartX'); b.binary('roverStartRow', '*', 'roverStartY', 'roverWidthValue'); b.ref('roverStartY', 'y'); b.intValue('roverWidthValue', width); b.ref('roverStartX', 'x')
  b.intValue('roverRoverRed', 255); b.intValue('roverRoverGreen', 213); b.intValue('roverRoverBlue', 71); b.intValue('roverRoverAlpha', 255)

  b.make('roverFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'roverFrameStart' }); b.intValue('roverFrameStart', 0)
  b.binary('roverFrameTest', '<', 'roverFrameRead', 'roverFrameEnd'); b.ref('roverFrameRead', 'frame'); b.intValue('roverFrameEnd', frames)
  b.make('roverFrameStep', 'AssignmentStatement', {}, { target: 'roverFrameTarget', value: 'roverFrameNext' }); b.ref('roverFrameTarget', 'frame'); b.binary('roverFrameNext', '+', 'roverFrameNextRead', 'roverFrameOne'); b.ref('roverFrameNextRead', 'frame'); b.intValue('roverFrameOne', 1)
  b.block('roverFrameBody', [
    'roverOldX', 'roverOldY', 'roverMovedFirst', 'roverMoved', 'roverMovedMerge', 'roverContinue', 'roverOldIndex',
    'roverClearStatement', 'roverArtifactRestore', 'roverDrawStatement', 'roverFoundIf',
    'roverGaugeStatement', 'roverPresentStatement',
  ])
  b.make('roverOldX', 'VariableDeclaration', { name: 'oldX', type: intType }, { initializer: 'roverOldXInit' }); b.ref('roverOldXInit', 'x')
  b.make('roverOldY', 'VariableDeclaration', { name: 'oldY', type: intType }, { initializer: 'roverOldYInit' }); b.ref('roverOldYInit', 'y')
  // Deux pas par image : le rover peut traverser une plus grande partie de la carte en 24 images.
  b.make('roverMovedFirst', 'VariableDeclaration', { name: 'movedFirst', type: { kind: 'primitive', name: 'boolean' } }, { initializer: 'roverExploreFirstCall' })
  b.call('roverExploreFirstCall', 'roverExploreFirstRef', ['roverFirstCellsArg', 'roverFirstWidthArg', 'roverFirstHeightArg', 'roverFirstAddressX', 'roverFirstAddressY', 'roverFirstAddressBattery', 'roverFirstTargetX', 'roverFirstTargetY'])
  b.make('roverExploreFirstRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverExploreImport' } })
  b.ref('roverFirstCellsArg', 'cells'); b.intValue('roverFirstWidthArg', width); b.intValue('roverFirstHeightArg', height)
  b.ref('roverFirstTargetX', 'artifactX'); b.ref('roverFirstTargetY', 'artifactY')
  b.address('roverFirstAddressX', 'roverFirstXRef'); b.ref('roverFirstXRef', 'x')
  b.address('roverFirstAddressY', 'roverFirstYRef'); b.ref('roverFirstYRef', 'y')
  b.address('roverFirstAddressBattery', 'roverFirstBatteryRef'); b.ref('roverFirstBatteryRef', 'battery')
  b.make('roverMoved', 'VariableDeclaration', { name: 'moved', type: { kind: 'primitive', name: 'boolean' } }, { initializer: 'roverExploreCall' })
  b.call('roverExploreCall', 'roverExploreRef', ['roverCellsArg', 'roverWidthArg', 'roverHeightArg', 'roverAddressX', 'roverAddressY', 'roverAddressBattery', 'roverTargetX', 'roverTargetY'])
  b.make('roverExploreRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverExploreImport' } })
  b.ref('roverCellsArg', 'cells'); b.intValue('roverWidthArg', width); b.intValue('roverHeightArg', height)
  b.ref('roverTargetX', 'artifactX'); b.ref('roverTargetY', 'artifactY')
  b.address('roverAddressX', 'roverXRef'); b.ref('roverXRef', 'x')
  b.address('roverAddressY', 'roverYRef'); b.ref('roverYRef', 'y')
  b.address('roverAddressBattery', 'roverBatteryRef'); b.ref('roverBatteryRef', 'battery')
  // Conserve le premier déplacement même si le second est bloqué.
  b.make('roverMovedMerge', 'IfStatement', {}, { test: 'roverMovedFirstTest', consequent: 'roverMovedMergeBody', alternate: null })
  b.ref('roverMovedFirstTest', 'movedFirst')
  b.block('roverMovedMergeBody', ['roverMovedMergeAssign'])
  b.make('roverMovedMergeAssign', 'AssignmentStatement', {}, { target: 'roverMovedMergeTarget', value: 'roverMovedMergeTrue' })
  b.ref('roverMovedMergeTarget', 'moved'); b.make('roverMovedMergeTrue', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  b.make('roverContinue', 'IfStatement', {}, { test: 'roverNotMoved', consequent: 'roverContinueBody', alternate: null })
  b.make('roverNotMoved', 'UnaryExpression', { operator: 'not' }, { operand: 'roverMovedRef' }); b.ref('roverMovedRef', 'moved')
  b.block('roverContinueBody', ['roverContinueStatement'])
  b.make('roverContinueStatement', 'ContinueStatement')
  b.make('roverOldIndex', 'VariableDeclaration', { name: 'oldIndex', type: intType }, { initializer: 'roverOldIndexValue' })
  b.binary('roverOldIndexValue', '+', 'roverOldRow', 'roverOldXRef'); b.binary('roverOldRow', '*', 'roverOldYRef', 'roverOldWidth'); b.ref('roverOldYRef', 'oldY'); b.intValue('roverOldWidth', width); b.ref('roverOldXRef', 'oldX')
  b.make('roverClearStatement', 'ExpressionStatement', {}, { expression: 'roverClearCall' })
  b.call('roverClearCall', 'roverClearCallee', ['roverOldIndexRef', 'roverClearRed', 'roverClearGreen', 'roverClearBlue', 'roverClearAlpha'])
  b.make('roverClearCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.ref('roverOldIndexRef', 'oldIndex'); b.intValue('roverClearRed', 0); b.intValue('roverClearGreen', 0); b.intValue('roverClearBlue', 0); b.intValue('roverClearAlpha', 0)
  b.make('roverArtifactRestore', 'IfStatement', {}, { test: 'roverOldArtifactTest', consequent: 'roverArtifactRestoreBody', alternate: null })
  b.binary('roverOldArtifactTest', '==', 'roverOldIndexArtifact', 'roverArtifactIndexRestore'); b.ref('roverOldIndexArtifact', 'oldIndex'); b.ref('roverArtifactIndexRestore', 'ARTIFACT_INDEX')
  b.block('roverArtifactRestoreBody', ['roverArtifactRestoreStatement'])
  b.make('roverArtifactRestoreStatement', 'ExpressionStatement', {}, { expression: 'roverArtifactRestoreCall' })
  b.call('roverArtifactRestoreCall', 'roverArtifactRestoreCallee', ['roverArtifactIndexAgain', 'roverArtifactRedAgain', 'roverArtifactGreenAgain', 'roverArtifactBlueAgain', 'roverArtifactAlphaAgain'])
  b.make('roverArtifactRestoreCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.ref('roverArtifactIndexAgain', 'ARTIFACT_INDEX'); b.intValue('roverArtifactRedAgain', 148); b.intValue('roverArtifactGreenAgain', 190); b.intValue('roverArtifactBlueAgain', 255); b.intValue('roverArtifactAlphaAgain', 255)
  b.make('roverDrawStatement', 'ExpressionStatement', {}, { expression: 'roverDrawCall' })
  b.call('roverDrawCall', 'roverDrawCallee', ['roverNewIndex', 'roverDrawRed', 'roverDrawGreen', 'roverDrawBlue', 'roverDrawAlpha'])
  b.make('roverDrawCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPixelImport' } })
  b.binary('roverNewIndex', '+', 'roverNewRow', 'roverXNow'); b.binary('roverNewRow', '*', 'roverYNow', 'roverNewWidth'); b.ref('roverYNow', 'y'); b.intValue('roverNewWidth', width); b.ref('roverXNow', 'x')
  b.intValue('roverDrawRed', 255); b.intValue('roverDrawGreen', 213); b.intValue('roverDrawBlue', 71); b.intValue('roverDrawAlpha', 255)
  b.make('roverFoundIf', 'IfStatement', {}, { test: 'roverArtifactCall', consequent: 'roverFoundBody', alternate: null })
  b.call('roverArtifactCall', 'roverArtifactCallee', ['roverFindCellsArg2', 'roverFindWidthArg2', 'roverFindXArg2', 'roverFindYArg2'])
  b.make('roverArtifactCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverFindImport' } })
  b.ref('roverFindCellsArg2', 'cells'); b.intValue('roverFindWidthArg2', width); b.ref('roverFindXArg2', 'x'); b.ref('roverFindYArg2', 'y')
  b.block('roverFoundBody', ['roverFoundAssign', 'roverLedStatement'])
  b.make('roverFoundAssign', 'AssignmentStatement', {}, { target: 'roverFoundTarget', value: 'roverFoundTrue' }); b.ref('roverFoundTarget', 'found'); b.make('roverFoundTrue', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  b.make('roverLedStatement', 'ExpressionStatement', {}, { expression: 'roverLedCall' })
  b.call('roverLedCall', 'roverLedCallee', ['roverFoundRef2'])
  b.make('roverLedCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverLedImport' } })
  b.ref('roverFoundRef2', 'found')
  b.make('roverGaugeStatement', 'ExpressionStatement', {}, { expression: 'roverGaugeCall' })
  b.call('roverGaugeCall', 'roverGaugeCallee', ['roverBatteryDouble'])
  b.make('roverGaugeCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverBatteryImport' } })
  b.make('roverBatteryDouble', 'CastExpression', { type: doubleType }, { argument: 'roverBatteryDoubleArg' }); b.ref('roverBatteryDoubleArg', 'battery')
  b.make('roverPresentStatement', 'ExpressionStatement', {}, { expression: 'roverPresentCall' })
  b.call('roverPresentCall', 'roverPresentCallee', [])
  b.make('roverPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'roverPresentImport' } })
  b.make('roverFrameLoop', 'ForStatement', {}, { initializer: 'roverFrame', test: 'roverFrameTest', update: 'roverFrameStep', body: 'roverFrameBody' })

  b.print('roverPrint', 'roverMessage'); b.make('roverMessage', 'Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Rover survey' })
  b.print('roverFoundPrint', 'roverFoundRef'); b.ref('roverFoundRef', 'found')
  b.block('roverMainBody', ['roverMarkLoop', 'roverPaintStatement', 'roverArtifactBottom', 'roverArtifactMark', 'roverArtifactPaintStatement', 'roverStartPixelStatement', 'roverFrameLoop', 'roverPrint', 'roverFoundPrint'])

  const app = b.project.modules.find((module) => module.id === 'roverApp')
  app.imports.push(
    { id: 'roverPixelImport', moduleId: 'roverScreen', nodeId: setPixel.nodeId, localName: 'setPixel' },
    { id: 'roverPresentImport', moduleId: 'roverScreen', nodeId: present.nodeId, localName: 'present' },
    { id: 'roverBatteryImport', moduleId: 'roverGauge', nodeId: setBattery.nodeId, localName: 'setBattery' },
    { id: 'roverLedImport', moduleId: 'roverLed', nodeId: setFound.nodeId, localName: 'setFound' },
    { id: 'roverExploreImport', moduleId: 'roverDrive', nodeId: 'roverExplore', localName: 'explore' },
    { id: 'roverFindImport', moduleId: 'roverMap', nodeId: 'roverIsArtifact', localName: 'isArtifact' },
    { id: 'roverEachImport', moduleId: 'roverSurvey', nodeId: 'roverEach', localName: 'forEachIndex' },
  )
  b.project.modules.find((module) => module.id === 'roverDrive').exports.push({ nodeId: 'roverExplore', name: 'explore' })
  b.project.modules.find((module) => module.id === 'roverMap').exports.push({ nodeId: 'roverTileAt', name: 'tileAt' }, { nodeId: 'roverIsArtifact', name: 'isArtifact' })
  b.project.modules.find((module) => module.id === 'roverSurvey').exports.push({ nodeId: 'roverEach', name: 'forEachIndex' })
  b.project.nodes.find((node) => node.id === 'roverBattery').contracts = [{ kind: 'between', arguments: [0, 100] }]
  b.project.nodes.find((node) => node.id === 'roverRockIndices').contracts = [{ kind: 'minLength', arguments: [20] }]

  const result = workspace(b.project, [
    note('roverScreenNote', 'Rover map', 'Écran 48×18 : la carte est peinte une fois (rochers et artefact), puis le rover avance de deux cases par image. La position de l’artefact est tirée au hasard, en haut ou en bas de la carte, à chaque exécution et à chaque boucle de lecture ; la batterie alimente la jauge et la LED s’allume quand l’artefact est atteint.', 0, 900, 620, 240),
    note('roverMapNote', 'Map data', 'Le module Map propose un alias `Tile`, la constante `ARTIFACT` et `tileAt` / `isArtifact`. Les rochers sont marqués par une boucle **For**, puis peints par **ForEach** via une variable de type fonction.', 660, 900, 620, 240),
    note('roverDriveNote', 'Drive', '`explore` reçoit trois pointeurs (`&x`, `&y`, `&battery`), essaie jusqu’à quatre directions avec une boucle **While** et sort par **Break** au premier pas libre ; la batterie diminue à chaque déplacement.', 1320, 900, 620, 240),
  ])
  const cards = result.presentation.cards
  const byId = (id) => cards.find((card) => card.id === id)
  Object.assign(byId('roverScreen'), { x: 0, y: 0, width: 760, height: 360 })
  Object.assign(byId('roverGauge'), { x: 820, y: 0 })
  Object.assign(byId('roverLed'), { x: 1240, y: 0 })
  Object.assign(byId('roverMap'), { x: 0, y: 420 })
  Object.assign(byId('roverDrive'), { x: 560, y: 420 })
  Object.assign(byId('roverSurvey'), { x: 1120, y: 420 })
  Object.assign(byId('roverApp'), { x: 1680, y: 420 })
  return result
}

// Laboratoire de signaux : échantillons, statistiques, texte, jauge et LED d'alerte.
function signalLab() {
  const b = builder()
  const width = 48
  const height = 18
  const frames = 48
  const stringType = { kind: 'primitive', name: 'string' }
  const charType = { kind: 'primitive', name: 'char' }
  const booleanType = { kind: 'primitive', name: 'boolean' }
  const stringArrayType = { kind: 'array', elementType: stringType }
  const doubleMapper = { kind: 'function', parameters: [intType], returnType: doubleType }
  const intEffect = { kind: 'function', parameters: [intType], returnType: voidType }
  const screen = createScreenModule('signalScreen', 'Waveform', 1, { width, height })
  const gauge = createGaugeModule('signalGauge', 'Quality', 1, { min: 0, max: 100 })
  const led = createLedModule('signalLed', 'Alarm', 1, { value: false })
  b.project.modules.push(screen.module, gauge.module, led.module)
  b.project.nodes.push(...screen.nodes, ...gauge.nodes, ...led.nodes)

  const setPixel = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_SET_PIXEL_1')
  const present = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  const setQuality = gauge.module.exports.find((entry) => entry.name === 'GAUGE_SP3_SET_VALUE_1')
  const setAlarm = led.module.exports.find((entry) => entry.name === 'LED_SP3_SET_VALUE_1')

  // Données : alias de type et lectures/retours de tableaux.
  b.useModule('signalData', 'Signal data')
  b.root('signalReadingType', 'TypeDeclaration', { name: 'Reading', type: intType })
  b.root('signalSampleAt', 'FunctionDeclaration', { name: 'sampleAt', type: intType }, { parameters: ['signalValues', 'signalIndex'], body: 'signalSampleBody' })
  b.make('signalValues', 'Parameter', { name: 'values', type: intArrayType })
  b.make('signalIndex', 'Parameter', { name: 'index', type: intType })
  b.block('signalSampleBody', ['signalSampleRead', 'signalSampleReturn'])
  b.make('signalSampleRead', 'VariableDeclaration', { name: 'reading', type: { kind: 'named', target: { kind: 'name', name: 'Reading' } } }, { initializer: 'signalSampleAccess' })
  b.access('signalSampleAccess', 'signalSampleArray', 'signalSampleIndex'); b.ref('signalSampleArray', 'values'); b.ref('signalSampleIndex', 'index')
  b.returnValue('signalSampleReturn', 'signalSampleRef'); b.ref('signalSampleRef', 'reading')

  // Statistiques : While/Continue/Break, For, fonction de type, pointeur et natives mathématiques.
  b.useModule('signalStats', 'Signal stats')
  b.root('signalAverage', 'FunctionDeclaration', { name: 'average', type: intType }, { parameters: ['averageValues'], body: 'signalAverageBody' })
  b.make('averageValues', 'Parameter', { name: 'values', type: intArrayType })
  b.block('signalAverageBody', ['averageIndex', 'averageTotal', 'averageCount', 'averageLoop', 'averageEmpty', 'averageReturn'])
  b.make('averageIndex', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'averageIndexStart' }); b.intValue('averageIndexStart', 0)
  b.make('averageTotal', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'averageTotalStart' }); b.intValue('averageTotalStart', 0)
  b.make('averageCount', 'VariableDeclaration', { name: 'count', type: intType }, { initializer: 'averageCountStart' }); b.intValue('averageCountStart', 0)
  b.make('averageLoop', 'WhileStatement', {}, { test: 'averageTest', body: 'averageLoopBody' })
  b.binary('averageTest', '<', 'averageIndexRead', 'averageLength'); b.ref('averageIndexRead', 'i'); b.make('averageLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['averageArray'] }); b.ref('averageArray', 'values')
  b.block('averageLoopBody', ['averageSentinel', 'averageAdd', 'averageCountStep', 'averageLimit', 'averageStep'])
  b.make('averageSentinel', 'IfStatement', {}, { test: 'averageIsSentinel', consequent: 'averageSentinelBody', alternate: null })
  b.binary('averageIsSentinel', '==', 'averageValue', 'averageNegOne'); b.access('averageValue', 'averageValueArray', 'averageValueIndex'); b.ref('averageValueArray', 'values'); b.ref('averageValueIndex', 'i'); b.intValue('averageNegOne', -1)
  b.block('averageSentinelBody', ['averageSentinelStep', 'averageContinue'])
  b.make('averageSentinelStep', 'AssignmentStatement', {}, { target: 'averageIndexSentinelTarget', value: 'averageIndexSentinelNext' }); b.ref('averageIndexSentinelTarget', 'i'); b.binary('averageIndexSentinelNext', '+', 'averageIndexSentinelRead', 'averageOneSentinel'); b.ref('averageIndexSentinelRead', 'i'); b.intValue('averageOneSentinel', 1)
  b.make('averageContinue', 'ContinueStatement')
  b.make('averageAdd', 'AssignmentStatement', {}, { target: 'averageTotalTarget', value: 'averageTotalNext' }); b.ref('averageTotalTarget', 'total'); b.binary('averageTotalNext', '+', 'averageTotalRead', 'averageValueAdd'); b.ref('averageTotalRead', 'total'); b.access('averageValueAdd', 'averageValueAddArray', 'averageValueAddIndex'); b.ref('averageValueAddArray', 'values'); b.ref('averageValueAddIndex', 'i')
  b.make('averageCountStep', 'AssignmentStatement', {}, { target: 'averageCountTarget', value: 'averageCountNext' }); b.ref('averageCountTarget', 'count'); b.binary('averageCountNext', '+', 'averageCountRead', 'averageOneCount'); b.ref('averageCountRead', 'count'); b.intValue('averageOneCount', 1)
  b.make('averageLimit', 'IfStatement', {}, { test: 'averageCountReached', consequent: 'averageLimitBody', alternate: null })
  b.binary('averageCountReached', '>=', 'averageCountReadLimit', 'averageLimitEight'); b.ref('averageCountReadLimit', 'count'); b.intValue('averageLimitEight', 8)
  b.block('averageLimitBody', ['averageBreak'])
  b.make('averageBreak', 'BreakStatement')
  b.make('averageStep', 'AssignmentStatement', {}, { target: 'averageIndexTarget', value: 'averageIndexNext' }); b.ref('averageIndexTarget', 'i'); b.binary('averageIndexNext', '+', 'averageIndexStepRead', 'averageOneStep'); b.ref('averageIndexStepRead', 'i'); b.intValue('averageOneStep', 1)
  b.make('averageEmpty', 'IfStatement', {}, { test: 'averageEmptyTest', consequent: 'averageEmptyBody', alternate: null })
  b.binary('averageEmptyTest', '==', 'averageCountEmpty', 'averageZeroEmpty'); b.ref('averageCountEmpty', 'count'); b.intValue('averageZeroEmpty', 0)
  b.block('averageEmptyBody', ['averageEmptyReturn'])
  b.returnValue('averageEmptyReturn', 'averageZeroValue'); b.intValue('averageZeroValue', 0)
  b.returnValue('averageReturn', 'averageQuotient'); b.binary('averageQuotient', '/', 'averageTotalFinal', 'averageCountFinal'); b.ref('averageTotalFinal', 'total'); b.ref('averageCountFinal', 'count')

  b.root('signalWeight', 'FunctionDeclaration', { name: 'weight', type: doubleType }, { parameters: ['weightValue'], body: 'signalWeightBody' })
  b.make('weightValue', 'Parameter', { name: 'value', type: intType })
  b.block('signalWeightBody', ['weightReturn'])
  b.returnValue('weightReturn', 'weightRounded')
  b.make('weightRounded', 'MathCall', { name: 'round' }, { arguments: ['weightRoot'] })
  b.make('weightRoot', 'MathCall', { name: 'sqrt' }, { arguments: ['weightCast'] })
  b.make('weightCast', 'CastExpression', { type: doubleType }, { argument: 'weightRef' }); b.ref('weightRef', 'value')

  b.root('signalScore', 'FunctionDeclaration', { name: 'score', type: intType }, { parameters: ['scoreValues', 'scoreMetric'], body: 'signalScoreBody' })
  b.make('scoreValues', 'Parameter', { name: 'values', type: intArrayType })
  b.make('scoreMetric', 'Parameter', { name: 'metric', type: doubleMapper })
  b.block('signalScoreBody', ['scoreTotal', 'scoreLoop', 'scoreReturn'])
  b.make('scoreIndex', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'scoreIndexStart' }); b.intValue('scoreIndexStart', 0)
  b.make('scoreTotal', 'VariableDeclaration', { name: 'total', type: doubleType }, { initializer: 'scoreTotalStart' }); b.make('scoreTotalStart', 'Literal', { type: doubleType, value: '0.0' })
  b.make('scoreLoop', 'ForStatement', {}, { initializer: 'scoreIndex', test: 'scoreTest', update: 'scoreStep', body: 'scoreLoopBody' })
  b.binary('scoreTest', '<', 'scoreIndexRead', 'scoreLength'); b.ref('scoreIndexRead', 'i'); b.make('scoreLength', 'MathCall', { name: 'arrayLength' }, { arguments: ['scoreArray'] }); b.ref('scoreArray', 'values')
  b.make('scoreStep', 'AssignmentStatement', {}, { target: 'scoreIndexTarget', value: 'scoreIndexNext' }); b.ref('scoreIndexTarget', 'i'); b.binary('scoreIndexNext', '+', 'scoreIndexNextRead', 'scoreOne'); b.ref('scoreIndexNextRead', 'i'); b.intValue('scoreOne', 1)
  b.block('scoreLoopBody', ['scoreAdd'])
  b.make('scoreAdd', 'AssignmentStatement', {}, { target: 'scoreTotalTarget', value: 'scoreTotalNext' })
  b.ref('scoreTotalTarget', 'total')
  b.binary('scoreTotalNext', '+', 'scoreTotalRead', 'scoreMetricCall'); b.ref('scoreTotalRead', 'total')
  b.call('scoreMetricCall', 'scoreMetricRef', ['scoreValueArg']); b.ref('scoreMetricRef', 'metric'); b.access('scoreValueArg', 'scoreValueArray', 'scoreValueIndex'); b.ref('scoreValueArray', 'values'); b.ref('scoreValueIndex', 'i')
  b.returnValue('scoreReturn', 'scoreClamped')
  b.make('scoreClamped', 'MathCall', { name: 'clamp' }, { arguments: ['scoreAverage', 'scoreZero', 'scoreHundred'] })
  b.make('scoreAverage', 'CastExpression', { type: intType }, { argument: 'scoreAverageRound' })
  b.make('scoreAverageRound', 'MathCall', { name: 'round' }, { arguments: ['scoreAverageValue'] })
  b.binary('scoreAverageValue', '/', 'scoreTotalLast', 'scoreLengthDouble'); b.ref('scoreTotalLast', 'total'); b.make('scoreLengthDouble', 'CastExpression', { type: doubleType }, { argument: 'scoreLengthCastArg' }); b.make('scoreLengthCastArg', 'MathCall', { name: 'arrayLength' }, { arguments: ['scoreLengthCastArray'] }); b.ref('scoreLengthCastArray', 'values')
  b.intValue('scoreZero', 0); b.intValue('scoreHundred', 100)

  b.root('signalSmooth', 'FunctionDeclaration', { name: 'smooth', type: voidType }, { parameters: ['smoothValue', 'smoothTarget'], body: 'signalSmoothBody' })
  b.make('smoothValue', 'Parameter', { name: 'value', type: intPointerType })
  b.make('smoothTarget', 'Parameter', { name: 'target', type: intType })
  b.block('signalSmoothBody', ['smoothAssign'])
  b.make('smoothAssign', 'AssignmentStatement', {}, { target: 'smoothTargetRef', value: 'smoothClamp' })
  b.deref('smoothTargetRef', 'smoothTargetParam'); b.ref('smoothTargetParam', 'value')
  b.make('smoothClamp', 'MathCall', { name: 'clamp' }, { arguments: ['smoothNext', 'smoothZero', 'smoothHundred'] })
  b.binary('smoothNext', '+', 'smoothRead', 'smoothStep'); b.deref('smoothRead', 'smoothReadRef'); b.ref('smoothReadRef', 'value')
  b.binary('smoothStep', '*', 'smoothSign', 'smoothFour'); b.make('smoothSign', 'MathCall', { name: 'sign' }, { arguments: ['smoothDelta'] }); b.binary('smoothDelta', '-', 'smoothTargetRead', 'smoothValueRead'); b.ref('smoothTargetRead', 'target'); b.deref('smoothValueRead', 'smoothValueReadRef'); b.ref('smoothValueReadRef', 'value')
  b.intValue('smoothFour', 4); b.intValue('smoothZero', 0); b.intValue('smoothHundred', 100)

  b.root('signalEach', 'FunctionDeclaration', { name: 'forEachSample', type: voidType }, { parameters: ['eachValues', 'eachVisit'], body: 'signalEachBody' })
  b.make('eachValues', 'Parameter', { name: 'values', type: intArrayType })
  b.make('eachVisit', 'Parameter', { name: 'visit', type: intEffect })
  b.block('signalEachBody', ['eachStatement'])
  b.make('eachStatement', 'ForEachStatement', {}, { array: 'eachArrayRef', callback: 'eachVisitRef' }); b.ref('eachArrayRef', 'values'); b.ref('eachVisitRef', 'visit')

  // Texte : découpage, assemblage, extraction et recherche.
  b.useModule('signalText', 'Signal text')
  b.root('signalTextType', 'TypeDeclaration', { name: 'Text', type: stringType })
  b.root('signalTags', 'ConstantDeclaration', { name: 'TAGS', type: stringType }, { initializer: 'signalTagsValue' })
  b.make('signalTagsValue', 'Literal', { type: stringType, value: 'calm|warm|hot' })
  b.root('signalDescribe', 'FunctionDeclaration', { name: 'describe', type: { kind: 'named', target: { kind: 'name', name: 'Text' } } }, { parameters: ['describeValue'], body: 'signalDescribeBody' })
  b.make('describeValue', 'Parameter', { name: 'value', type: intType })
  b.block('signalDescribeBody', ['describeParts', 'describeIndex', 'describeWord', 'describePrefix', 'describeRest', 'describePieces', 'describeReturn'])
  b.make('describeParts', 'VariableDeclaration', { name: 'parts', type: stringArrayType }, { initializer: 'describeSplit' })
  b.make('describeSplit', 'MathCall', { name: 'stringSplit' }, { arguments: ['describeTagsRef', 'describeSeparator'] }); b.ref('describeTagsRef', 'TAGS'); b.make('describeSeparator', 'Literal', { type: charType, value: '|' })
  b.make('describeIndex', 'VariableDeclaration', { name: 'index', type: intType }, { initializer: 'describeIndexCall' })
  b.make('describeIndexCall', 'MathCall', { name: 'clamp' }, { arguments: ['describeIndexQuotient', 'describeZero', 'describeLast'] })
  b.binary('describeIndexQuotient', '/', 'describeValueRef', 'describeThirtyFour'); b.ref('describeValueRef', 'value'); b.intValue('describeThirtyFour', 34)
  b.intValue('describeZero', 0); b.binary('describeLast', '-', 'describeLengthCall', 'describeOne'); b.make('describeLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['describePartsRef'] }); b.ref('describePartsRef', 'parts'); b.intValue('describeOne', 1)
  b.make('describeWord', 'VariableDeclaration', { name: 'word', type: { kind: 'named', target: { kind: 'name', name: 'Text' } } }, { initializer: 'describeWordAccess' })
  b.access('describeWordAccess', 'describeWordArray', 'describeIndexRef'); b.ref('describeWordArray', 'parts'); b.ref('describeIndexRef', 'index')
  b.make('describePrefix', 'VariableDeclaration', { name: 'prefix', type: { kind: 'named', target: { kind: 'name', name: 'Text' } } }, { initializer: 'describePrefixCall' })
  b.make('describePrefixCall', 'MathCall', { name: 'substring' }, { arguments: ['describeWordRef', 'describePrefixStart', 'describePrefixEnd'] }); b.ref('describeWordRef', 'word'); b.intValue('describePrefixStart', 0); b.intValue('describePrefixEnd', 1)
  b.make('describeRest', 'VariableDeclaration', { name: 'rest', type: { kind: 'named', target: { kind: 'name', name: 'Text' } } }, { initializer: 'describeRestCall' })
  b.make('describeRestCall', 'MathCall', { name: 'substring' }, { arguments: ['describeWordRestRef', 'describeRestStart', 'describeRestEnd'] }); b.ref('describeWordRestRef', 'word'); b.intValue('describeRestStart', 1); b.make('describeRestEnd', 'MathCall', { name: 'length' }, { arguments: ['describeWordLengthRef'] }); b.ref('describeWordLengthRef', 'word')
  b.make('describePieces', 'VariableDeclaration', { name: 'pieces', type: stringArrayType }, { initializer: 'describePiecesList' })
  b.make('describePiecesList', 'ArrayLiteral', { elementType: stringType }, { elements: ['describePiecePrefix', 'describePieceRest'] })
  b.ref('describePiecePrefix', 'prefix'); b.ref('describePieceRest', 'rest')
  b.returnValue('describeReturn', 'describeJoin')
  b.make('describeJoin', 'MathCall', { name: 'stringJoin' }, { arguments: ['describePiecesRef', 'describeJoiner'] }); b.ref('describePiecesRef', 'pieces'); b.make('describeJoiner', 'Literal', { type: stringType, value: '' })

  b.root('signalTagFor', 'FunctionDeclaration', { name: 'tagFor', type: stringType }, { parameters: ['tagValue'], body: 'signalTagBody' })
  b.make('tagValue', 'Parameter', { name: 'value', type: intType })
  b.block('signalTagBody', ['tagHigh'])
  b.make('tagHigh', 'IfStatement', {}, { test: 'tagHighTest', consequent: 'tagHighBody', alternate: 'tagMidBlock' })
  b.binary('tagHighTest', '>=', 'tagHighRead', 'tagHighLimit'); b.ref('tagHighRead', 'value'); b.intValue('tagHighLimit', 70)
  b.block('tagHighBody', ['tagStableReturn'])
  b.returnValue('tagStableReturn', 'tagStableValue'); b.make('tagStableValue', 'Literal', { type: stringType, value: 'STABLE' })
  b.make('tagMid', 'IfStatement', {}, { test: 'tagMidTest', consequent: 'tagMidBody', alternate: 'tagLowBody' })
  b.make('tagMidBlock', 'Block', {}, { statements: ['tagMid'] })
  b.binary('tagMidTest', '>=', 'tagMidRead', 'tagMidLimit'); b.ref('tagMidRead', 'value'); b.intValue('tagMidLimit', 40)
  b.block('tagMidBody', ['tagVolatileReturn'])
  b.returnValue('tagVolatileReturn', 'tagVolatileValue'); b.make('tagVolatileValue', 'Literal', { type: stringType, value: 'VOLATILE' })
  b.block('tagLowBody', ['tagCriticalReturn'])
  b.returnValue('tagCriticalReturn', 'tagCriticalValue'); b.make('tagCriticalValue', 'Literal', { type: stringType, value: 'CRITICAL' })

  // Application : collecte ForEach, boucle For, écran, jauge et LED.
  b.useModule('signalApp', 'Signal console')
  b.root('signalSamplesData', 'VariableDeclaration', { name: 'samples', type: intArrayType }, { initializer: 'signalSamplesCreate' })
  b.make('signalSamplesCreate', 'ArrayCreation', { elementType: intType }, { size: 'signalSamplesSize', initializer: 'signalSamplesZero' })
  b.intValue('signalSamplesSize', 16); b.intValue('signalSamplesZero', 0)
  b.root('signalCode', 'ConstantDeclaration', { name: 'CODE', type: stringType }, { initializer: 'signalCodeValue' }); b.make('signalCodeValue', 'Literal', { type: stringType, value: 'warm|hot' })
  b.root('signalSum', 'VariableDeclaration', { name: 'sum', type: intType }, { initializer: 'signalSumStart' }); b.intValue('signalSumStart', 0)
  b.root('signalQuality', 'VariableDeclaration', { name: 'quality', type: intType }, { initializer: 'signalQualityStart' }); b.intValue('signalQualityStart', 50)
  b.root('signalAlarmData', 'VariableDeclaration', { name: 'alarm', type: booleanType }, { initializer: 'signalAlarmStart' }); b.make('signalAlarmStart', 'Literal', { type: booleanType, value: false })
  b.root('signalMetric', 'ConstantDeclaration', { name: 'metric', type: doubleMapper }, { initializer: 'signalMetricRef' }); b.make('signalMetricRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalWeightImport' } })

  b.root('signalCollect', 'FunctionDeclaration', { name: 'collect', type: voidType }, { parameters: ['collectValue'], body: 'signalCollectBody' })
  b.make('collectValue', 'Parameter', { name: 'value', type: intType })
  b.block('signalCollectBody', ['collectAssign'])
  b.make('collectAssign', 'AssignmentStatement', {}, { target: 'collectTarget', value: 'collectNext' }); b.ref('collectTarget', 'sum'); b.binary('collectNext', '+', 'collectSumRead', 'collectValueRef'); b.ref('collectSumRead', 'sum'); b.ref('collectValueRef', 'value')

  b.root('signalMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'signalMainBody' })
  b.make('signalFillIndex', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'signalFillStart' }); b.intValue('signalFillStart', 0)
  b.binary('signalFillTest', '<', 'signalFillRead', 'signalFillEnd'); b.ref('signalFillRead', 'i'); b.intValue('signalFillEnd', 16)
  b.make('signalFillStep', 'AssignmentStatement', {}, { target: 'signalFillTarget', value: 'signalFillNext' }); b.ref('signalFillTarget', 'i'); b.binary('signalFillNext', '+', 'signalFillNextRead', 'signalFillOne'); b.ref('signalFillNextRead', 'i'); b.intValue('signalFillOne', 1)
  b.block('signalFillBody', ['signalFillAssign'])
  b.make('signalFillAssign', 'AssignmentStatement', {}, { target: 'signalFillElement', value: 'signalFillValue' })
  b.access('signalFillElement', 'signalFillArray', 'signalFillIndexRef'); b.ref('signalFillArray', 'samples'); b.ref('signalFillIndexRef', 'i')
  b.make('signalFillValue', 'MathCall', { name: 'randomInt' }, { arguments: ['signalFillMin', 'signalFillMax'] }); b.intValue('signalFillMin', 20); b.intValue('signalFillMax', 90)
  b.make('signalFillLoop', 'ForStatement', {}, { initializer: 'signalFillIndex', test: 'signalFillTest', update: 'signalFillStep', body: 'signalFillBody' })
  b.make('signalZeroSet', 'AssignmentStatement', {}, { target: 'signalZeroElement', value: 'signalFortyTwo' })
  b.access('signalZeroElement', 'signalZeroArray', 'signalZeroIndex'); b.ref('signalZeroArray', 'samples'); b.intValue('signalZeroIndex', 0); b.intValue('signalFortyTwo', 42)

  b.make('signalCollectStatement', 'ExpressionStatement', {}, { expression: 'signalCollectCall' })
  b.call('signalCollectCall', 'signalCollectCallee', ['signalSamplesArg', 'signalCollectRef'])
  b.make('signalCollectCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalEachImport' } }); b.ref('signalSamplesArg', 'samples'); b.ref('signalCollectRef', 'collect')
  b.make('signalQualityAssign', 'AssignmentStatement', {}, { target: 'signalQualityTarget', value: 'signalQualityAverage' })
  b.ref('signalQualityTarget', 'quality')
  b.make('signalQualityAverage', 'MathCall', { name: 'clamp' }, { arguments: ['signalQualityQuotient', 'signalQualityZero', 'signalQualityHundred'] })
  b.binary('signalQualityQuotient', '/', 'signalSumRead', 'signalSixteen'); b.ref('signalSumRead', 'sum'); b.intValue('signalSixteen', 16)
  b.intValue('signalQualityZero', 0); b.intValue('signalQualityHundred', 100)

  b.make('signalDescribePrint', 'PrintStatement', {}, { value: 'signalDescribeCall' })
  b.call('signalDescribeCall', 'signalDescribeRef', ['signalDescribeArg']); b.make('signalDescribeRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalDescribeImport' } }); b.intValue('signalDescribeArg', 70)
  b.make('signalTagPrint', 'PrintStatement', {}, { value: 'signalTagCall' })
  b.call('signalTagCall', 'signalTagRef', ['signalTagArg']); b.make('signalTagRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalTagImport' } }); b.intValue('signalTagArg', 70)
  b.make('signalCharPrint', 'PrintStatement', {}, { value: 'signalCharCall' })
  b.make('signalCharCall', 'MathCall', { name: 'charAt' }, { arguments: ['signalCodeRef', 'signalCharIndex'] }); b.ref('signalCodeRef', 'CODE'); b.intValue('signalCharIndex', 0)
  b.make('signalContainsPrint', 'PrintStatement', {}, { value: 'signalContainsCall' })
  b.make('signalContainsCall', 'MathCall', { name: 'contains' }, { arguments: ['signalCodeContainsRef', 'signalContainsSearch'] }); b.ref('signalCodeContainsRef', 'CODE'); b.make('signalContainsSearch', 'Literal', { type: stringType, value: 'hot' })
  b.make('signalSearchPrint', 'PrintStatement', {}, { value: 'signalSearchCall' })
  b.make('signalSearchCall', 'MathCall', { name: 'stringIndexOf' }, { arguments: ['signalCodeSearchRef', 'signalSearchPart'] }); b.ref('signalCodeSearchRef', 'CODE'); b.make('signalSearchPart', 'Literal', { type: stringType, value: 'hot' })
  b.make('signalLengthPrint', 'PrintStatement', {}, { value: 'signalLengthCall' })
  b.make('signalLengthCall', 'MathCall', { name: 'length' }, { arguments: ['signalCodeLengthRef'] }); b.ref('signalCodeLengthRef', 'CODE')

  b.make('signalReverseVar', 'VariableDeclaration', { name: 'reversed', type: intArrayType }, { initializer: 'signalReverseInit' })
  b.make('signalReverseInit', 'MathCall', { name: 'arrayReverse' }, { arguments: ['signalReverseSamples'] }); b.ref('signalReverseSamples', 'samples')
  b.make('signalSliceVar', 'VariableDeclaration', { name: 'part', type: intArrayType }, { initializer: 'signalSliceCall' })
  b.make('signalSliceCall', 'MathCall', { name: 'arraySlice' }, { arguments: ['signalSliceSamples', 'signalSliceStart', 'signalSliceEnd'] }); b.ref('signalSliceSamples', 'samples'); b.intValue('signalSliceStart', 1); b.intValue('signalSliceEnd', 4)
  b.make('signalConcatVar', 'VariableDeclaration', { name: 'both', type: intArrayType }, { initializer: 'signalConcatCall' })
  b.make('signalConcatCall', 'MathCall', { name: 'arrayConcat' }, { arguments: ['signalConcatPart', 'signalConcatReversed'] }); b.ref('signalConcatPart', 'part'); b.ref('signalConcatReversed', 'reversed')
  b.make('signalReverseLengthPrint', 'PrintStatement', {}, { value: 'signalReverseLengthCall' })
  b.make('signalReverseLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['signalReverseLengthArg'] }); b.ref('signalReverseLengthArg', 'reversed')
  b.make('signalSliceLengthPrint', 'PrintStatement', {}, { value: 'signalSliceLengthCall' })
  b.make('signalSliceLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['signalSliceLengthArg'] }); b.ref('signalSliceLengthArg', 'part')
  b.make('signalConcatLengthPrint', 'PrintStatement', {}, { value: 'signalConcatLengthCall' })
  b.make('signalConcatLengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['signalConcatLengthArg'] }); b.ref('signalConcatLengthArg', 'both')
  b.make('signalContainsArrayPrint', 'PrintStatement', {}, { value: 'signalArrayContainsCall' })
  b.make('signalArrayContainsCall', 'MathCall', { name: 'arrayContains' }, { arguments: ['signalArrayContainsRef', 'signalArraySearch'] }); b.ref('signalArrayContainsRef', 'samples'); b.intValue('signalArraySearch', 42)
  b.make('signalIndexArrayPrint', 'PrintStatement', {}, { value: 'signalArrayIndexCall' })
  b.make('signalArrayIndexCall', 'MathCall', { name: 'arrayIndexOf' }, { arguments: ['signalArrayIndexRef', 'signalArrayIndexSearch'] }); b.ref('signalArrayIndexRef', 'samples'); b.intValue('signalArrayIndexSearch', 42)

  // Axes statiques puis un point par image.
  for (let y = 0; y < height; y += 1) {
    const id = `signalAxisY${y}`
    b.make(`${id}Statement`, 'ExpressionStatement', {}, { expression: `${id}Call` })
    b.call(`${id}Call`, `${id}Callee`, [`${id}Index`, `${id}Red`, `${id}Green`, `${id}Blue`, `${id}Alpha`])
    b.make(`${id}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalPixelImport' } })
    b.intValue(`${id}Index`, y * width); b.intValue(`${id}Red`, 40); b.intValue(`${id}Green`, 46); b.intValue(`${id}Blue`, 64); b.intValue(`${id}Alpha`, 255)
  }
  for (let x = 0; x < width; x += 1) {
    const id = `signalAxisX${x}`
    b.make(`${id}Statement`, 'ExpressionStatement', {}, { expression: `${id}Call` })
    b.call(`${id}Call`, `${id}Callee`, [`${id}Index`, `${id}Red`, `${id}Green`, `${id}Blue`, `${id}Alpha`])
    b.make(`${id}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalPixelImport' } })
    b.intValue(`${id}Index`, (height - 1) * width + x); b.intValue(`${id}Red`, 40); b.intValue(`${id}Green`, 46); b.intValue(`${id}Blue`, 64); b.intValue(`${id}Alpha`, 255)
  }
  const axisStatements = []
  for (let y = 0; y < height; y += 1) axisStatements.push(`signalAxisY${y}Statement`)
  for (let x = 0; x < width; x += 1) axisStatements.push(`signalAxisX${x}Statement`)

  b.make('signalFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'signalFrameStart' }); b.intValue('signalFrameStart', 0)
  b.binary('signalFrameTest', '<', 'signalFrameRead', 'signalFrameEnd'); b.ref('signalFrameRead', 'frame'); b.intValue('signalFrameEnd', frames)
  b.make('signalFrameStep', 'AssignmentStatement', {}, { target: 'signalFrameTarget', value: 'signalFrameNext' }); b.ref('signalFrameTarget', 'frame'); b.binary('signalFrameNext', '+', 'signalFrameNextRead', 'signalFrameOne'); b.ref('signalFrameNextRead', 'frame'); b.intValue('signalFrameOne', 1)
  b.block('signalFrameBody', ['signalIndexVar', 'signalValueVar', 'signalYVar', 'signalPixelStatement', 'signalSmoothStatement', 'signalAlarmAssign', 'signalLedStatement', 'signalGaugeStatement', 'signalPresentStatement'])
  b.make('signalIndexVar', 'VariableDeclaration', { name: 'index', type: intType }, { initializer: 'signalIndexModulo' })
  b.binary('signalIndexModulo', '%', 'signalFrameModRead', 'signalFrameMod'); b.ref('signalFrameModRead', 'frame'); b.intValue('signalFrameMod', 16)
  b.make('signalValueVar', 'VariableDeclaration', { name: 'value', type: intType }, { initializer: 'signalValueCall' })
  b.call('signalValueCall', 'signalValueRef', ['signalValueSamples', 'signalIndexRef']); b.make('signalValueRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalSampleImport' } }); b.ref('signalValueSamples', 'samples'); b.ref('signalIndexRef', 'index')
  b.make('signalYVar', 'VariableDeclaration', { name: 'y', type: intType }, { initializer: 'signalYClamp' })
  b.make('signalYClamp', 'MathCall', { name: 'clamp' }, { arguments: ['signalYRaw', 'signalYMin', 'signalYMax'] })
  b.binary('signalYRaw', '-', 'signalYBase', 'signalYOffset'); b.intValue('signalYBase', 16); b.binary('signalYOffset', '/', 'signalValueY', 'signalYTens'); b.ref('signalValueY', 'value'); b.intValue('signalYTens', 10)
  b.intValue('signalYMin', 1); b.intValue('signalYMax', height - 1)
  b.make('signalPixelStatement', 'ExpressionStatement', {}, { expression: 'signalPixelCall' })
  b.call('signalPixelCall', 'signalPixelCallee', ['signalPixelIndex', 'signalPixelRed', 'signalPixelGreen', 'signalPixelBlue', 'signalPixelAlpha'])
  b.make('signalPixelCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalPixelImport' } })
  b.binary('signalPixelIndex', '+', 'signalPixelRow', 'signalPixelColumn'); b.binary('signalPixelRow', '*', 'signalPixelY', 'signalPixelWidth'); b.ref('signalPixelY', 'y'); b.intValue('signalPixelWidth', width); b.ref('signalPixelColumn', 'frame')
  b.intValue('signalPixelRed', 148); b.intValue('signalPixelGreen', 190); b.intValue('signalPixelBlue', 255); b.intValue('signalPixelAlpha', 255)
  b.make('signalSmoothStatement', 'ExpressionStatement', {}, { expression: 'signalSmoothCall' })
  b.call('signalSmoothCall', 'signalSmoothCallee', ['signalSmoothAddress', 'signalSmoothTargetValue']); b.make('signalSmoothCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalSmoothImport' } }); b.address('signalSmoothAddress', 'signalQualityRef'); b.ref('signalQualityRef', 'quality'); b.ref('signalSmoothTargetValue', 'value')
  b.make('signalAlarmAssign', 'AssignmentStatement', {}, { target: 'signalAlarmTarget', value: 'signalAlarmNot' }); b.ref('signalAlarmTarget', 'alarm')
  b.make('signalAlarmNot', 'UnaryExpression', { operator: 'not' }, { operand: 'signalAlarmTest' }); b.binary('signalAlarmTest', '>=', 'signalQualityAlarmRead', 'signalAlarmLimit'); b.ref('signalQualityAlarmRead', 'quality'); b.intValue('signalAlarmLimit', 50)
  b.make('signalLedStatement', 'ExpressionStatement', {}, { expression: 'signalLedCall' }); b.call('signalLedCall', 'signalLedCallee', ['signalAlarmRef']); b.make('signalLedCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalAlarmImport' } }); b.ref('signalAlarmRef', 'alarm')
  b.make('signalGaugeStatement', 'ExpressionStatement', {}, { expression: 'signalGaugeCall' }); b.call('signalGaugeCall', 'signalGaugeCallee', ['signalQualityDouble']); b.make('signalGaugeCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalQualityImport' } }); b.make('signalQualityDouble', 'CastExpression', { type: doubleType }, { argument: 'signalQualityDoubleArg' }); b.ref('signalQualityDoubleArg', 'quality')
  b.make('signalPresentStatement', 'ExpressionStatement', {}, { expression: 'signalPresentCall' }); b.call('signalPresentCall', 'signalPresentCallee', []); b.make('signalPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'signalPresentImport' } })
  b.make('signalFrameLoop', 'ForStatement', {}, { initializer: 'signalFrame', test: 'signalFrameTest', update: 'signalFrameStep', body: 'signalFrameBody' })
  b.make('signalFinalPrint', 'PrintStatement', {}, { value: 'signalFinalMessage' }); b.make('signalFinalMessage', 'Literal', { type: stringType, value: 'Signal lab' })
  b.block('signalMainBody', [
    'signalFillLoop', 'signalZeroSet', 'signalCollectStatement', 'signalQualityAssign',
    'signalDescribePrint', 'signalTagPrint', 'signalCharPrint', 'signalContainsPrint', 'signalSearchPrint', 'signalLengthPrint',
    'signalReverseVar', 'signalSliceVar', 'signalConcatVar',
    'signalReverseLengthPrint', 'signalSliceLengthPrint', 'signalConcatLengthPrint', 'signalContainsArrayPrint', 'signalIndexArrayPrint',
    ...axisStatements, 'signalFrameLoop', 'signalFinalPrint',
  ])

  const app = b.project.modules.find((module) => module.id === 'signalApp')
  app.imports.push(
    { id: 'signalPixelImport', moduleId: 'signalScreen', nodeId: setPixel.nodeId, localName: 'setPixel' },
    { id: 'signalPresentImport', moduleId: 'signalScreen', nodeId: present.nodeId, localName: 'present' },
    { id: 'signalQualityImport', moduleId: 'signalGauge', nodeId: setQuality.nodeId, localName: 'setQuality' },
    { id: 'signalAlarmImport', moduleId: 'signalLed', nodeId: setAlarm.nodeId, localName: 'setAlarm' },
    { id: 'signalSampleImport', moduleId: 'signalData', nodeId: 'signalSampleAt', localName: 'sampleAt' },
    { id: 'signalSmoothImport', moduleId: 'signalStats', nodeId: 'signalSmooth', localName: 'smooth' },
    { id: 'signalEachImport', moduleId: 'signalStats', nodeId: 'signalEach', localName: 'forEachSample' },
    { id: 'signalWeightImport', moduleId: 'signalStats', nodeId: 'signalWeight', localName: 'weight' },
    { id: 'signalDescribeImport', moduleId: 'signalText', nodeId: 'signalDescribe', localName: 'describe' },
    { id: 'signalTagImport', moduleId: 'signalText', nodeId: 'signalTagFor', localName: 'tagFor' },
  )
  b.project.modules.find((module) => module.id === 'signalData').exports.push({ nodeId: 'signalSampleAt', name: 'sampleAt' })
  b.project.modules.find((module) => module.id === 'signalStats').exports.push({ nodeId: 'signalSmooth', name: 'smooth' }, { nodeId: 'signalEach', name: 'forEachSample' }, { nodeId: 'signalScore', name: 'score' }, { nodeId: 'signalWeight', name: 'weight' })
  b.project.modules.find((module) => module.id === 'signalText').exports.push({ nodeId: 'signalDescribe', name: 'describe' }, { nodeId: 'signalTagFor', name: 'tagFor' })
  b.project.nodes.find((node) => node.id === 'signalQuality').contracts = [{ kind: 'between', arguments: [0, 100] }]
  b.project.nodes.find((node) => node.id === 'signalSamplesData').contracts = [{ kind: 'minLength', arguments: [8] }]
  b.project.nodes.find((node) => node.id === 'averageValues').contracts = [{ kind: 'nonEmpty' }]

  const result = workspace(b.project, [
    note('signalScreenNote', 'Waveform', 'Écran 48×18 : les axes sont tracés une fois, puis un point apparaît par image à la hauteur de l’échantillon. La boucle de 48 images dure deux secondes à 24 fps.', 0, 900, 620, 240),
    note('signalStatsNote', 'Signal stats', '`average` illustre While, Continue et Break ; `score` reçoit une fonction de type `(int) -> double` et somme ses résultats dans une boucle For ; `smooth` écrit la qualité à travers un pointeur avec `sign` et `clamp`.', 660, 900, 620, 240),
    note('signalTextNote', 'Signal text', '`TAGS` est découpé par `stringSplit`, indexé, recomposé par `substring` et `stringJoin` ; l’application affiche aussi `charAt`, `contains`, `stringIndexOf` et `length`.', 1320, 900, 620, 240),
  ])
  const cards = result.presentation.cards
  const byId = (id) => cards.find((card) => card.id === id)
  Object.assign(byId('signalScreen'), { x: 0, y: 0, width: 760, height: 360 })
  Object.assign(byId('signalGauge'), { x: 820, y: 0 })
  Object.assign(byId('signalLed'), { x: 1240, y: 0 })
  Object.assign(byId('signalData'), { x: 0, y: 420 })
  Object.assign(byId('signalStats'), { x: 560, y: 420 })
  Object.assign(byId('signalText'), { x: 1120, y: 420 })
  Object.assign(byId('signalApp'), { x: 1680, y: 420 })
  return result
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
  b.liveFlag()

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
  b.liveTest('carFrame', 'carFrameRead', 'carFrameEnd')
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

// Déclare un tableau d'entiers constant nommé, utilisable par référence.
function intArrayConstant(b, name, values) {
  b.root(`${name}Decl`, 'ConstantDeclaration', { name, type: intArrayType }, { initializer: `${name}Init` })
  b.make(`${name}Init`, 'ArrayLiteral', { elementType: intType }, { elements: values.map((value, index) => {
    b.intValue(`${name}Value${index}`, value)
    return `${name}Value${index}`
  }) })
}

// Simulation d'écran à automate cellulaire : convolution des voisins, table de
// transition de 18 entrées, blit puis présentation, une image par génération.
function automatonScreen({ id, title, width, height, frames, rule, kernel, seeds, palette, noteText, live = false }) {
  const b = builder()
  const screen = createScreenModule(`${id}Screen`, `${title} screen`, 1, { width, height })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  b.useModule(`${id}App`, title)
  if (live) b.liveFlag()
  const app = b.project.modules.find((module) => module.id === `${id}App`)
  const exported = (name) => screen.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, `${id}BlitImport`, screen.module.id, exported('SCREEN_SP3_BLIT_1'), 'blit')
  importFunction(app, `${id}PresentImport`, screen.module.id, exported('SCREEN_SP3_PRESENT_1'), 'present')

  // Grille pleine, compteurs et tableau suivant : aucun pas par cellule.
  b.root(`${id}Grid`, 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: `${id}GridInit` })
  b.math(`${id}GridInit`, 'arrayFill', [`${id}CellCount`, `${id}Zero`])
  b.intValue(`${id}CellCount`, width * height)
  b.intValue(`${id}Zero`, 0)
  b.root(`${id}Counts`, 'VariableDeclaration', { name: 'counts', type: intArrayType })
  b.root(`${id}Next`, 'VariableDeclaration', { name: 'next', type: intArrayType })
  intArrayConstant(b, `${id}Kernel`, kernel)
  intArrayConstant(b, `${id}Rule`, rule)
  intArrayConstant(b, `${id}Palette`, palette)

  // Cellules de départ, posées une seule fois avant la boucle.
  const seedStatements = seeds.map(([x, y], index) => {
    const prefix = `${id}Seed${index}`
    b.make(`${prefix}Cell`, 'ArrayAccess', {}, { array: `${prefix}Grid`, index: `${prefix}Index` })
    b.ref(`${prefix}Grid`, 'grid')
    b.intValue(`${prefix}Index`, y * width + x)
    b.make(`${prefix}Value`, 'Literal', { type: intType, value: '1' })
    b.make(`${prefix}Statement`, 'AssignmentStatement', {}, { target: `${prefix}Cell`, value: `${prefix}Value` })
    return `${prefix}Statement`
  })

  b.math(`${id}CountsCall`, 'arrayConvolve', [`${id}GridRead`, `${id}Width`, `${id}Height`, `${id}KernelRead`, `${id}KernelWidth`, `${id}KernelHeight`])
  b.ref(`${id}GridRead`, 'grid')
  b.intValue(`${id}Width`, width)
  b.intValue(`${id}Height`, height)
  b.ref(`${id}KernelRead`, `${id}Kernel`)
  b.intValue(`${id}KernelWidth`, 3)
  b.intValue(`${id}KernelHeight`, 3)
  b.assign(`${id}CountsAssign`, `${id}CountsTarget`, `${id}CountsCall`)
  b.ref(`${id}CountsTarget`, 'counts')
  b.math(`${id}LookupCall`, 'arrayLookup', [`${id}CountsRead`, `${id}GridLookup`, `${id}RuleRead`])
  b.ref(`${id}CountsRead`, 'counts')
  b.ref(`${id}GridLookup`, 'grid')
  b.ref(`${id}RuleRead`, `${id}Rule`)
  b.assign(`${id}NextAssign`, `${id}NextTarget`, `${id}LookupCall`)
  b.ref(`${id}NextTarget`, 'next')
  b.assign(`${id}GridAssign`, `${id}GridTarget`, `${id}NextRead`)
  b.ref(`${id}GridTarget`, 'grid')
  b.ref(`${id}NextRead`, 'next')

  b.make(`${id}BlitStatement`, 'ExpressionStatement', {}, { expression: `${id}BlitCall` })
  b.call(`${id}BlitCall`, `${id}BlitCallee`, [`${id}BlitGrid`, `${id}BlitPalette`])
  b.make(`${id}BlitCallee`, 'Reference', {}, {}, { target: { kind: 'import', importId: `${id}BlitImport` } })
  b.ref(`${id}BlitGrid`, 'grid')
  b.ref(`${id}BlitPalette`, `${id}Palette`)
  b.make(`${id}PresentStatement`, 'ExpressionStatement', {}, { expression: `${id}PresentCall` })
  b.call(`${id}PresentCall`, `${id}PresentCallee`, [])
  b.make(`${id}PresentCallee`, 'Reference', {}, {}, { target: { kind: 'import', importId: `${id}PresentImport` } })

  const loop = (live ? b.liveLoop : b.countedLoop)(`${id}Frame`, 'frame', `${id}FrameCount`, [
    `${id}CountsAssign`, `${id}NextAssign`, `${id}GridAssign`, `${id}BlitStatement`, `${id}PresentStatement`,
  ])
  b.intValue(`${id}FrameCount`, frames)
  b.root(`${id}Main`, 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: `${id}Body` })
  b.stringValue(`${id}Message`, title)
  b.print(`${id}Print`, `${id}Message`)
  b.block(`${id}Body`, [...seedStatements, loop, `${id}Print`])

  return workspace(b.project, [note(`${id}Note`, title, noteText, 0, 520, 620, 220)])
}

// Champ d'étoiles : l'écran défile d'une ligne par image, puis huit étoiles
// colorées apparaissent en bas avec une colonne tirée au hasard.
function starfield() {
  const b = builder()
  const width = 64
  const height = 36
  const frames = 60
  const screen = createScreenModule('starScreen', 'Starfield screen', 1, { width, height })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  b.useModule('starApp', 'Starfield')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'starApp')
  const exported = (name) => screen.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'starBlitImport', screen.module.id, exported('SCREEN_SP3_BLIT_1'), 'blit')
  importFunction(app, 'starPresentImport', screen.module.id, exported('SCREEN_SP3_PRESENT_1'), 'present')

  b.root('starGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: 'starGridInit' })
  b.math('starGridInit', 'arrayFill', ['starCellCount', 'starZero'])
  b.intValue('starCellCount', width * height)
  b.intValue('starZero', 0)
  intArrayConstant(b, 'starPalette', [0, 0, 0, 255, 235, 240, 255, 255, 120, 190, 255, 255, 255, 213, 71, 255])

  // Décale la grille d'une ligne vers le haut, puis complète la dernière ligne.
  b.math('starSlice', 'arraySlice', ['starGridRead', 'starSliceStart', 'starSliceEnd'])
  b.ref('starGridRead', 'grid')
  b.intValue('starSliceStart', width)
  b.intValue('starSliceEnd', width * height)
  b.math('starRowFill', 'arrayFill', ['starRowWidth', 'starRowZero'])
  b.intValue('starRowWidth', width)
  b.intValue('starRowZero', 0)
  b.math('starJoin', 'arrayConcat', ['starSlice', 'starRowFill'])
  b.assign('starShift', 'starShiftTarget', 'starJoin')
  b.ref('starShiftTarget', 'grid')

  const drops = []
  for (let index = 0; index < 8; index += 1) {
    const prefix = `starDrop${index}`
    b.math(`${prefix}Column`, 'randomInt', [`${prefix}MinColumn`, `${prefix}MaxColumn`])
    b.intValue(`${prefix}MinColumn`, 0)
    b.intValue(`${prefix}MaxColumn`, width - 1)
    b.binary(`${prefix}Index`, '+', `${prefix}Base`, `${prefix}Column`)
    b.intValue(`${prefix}Base`, (height - 1) * width)
    b.access(`${prefix}Cell`, `${prefix}Grid`, `${prefix}Index`)
    b.ref(`${prefix}Grid`, 'grid')
    b.math(`${prefix}Color`, 'randomInt', [`${prefix}MinColor`, `${prefix}MaxColor`])
    b.intValue(`${prefix}MinColor`, 1)
    b.intValue(`${prefix}MaxColor`, 3)
    b.assign(`${prefix}Statement`, `${prefix}Cell`, `${prefix}Color`)
    drops.push(`${prefix}Statement`)
  }

  b.make('starBlitStatement', 'ExpressionStatement', {}, { expression: 'starBlitCall' })
  b.call('starBlitCall', 'starBlitCallee', ['starBlitGrid', 'starBlitPalette'])
  b.make('starBlitCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'starBlitImport' } })
  b.ref('starBlitGrid', 'grid')
  b.ref('starBlitPalette', 'starPalette')
  b.make('starPresentStatement', 'ExpressionStatement', {}, { expression: 'starPresentCall' })
  b.call('starPresentCall', 'starPresentCallee', [])
  b.make('starPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'starPresentImport' } })

  const loop = b.liveLoop('starFrame', 'frame', 'starFrameCount', ['starShift', ...drops, 'starBlitStatement', 'starPresentStatement'])
  b.intValue('starFrameCount', frames)
  b.root('starMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'starBody' })
  b.stringValue('starMessage', 'Starfield')
  b.print('starPrint', 'starMessage')
  b.block('starBody', [loop, 'starPrint'])

  return workspace(b.project, [
    note('starNote', 'Starfield', `Écran ${width}×${height}. Chaque image décale la grille d'une ligne vers le haut, puis huit étoiles sont tirées au hasard sur la dernière ligne, dans trois couleurs. La grille est déplacée avec arraySlice et arrayConcat, sans boucle par pixel ; Run rejoue les images et relance la simulation à la fin pour renouveler le ciel.`, 0, 520, 620, 220),
  ])
}

// Bandes de couleur qui défilent : grille statique construite par arrayFill,
// décalage d'une ligne par image, boucle refermée après 54 images.
function colorFlow() {
  const b = builder()
  const width = 96
  const height = 54
  const bandHeight = 6
  const bands = height / bandHeight
  const frames = 55
  const screen = createScreenModule('flowScreen', 'Color flow screen', 1, { width, height })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  b.useModule('flowApp', 'Color flow')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'flowApp')
  const exported = (name) => screen.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'flowBlitImport', screen.module.id, exported('SCREEN_SP3_BLIT_1'), 'blit')
  importFunction(app, 'flowPresentImport', screen.module.id, exported('SCREEN_SP3_PRESENT_1'), 'present')

  // Neuf bandes de six lignes, concaténées sans boucle par cellule.
  let joined = null
  for (let band = 0; band < bands; band += 1) {
    b.math(`flowBand${band}`, 'arrayFill', [`flowBandCells${band}`, `flowBandColor${band}`])
    b.intValue(`flowBandCells${band}`, width * bandHeight)
    b.intValue(`flowBandColor${band}`, band + 1)
    if (band === 0) {
      joined = 'flowBand0'
      continue
    }
    b.math(`flowJoin${band}`, 'arrayConcat', [joined, `flowBand${band}`])
    joined = `flowJoin${band}`
  }
  b.root('flowGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: joined })
  intArrayConstant(b, 'flowPalette', [
    8, 10, 18, 255,
    18, 60, 90, 255,
    22, 90, 120, 255,
    30, 120, 140, 255,
    40, 150, 150, 255,
    60, 175, 140, 255,
    90, 195, 120, 255,
    130, 205, 100, 255,
    180, 210, 85, 255,
    235, 200, 80, 255,
  ])

  // La ligne ajoutée reprend la couleur de la bande suivante : boucle sans raccord.
  b.math('flowSlice', 'arraySlice', ['flowGridRead', 'flowSliceStart', 'flowSliceEnd'])
  b.ref('flowGridRead', 'grid')
  b.intValue('flowSliceStart', width)
  b.intValue('flowSliceEnd', width * height)
  b.binary('flowBandIndex', '/', 'flowFrameValue', 'flowBandRows')
  b.ref('flowFrameValue', 'frame')
  b.intValue('flowBandRows', bandHeight)
  b.binary('flowBandModulo', '%', 'flowBandIndex', 'flowBandCount')
  b.intValue('flowBandCount', bands)
  b.binary('flowColor', '+', 'flowBandModulo', 'flowColorOne')
  b.intValue('flowColorOne', 1)
  b.math('flowRowFill', 'arrayFill', ['flowRowWidth', 'flowColor'])
  b.intValue('flowRowWidth', width)
  b.math('flowScrolled', 'arrayConcat', ['flowSlice', 'flowRowFill'])
  b.assign('flowShift', 'flowShiftTarget', 'flowScrolled')
  b.ref('flowShiftTarget', 'grid')

  b.make('flowBlitStatement', 'ExpressionStatement', {}, { expression: 'flowBlitCall' })
  b.call('flowBlitCall', 'flowBlitCallee', ['flowBlitGrid', 'flowBlitPalette'])
  b.make('flowBlitCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'flowBlitImport' } })
  b.ref('flowBlitGrid', 'grid')
  b.ref('flowBlitPalette', 'flowPalette')
  b.make('flowPresentStatement', 'ExpressionStatement', {}, { expression: 'flowPresentCall' })
  b.call('flowPresentCall', 'flowPresentCallee', [])
  b.make('flowPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'flowPresentImport' } })

  const loop = b.liveLoop('flowFrame', 'frame', 'flowFrameCount', ['flowShift', 'flowBlitStatement', 'flowPresentStatement'])
  b.intValue('flowFrameCount', frames)
  b.root('flowMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'flowBody' })
  b.stringValue('flowMessage', 'Color flow')
  b.print('flowPrint', 'flowMessage')
  b.block('flowBody', [loop, 'flowPrint'])

  return workspace(b.project, [
    note('flowNote', 'Color flow', `Écran ${width}×${height}. Neuf bandes de six lignes sont assemblées par arrayFill et arrayConcat, puis la grille défile d'une ligne par image. La couleur réinjectée suit la bande suivante : la 55e image égale la première, donc la lecture boucle sans raccord.`, 0, 520, 620, 220),
  ])
}

// Montre le pilotage d'une LED RVB par un module ordinaire, sans autre widget.
function rgbLedDemo() {
  const b = builder()
  const led = createRgbLedModule('rgbDemoLed', 'RGB LED', 1, rgbLedDefaults)
  b.project.modules.push(led.module)
  b.project.nodes.push(...led.nodes)
  const app = b.useModule('rgbDemoApp', 'Color sequence')
  const setColor = led.module.exports.find((entry) => entry.name === led.functions.setColor)
  importFunction(app, 'rgbDemoSetColor', led.module.id, setColor.nodeId, 'setColor')

  const colors = [
    ['Red', 255, 0, 0],
    ['Yellow', 255, 255, 0],
    ['Green', 0, 255, 0],
    ['Cyan', 0, 255, 255],
    ['Blue', 0, 0, 255],
    ['Magenta', 255, 0, 255],
    ['White', 255, 255, 255],
  ]
  const statements = []
  colors.forEach(([name, ...channels], index) => {
    const prefix = `rgbDemoColor${index}`
    const argumentsIds = channels.map((value, channel) => b.intValue(`${prefix}Channel${channel}`, value))
    statements.push(callStatement(b, prefix, 'rgbDemoSetColor', argumentsIds))
    b.stringValue(`${prefix}Name`, name)
    statements.push(b.print(`${prefix}Print`, `${prefix}Name`))
  })
  b.root('rgbDemoMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'rgbDemoBody' })
  b.block('rgbDemoBody', statements)
  return workspace(b.project, [note('rgbDemoNote', 'RGB LED', 'Lancez Run pour parcourir rouge, jaune, vert, cyan, bleu, magenta puis blanc. Le module Color sequence importe setColor(red, green, blue) ; chaque canal est un int entre 0 et 255. La carte affiche les trois valeurs et suit les pas de simulation ou de debug. Modifiez les arguments des appels pour essayer vos propres couleurs ; aucun écran ni matériel externe n’est nécessaire.', 0, 520, 1120, 220)])
}

// Mélangeur RVB : trois barres pour les canaux, une jauge de luminosité, une LED
// RVB et un écran 48×28 qui montre les canaux et la couleur mélangée.
function rgbMixer() {
  const b = builder()
  const width = 48
  const height = 28
  const bandCells = width * 7
  const frames = 25
  const screen = createScreenModule('mixScreen', 'Mixer screen', 1, { width, height })
  const red = createProgressModule('mixRed', 'Red channel', 1, { min: 0, max: 255 })
  const green = createProgressModule('mixGreen', 'Green channel', 2, { min: 0, max: 255 })
  const blue = createProgressModule('mixBlue', 'Blue channel', 3, { min: 0, max: 255 })
  const gauge = createGaugeModule('mixGauge', 'Brightness', 1, gaugeDefaults)
  const led = createRgbLedModule('mixLed', 'Mixed color', 1, rgbLedDefaults)
  b.project.modules.push(screen.module, red.module, green.module, blue.module, gauge.module, led.module)
  b.project.nodes.push(...screen.nodes, ...red.nodes, ...green.nodes, ...blue.nodes, ...gauge.nodes, ...led.nodes)
  b.useModule('mixApp', 'RGB mixer')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'mixApp')
  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'mixBlitImport', screen.module.id, exported(screen, 'SCREEN_SP3_BLIT_1'), 'blit')
  importFunction(app, 'mixPresentImport', screen.module.id, exported(screen, 'SCREEN_SP3_PRESENT_1'), 'present')
  importFunction(app, 'mixRedImport', red.module.id, exported(red, red.functions.setValue), 'setRed')
  importFunction(app, 'mixGreenImport', green.module.id, exported(green, green.functions.setValue), 'setGreen')
  importFunction(app, 'mixBlueImport', blue.module.id, exported(blue, blue.functions.setValue), 'setBlue')
  importFunction(app, 'mixGaugeImport', gauge.module.id, exported(gauge, gauge.functions.setValue), 'setBrightness')
  importFunction(app, 'mixLedImport', led.module.id, exported(led, led.functions.setColor), 'setColor')

  // Quatre bandes horizontales : rouge, vert, bleu, puis la couleur mélangée.
  b.math('mixBandRed', 'arrayFill', ['mixBandCellsRed', 'mixBandColorRed'])
  b.intValue('mixBandCellsRed', bandCells)
  b.intValue('mixBandColorRed', 0)
  b.math('mixBandGreen', 'arrayFill', ['mixBandCellsGreen', 'mixBandColorGreen'])
  b.intValue('mixBandCellsGreen', bandCells)
  b.intValue('mixBandColorGreen', 1)
  b.math('mixBandBlue', 'arrayFill', ['mixBandCellsBlue', 'mixBandColorBlue'])
  b.intValue('mixBandCellsBlue', bandCells)
  b.intValue('mixBandColorBlue', 2)
  b.math('mixBandMixed', 'arrayFill', ['mixBandCellsMixed', 'mixBandColorMixed'])
  b.intValue('mixBandCellsMixed', bandCells)
  b.intValue('mixBandColorMixed', 3)
  b.math('mixJoin1', 'arrayConcat', ['mixBandRed', 'mixBandGreen'])
  b.math('mixJoin2', 'arrayConcat', ['mixJoin1', 'mixBandBlue'])
  b.math('mixJoin3', 'arrayConcat', ['mixJoin2', 'mixBandMixed'])
  b.root('mixGrid', 'VariableDeclaration', { name: 'grid', type: intArrayType }, { initializer: 'mixJoin3' })
  // Palette RGBA mutable : chaque couleur commence noire, seuls les canaux utiles changent.
  b.root('mixPalette', 'VariableDeclaration', { name: 'mixPalette', type: intArrayType }, { initializer: 'mixPaletteInit' })
  b.make('mixPaletteInit', 'ArrayLiteral', { elementType: intType }, { elements: [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255].map((value, index) => {
    b.intValue(`mixPaletteValue${index}`, value)
    return `mixPaletteValue${index}`
  }) })

  // Canal r, g ou b : motif de 24 images refermé sur lui-même.
  const channel = (prefix, offset) => {
    b.binary(`${prefix}Times`, '*', `${prefix}FrameRead`, `${prefix}Step`)
    b.ref(`${prefix}FrameRead`, 'frame')
    b.intValue(`${prefix}Step`, 10)
    b.binary(`${prefix}Shifted`, '+', `${prefix}Times`, `${prefix}Offset`)
    b.intValue(`${prefix}Offset`, offset)
    b.binary(`${prefix}ShiftedSeed`, '+', `${prefix}Shifted`, `${prefix}SeedRef`)
    b.ref(`${prefix}SeedRef`, 'mixSeed')
    b.binary(`${prefix}Value`, '%', `${prefix}ShiftedSeed`, `${prefix}Modulo`)
    b.intValue(`${prefix}Modulo`, 240)
    b.variable(`${prefix}Variable`, prefix, intType, `${prefix}Value`)
    return `${prefix}Variable`
  }

  // Écrit une composante de la palette par son index plat.
  const paletteWrite = (prefix, index, value) => {
    b.access(`${prefix}Cell`, `${prefix}Array`, `${prefix}Index`)
    b.ref(`${prefix}Array`, 'mixPalette')
    b.intValue(`${prefix}Index`, index)
    b.assign(`${prefix}Statement`, `${prefix}Cell`, value)
    return `${prefix}Statement`
  }

  const r = channel('mixR', 0)
  const g = channel('mixG', 80)
  const bl = channel('mixBlueValue', 160)
  b.make('mixRDouble', 'CastExpression', { type: doubleType }, { argument: 'mixRRead' })
  b.ref('mixRRead', 'mixR')
  b.make('mixGDouble', 'CastExpression', { type: doubleType }, { argument: 'mixGRead' })
  b.ref('mixGRead', 'mixG')
  b.make('mixBDouble', 'CastExpression', { type: doubleType }, { argument: 'mixBRead' })
  b.ref('mixBRead', 'mixBlueValue')
  b.binary('mixSum', '+', 'mixSumLeft', 'mixSumRight')
  b.binary('mixSumLeft', '+', 'mixSumR', 'mixSumG')
  b.ref('mixSumR', 'mixR')
  b.ref('mixSumG', 'mixG')
  b.ref('mixSumRight', 'mixBlueValue')
  b.binary('mixScaled', '*', 'mixSum', 'mixHundred')
  b.intValue('mixHundred', 100)
  b.binary('mixBrightnessValue', '/', 'mixScaled', 'mixMaximum')
  b.intValue('mixMaximum', 765)
  b.make('mixBrightnessDouble', 'CastExpression', { type: doubleType }, { argument: 'mixBrightnessValue' })

  const redCall = callStatement(b, 'mixRedCall', 'mixRedImport', ['mixRDouble'])
  const greenCall = callStatement(b, 'mixGreenCall', 'mixGreenImport', ['mixGDouble'])
  const blueCall = callStatement(b, 'mixBlueCall', 'mixBlueImport', ['mixBDouble'])
  const brightnessCall = callStatement(b, 'mixBrightnessCall', 'mixGaugeImport', ['mixBrightnessDouble'])
  b.ref('mixLedR', 'mixR')
  b.ref('mixLedG', 'mixG')
  b.ref('mixLedB', 'mixBlueValue')
  const ledCall = callStatement(b, 'mixLedCall', 'mixLedImport', ['mixLedR', 'mixLedG', 'mixLedB'])
  // Chaque composante écrite dans la palette a sa propre référence.
  b.ref('mixChannelR1', 'mixR')
  b.ref('mixChannelG1', 'mixG')
  b.ref('mixChannelB1', 'mixBlueValue')
  b.ref('mixChannelR2', 'mixR')
  b.ref('mixChannelG2', 'mixG')
  b.ref('mixChannelB2', 'mixBlueValue')

  b.make('mixBlitStatement', 'ExpressionStatement', {}, { expression: 'mixBlitCall' })
  b.call('mixBlitCall', 'mixBlitCallee', ['mixBlitGrid', 'mixBlitPalette'])
  b.make('mixBlitCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'mixBlitImport' } })
  b.ref('mixBlitGrid', 'grid')
  b.ref('mixBlitPalette', 'mixPalette')
  b.make('mixPresentStatement', 'ExpressionStatement', {}, { expression: 'mixPresentCall' })
  b.call('mixPresentCall', 'mixPresentCallee', [])
  b.make('mixPresentCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'mixPresentImport' } })

  const body = [
    r, g, bl,
    paletteWrite('mixPaletteRed', 0, 'mixChannelR1'),
    paletteWrite('mixPaletteGreen', 5, 'mixChannelG1'),
    paletteWrite('mixPaletteBlue', 10, 'mixChannelB1'),
    paletteWrite('mixPaletteMixedR', 12, 'mixChannelR2'),
    paletteWrite('mixPaletteMixedG', 13, 'mixChannelG2'),
    paletteWrite('mixPaletteMixedB', 14, 'mixChannelB2'),
    redCall, greenCall, blueCall, brightnessCall, ledCall,
    'mixBlitStatement', 'mixPresentStatement',
  ]
  const loop = b.liveLoop('mixFrame', 'frame', 'mixFrameCount', body)
  b.intValue('mixFrameCount', frames)
  b.root('mixMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mixBody' })
  b.stringValue('mixMessage', 'RGB mixer')
  b.print('mixPrint', 'mixMessage')
  b.intValue('mixSeedMin', 0)
  b.intValue('mixSeedMax', 239)
  b.variable('mixSeed', 'mixSeed', intType, 'mixSeedValue')
  b.make('mixSeedValue', 'MathCall', { name: 'randomInt' }, { arguments: ['mixSeedMin', 'mixSeedMax'] })
  b.block('mixBody', ['mixSeed', loop, 'mixPrint'])

  return workspace(b.project, [
    note('mixNote', 'RGB mixer', `Écran ${width}×${height}. Trois canaux parcourent 0–255 sur 24 images ; les barres de progression les affichent, la jauge calcule la luminosité et la LED RVB montre la couleur obtenue. L'écran présente quatre bandes — rouge, vert, bleu, mélange — sans un pas par pixel.`, 0, 1500, 900, 220),
  ])
}

// Corail : automate cellulaire B2/S12345, qui développe une structure organique
// dense puis se stabilise ; le motif de départ est un petit amas asymétrique.
function coralGrowth() {
  const blob = [
    [36, 22], [35, 28], [37, 24], [39, 28], [30, 28], [32, 21], [40, 20], [34, 20],
    [30, 26], [40, 27], [38, 20], [36, 24], [32, 28], [30, 27], [31, 20], [37, 26],
    [39, 27], [39, 26], [30, 23], [31, 25], [34, 22], [38, 22], [39, 25], [32, 24],
    [36, 23], [33, 27], [36, 23], [37, 25], [34, 25], [32, 20], [36, 24], [35, 22],
    [34, 20], [38, 21],
  ]
  const seeds = []
  const seen = new Set()
  for (const [x, y] of blob) {
    const key = `${x},${y}`
    if (seen.has(key)) continue
    seen.add(key)
    seeds.push([x, y])
  }
  return automatonScreen({
    id: 'coral',
    title: 'Coral growth',
    width: 72,
    height: 40,
    frames: 62,
    live: true,
    kernel: [1, 1, 1, 1, 0, 1, 1, 1, 1],
    rule: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    seeds,
    palette: [5, 10, 16, 255, 255, 190, 120, 255],
    noteText: 'Écran 72×40. Règle B2/S12345 : une cellule morte naît avec deux voisines, une cellule vivante survit avec une à cinq. L’amas initial se développe en structure organique dense, puis se fige après une soixantaine de générations. La convolution et la table de transition traitent toute la grille en une opération, suivies d’un blit et d’une présentation.',
  })
}

// Labyrinthe : automate B3/S1234, qui creuse des couloirs jusqu'à un motif stable.
function labyrinth() {
  const blob = [
    [36, 22], [35, 28], [37, 24], [39, 28], [30, 28], [32, 21], [40, 20], [34, 20],
    [30, 26], [40, 27], [38, 20], [36, 24], [32, 28], [30, 27], [31, 20], [37, 26],
    [39, 27], [39, 26], [30, 23], [31, 25], [34, 22], [38, 22], [39, 25], [32, 24],
    [36, 23], [33, 27], [36, 23], [37, 25], [34, 25], [32, 20], [36, 24], [35, 22],
    [34, 20], [38, 21],
  ]
  const seeds = []
  const seen = new Set()
  for (const [x, y] of blob) {
    const key = `${x},${y}`
    if (seen.has(key)) continue
    seen.add(key)
    seeds.push([x, y])
  }
  return automatonScreen({
    id: 'labyrinth',
    title: 'Labyrinth',
    width: 72,
    height: 40,
    frames: 109,
    live: true,
    kernel: [1, 1, 1, 1, 0, 1, 1, 1, 1],
    rule: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    seeds,
    palette: [4, 8, 14, 255, 120, 200, 255, 255],
    noteText: 'Écran 72×40. Règle B3/S1234 : une cellule morte naît avec trois voisines, une cellule vivante survit avec une à quatre. Les couloirs se creusent génération après génération jusqu’à un labyrinthe stable, atteint en une centaine d’images. Chaque génération tient en une convolution, une lecture de table, un blit et une présentation.',
  })
}

// Compteur local pour garantir un identifiant unique par nœud généré.
let generatedId = 0

// Produit un identifiant unique pour un nœud généré.
function uniqueId(prefix) {
  generatedId += 1
  return `${prefix}:${generatedId}`
}

// Crée un littéral entier neuf.
function intLiteral(b, value) {
  return b.intValue(uniqueId('int'), value)
}

// Crée une grille 2D vide de la taille demandée.
function emptyGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(0))
}

// Dessine un point dans une grille 2D.
function drawPoint(grid, x, y, value = 1) {
  const column = Math.round(x)
  const row = Math.round(y)
  if (row >= 0 && row < grid.length && column >= 0 && column < grid[0].length) grid[row][column] = value
}

// Dessine une ligne dans une grille 2D, avec un échantillonnage serré.
function drawLine(grid, x1, y1, x2, y2, value = 1) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2))
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps
    drawPoint(grid, x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, value)
  }
}

// Crée un module d'écran et l'ajoute au projet.
function screenModule(b, id, title, width, height, index) {
  const screen = createScreenModule(`${id}Screen`, `${title} screen`, index, { width, height })
  b.project.modules.push(screen.module)
  b.project.nodes.push(...screen.nodes)
  return screen
}

// Importe blit et present d'un écran dans le module courant.
function screenBlitImports(app, screen, prefix) {
  const exported = (kind) => screen.module.exports.find((entry) => entry.name.startsWith(`SCREEN_SP3_${kind}_`)).nodeId
  importFunction(app, `${prefix}BlitImport`, screen.module.id, exported('BLIT'), `${prefix}Blit`)
  importFunction(app, `${prefix}PresentImport`, screen.module.id, exported('PRESENT'), `${prefix}Present`)
  return { blit: `${prefix}BlitImport`, present: `${prefix}PresentImport` }
}

// Déclare une grille entière et l'initialise à zéro.
function gridVariable(b, name, width, height) {
  b.root(`${name}Decl`, 'VariableDeclaration', { name, type: intArrayType }, { initializer: b.math(uniqueId(`${name}Init`), 'arrayFill', [intLiteral(b, width * height), intLiteral(b, 0)]) })
  return name
}

// Déclare une palette de deux couleurs : fond noir puis couleur demandée.
function twoColorPalette(b, name, color) {
  intArrayConstant(b, name, [0, 0, 0, 255, color[0], color[1], color[2], 255])
}

// Écrit une grille 2D dans un tableau plat, en fusionnant les segments égaux
// consécutifs : une ligne vide et le début de la suivante forment un seul segment.
function gridAssign(b, prefix, gridName, grid) {
  const flat = grid.flat()
  const runs = []
  let start = 0
  for (let index = 1; index <= flat.length; index += 1) {
    if (index === flat.length || flat[index] !== flat[start]) {
      runs.push({ length: index - start, value: flat[start] })
      start = index
    }
  }
  const segments = runs.map((run) => b.math(uniqueId(`${prefix}Fill`), 'arrayFill', [intLiteral(b, run.length), intLiteral(b, run.value)]))
  return b.assign(uniqueId(`${prefix}Assign`), b.ref(uniqueId(`${prefix}Target`), gridName), concatBalanced(b, prefix, segments))
}

// Concatène des expressions en arbre équilibré pour borner la profondeur syntaxique.
function concatBalanced(b, prefix, nodes) {
  let level = nodes
  while (level.length > 1) {
    const next = []
    for (let index = 0; index < level.length; index += 2) {
      next.push(index + 1 < level.length
        ? b.math(uniqueId(`${prefix}Concat`), 'arrayConcat', [level[index], level[index + 1]])
        : level[index])
    }
    level = next
  }
  return level[0]
}

// Appelle blit sur la grille et la palette.
function blitStatement(b, prefix, blitImport, gridName, paletteName) {
  b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
  b.call(`${prefix}Call`, `${prefix}Callee`, [`${prefix}Grid`, `${prefix}Palette`])
  b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: blitImport } })
  b.ref(`${prefix}Grid`, gridName)
  b.ref(`${prefix}Palette`, paletteName)
  return `${prefix}Statement`
}

// Présente l'image courante de l'écran.
function presentStatement(b, prefix, presentImport) {
  b.make(`${prefix}PresentStatement`, 'ExpressionStatement', {}, { expression: `${prefix}PresentCall` })
  b.call(`${prefix}PresentCall`, `${prefix}PresentCallee`, [])
  b.make(`${prefix}PresentCallee`, 'Reference', {}, {}, { target: { kind: 'import', importId: presentImport } })
  return `${prefix}PresentStatement`
}

// Assigne une grille, la blitte puis présente l'image.
function presentFrame(b, prefix, api, gridName, paletteName, grid) {
  return [
    gridAssign(b, `${prefix}Grid`, gridName, grid),
    blitStatement(b, `${prefix}Blit`, api.blit, gridName, paletteName),
    presentStatement(b, `${prefix}Present`, api.present),
  ]
}

// Sommets et arêtes du cube unitaire, partagés par les projections.
const cubeVertices = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
]
const cubeEdges = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
]

// Projette les huit sommets du cube, sans mise à l'échelle.
function cubeProjection(angle, tilt, perspective) {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const cosT = Math.cos(tilt)
  const sinT = Math.sin(tilt)
  return cubeVertices.map(([x, y, z]) => {
    const rx = x * cosA - z * sinA
    const rz = x * sinA + z * cosA
    const ry = y * cosT - rz * sinT
    const rz2 = y * sinT + rz * cosT
    const scale = perspective ? 4 / (4 + rz2) : 1
    return [rx * scale, ry * scale]
  })
}

// Calcule l'échelle qui garde le cube entier sur l'écran pendant toute la rotation.
function cubeSize(width, height, frames, tilt, perspective) {
  let extentX = 0
  let extentY = 0
  for (let frame = 0; frame < frames; frame += 1) {
    for (const [x, y] of cubeProjection((Math.PI * 2 * frame) / frames, tilt, perspective)) {
      extentX = Math.max(extentX, Math.abs(x))
      extentY = Math.max(extentY, Math.abs(y))
    }
  }
  return Math.min((width / 2 - 2) / extentX, (height / 2 - 2) / extentY)
}

// Grille d'un cube filaire tournant, avec projection perspective ou orthographique.
function cubeGrid(width, height, angle, tilt, perspective, size) {
  const grid = emptyGrid(width, height)
  const projected = cubeProjection(angle, tilt, perspective)
    .map(([x, y]) => [width / 2 + x * size, height / 2 + y * size])
  for (const [from, to] of cubeEdges) drawLine(grid, projected[from][0], projected[from][1], projected[to][0], projected[to][1])
  return grid
}

// Grille d'un triangle équilatéral en rotation et pulsation.
function triangleGrid(width, height, frame, frames) {
  const grid = emptyGrid(width, height)
  const angle = (Math.PI * 2 * frame) / frames
  const radius = 11 + 2.5 * Math.sin(3 * angle)
  const vertices = [0, 1, 2].map((index) => {
    const theta = angle + (Math.PI * 2 * index) / 3
    return [width / 2 + radius * Math.cos(theta), height / 2 + radius * Math.sin(theta)]
  })
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3
    drawLine(grid, vertices[index][0], vertices[index][1], vertices[next][0], vertices[next][1])
  }
  return grid
}

// Grille d'un spirographe (hypotrochoïde) tracée progressivement.
function spirographGrid(width, height, frame, frames) {
  const grid = emptyGrid(width, height)
  const samples = 700
  const points = []
  // Deux tours suffisent à refermer la courbe, car (R - r) / r vaut 3 / 2.
  for (let index = 0; index <= samples; index += 1) {
    const theta = (Math.PI * 4 * index) / samples
    points.push([
      3 * Math.cos(theta) + 3.5 * Math.cos(1.5 * theta),
      3 * Math.sin(theta) - 3.5 * Math.sin(1.5 * theta),
    ])
  }
  const extentX = Math.max(...points.map((point) => Math.abs(point[0])))
  const extentY = Math.max(...points.map((point) => Math.abs(point[1])))
  const scale = Math.min((width / 2 - 2) / extentX, (height / 2 - 2) / extentY)
  const visible = Math.max(1, Math.ceil((points.length * (frame + 1)) / frames))
  for (let index = 0; index < visible; index += 1) {
    const [x, y] = points[index]
    drawPoint(grid, width / 2 + x * scale, height / 2 + y * scale)
  }
  return grid
}

// Grille du triangle de Sierpinski par jeu du chaos déterministe.
function sierpinskiGrid(width, height) {
  const grid = emptyGrid(width, height)
  const vertices = [[width / 2, 4], [4, height - 4], [width - 4, height - 4]]
  let seed = 123456789
  const random = () => {
    seed = (1103515245 * seed + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  let x = width / 2
  let y = height / 2
  for (let index = 0; index < 12000; index += 1) {
    const vertex = vertices[Math.floor(random() * 3)]
    x = (x + vertex[0]) / 2
    y = (y + vertex[1]) / 2
    drawPoint(grid, x, y)
  }
  return grid
}

// Grille d'une onde de pendules animée.
function pendulumGrid(width, height, frame, frames) {
  const grid = emptyGrid(width, height)
  const pendulums = 8
  const time = frame / frames
  const amplitude = 0.5
  const length = height - 8
  const pivotY = 3
  const margin = Math.max(8, Math.round(width * 0.14))
  // Support horizontal commun aux douze pendules.
  drawLine(grid, margin - 3, pivotY, width - margin + 3, pivotY)
  for (let index = 0; index < pendulums; index += 1) {
    const pivotX = margin + index * ((width - 2 * margin) / (pendulums - 1))
    const angle = amplitude * Math.sin(2 * Math.PI * time * (index + 1))
    drawLine(grid, pivotX, pivotY, pivotX + length * Math.sin(angle), pivotY + length * Math.cos(angle))
  }
  return grid
}

// Cube 3D filaire : deux écrans, projection perspective et orthographique.
function rotatingCube() {
  const b = builder()
  const width = 48
  const height = 30
  const frames = 6
  const screenA = screenModule(b, 'cubeA', 'Cube front', width, height, 1)
  const screenB = screenModule(b, 'cubeB', 'Cube top', width, height, 2)
  b.useModule('cubeApp', 'Rotating cube')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'cubeApp')
  const apiA = screenBlitImports(app, screenA, 'cubeA')
  const apiB = screenBlitImports(app, screenB, 'cubeB')
  const gridA = gridVariable(b, 'cubeGridA', width, height)
  const gridB = gridVariable(b, 'cubeGridB', width, height)
  twoColorPalette(b, 'cubePaletteA', [80, 220, 255])
  twoColorPalette(b, 'cubePaletteB', [255, 190, 90])

  const body = []
  const sizeA = cubeSize(width, height, frames, 0.35, true)
  const sizeB = cubeSize(width, height, frames, -0.55, false)
  for (let frame = 0; frame < frames; frame += 1) {
    const angle = (Math.PI * 2 * frame) / frames
    // Les deux écrans sont écrits avant la présentation : chaque image capturée est complète.
    body.push(
      gridAssign(b, `cubeA${frame}Grid`, gridA, cubeGrid(width, height, angle, 0.35, true, sizeA)),
      blitStatement(b, `cubeA${frame}Blit`, apiA.blit, gridA, 'cubePaletteA'),
      gridAssign(b, `cubeB${frame}Grid`, gridB, cubeGrid(width, height, angle, -0.55, false, sizeB)),
      blitStatement(b, `cubeB${frame}Blit`, apiB.blit, gridB, 'cubePaletteB'),
      presentStatement(b, `cubeA${frame}Present`, apiA.present),
      presentStatement(b, `cubeB${frame}Present`, apiB.present),
    )
  }
  b.root('cubeMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'cubeBody' })
  b.stringValue('cubeMessage', 'Rotating cube')
  b.print('cubePrint', 'cubeMessage')
  b.block('cubeBody', [b.liveRepeat('cube', body), 'cubePrint'])

  return workspace(b.project, [
    note('cubeNote', 'Rotating cube', `Deux écrans ${width}×${height}. Huit sommets, douze arêtes, rotation autour de l'axe vertical, projection perspective à gauche et orthographique inclinée à droite. Les images sont précalculées en JavaScript puis envoyées par blit/present. $$x' = x\\cos\\theta - z\\sin\\theta,\\quad z' = x\\sin\\theta + z\\cos\\theta$$`, 0, 1000, 1120, 240),
  ])
}

// Triangle équilatéral en rotation et pulsation.
function rotatingTriangle() {
  const b = builder()
  const width = 48
  const height = 30
  const frames = 20
  const screen = screenModule(b, 'triangle', 'Rotating triangle', width, height, 1)
  b.useModule('triangleApp', 'Rotating triangle')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'triangleApp')
  const api = screenBlitImports(app, screen, 'triangle')
  const grid = gridVariable(b, 'triangleGrid', width, height)
  twoColorPalette(b, 'trianglePalette', [255, 210, 90])
  const body = []
  for (let frame = 0; frame < frames; frame += 1) {
    body.push(...presentFrame(b, `triangle${frame}`, api, grid, 'trianglePalette', triangleGrid(width, height, frame, frames)))
  }
  b.root('triangleMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'triangleBody' })
  b.stringValue('triangleMessage', 'Rotating triangle')
  b.print('trianglePrint', 'triangleMessage')
  b.block('triangleBody', [b.liveRepeat('triangle', body), 'trianglePrint'])

  return workspace(b.project, [
    note('triangleNote', 'Rotating triangle', `Écran ${width}×${height}. Trois sommets tournent autour du centre ; le rayon pulse avec \`11 + 2,5·sin(3θ)\`. Les images sont précalculées puis affichées par blit/present. La séquence revient exactement à son état initial après ${frames} images. $$r(\\theta)=11+2{,}5\\sin(3\\theta)$$`, 0, 620, 760, 240),
  ])
}

// Prépare un exemple XY plot : module caché, module appelant et import de SET_FUNCTION.
function xyPlotSetup(b, prefix, plotName) {
  const plot = createXyPlotModule(`${prefix}Plot`, plotName, 1)
  b.project.modules.push(plot.module)
  b.project.nodes.push(...plot.nodes)
  b.useModule(`${prefix}App`, plotName)
  const app = b.project.modules.find((module) => module.id === `${prefix}App`)
  const exported = plot.module.exports.find((entry) => entry.name === plot.functions.setFunction)
  app.imports.push({ id: `${prefix}SetImport`, moduleId: plot.module.id, nodeId: exported.nodeId, localName: 'setFunction' })
  return plot
}

// Ajoute un main qui trace la fonction donnée puis affiche un message.
function xyPlotMain(b, prefix, functionName, message) {
  b.root(`${prefix}Main`, 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: `${prefix}Body` })
  b.block(`${prefix}Body`, [`${prefix}Set`, `${prefix}Print`])
  b.make(`${prefix}Set`, 'ExpressionStatement', {}, { expression: `${prefix}SetCall` })
  b.call(`${prefix}SetCall`, `${prefix}SetCallee`, [`${prefix}FunctionRef`])
  b.make(`${prefix}SetCallee`, 'Reference', {}, {}, { target: { kind: 'import', importId: `${prefix}SetImport` } })
  b.ref(`${prefix}FunctionRef`, functionName)
  b.stringValue(`${prefix}Message`, message)
  b.print(`${prefix}Print`, `${prefix}Message`)
}

// Traceur XY : une fonction (double) -> double est échantillonnée par le module caché.
function functionPlot() {
  const b = builder()
  const plot = createXyPlotModule('functionPlotPlot', 'Function plot', 1)
  b.project.modules.push(plot.module)
  b.project.nodes.push(...plot.nodes)
  b.useModule('functionPlotApp', 'Function plot')
  const app = b.project.modules.find((module) => module.id === 'functionPlotApp')
  const exported = plot.module.exports.find((entry) => entry.name === plot.functions.setFunction)
  app.imports.push({ id: 'functionPlotSetImport', moduleId: plot.module.id, nodeId: exported.nodeId, localName: 'setFunction' })
  b.root('wave', 'FunctionDeclaration', { name: 'wave', type: doubleType }, { parameters: ['waveX'], body: 'waveBody' })
  b.make('waveX', 'Parameter', { name: 'x', type: doubleType })
  b.block('waveBody', ['waveReturn'])
  b.returnValue('waveReturn', 'waveSin')
  b.make('waveSin', 'MathCall', { name: 'sin' }, { arguments: ['waveXRef'] })
  b.ref('waveXRef', 'x')
  b.root('functionPlotMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'functionPlotBody' })
  b.block('functionPlotBody', ['functionPlotSet', 'functionPlotPrint'])
  b.make('functionPlotSet', 'ExpressionStatement', {}, { expression: 'functionPlotSetCall' })
  b.call('functionPlotSetCall', 'functionPlotSetCallee', ['waveRef'])
  b.make('functionPlotSetCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'functionPlotSetImport' } })
  b.ref('waveRef', 'wave')
  b.stringValue('functionPlotMessage', 'Function plotted')
  b.print('functionPlotPrint', 'functionPlotMessage')
  return workspace(b.project, [
    note('functionPlotNote', 'Function plot', 'Traceur XY interactif : `SET_FUNCTION(wave)` échantillonne `wave(x) = sin(x)` sur `[-10, 10]`, puis Mafs permet de déplacer et zoomer le graphique. Le module caché exporte `SET_FUNCTION`, `SET_RANGE` et `CLEAR`.', 0, 620, 900, 260),
  ])
}

// Traceur simple : une droite affine.
function linearPlot() {
  const b = builder()
  xyPlotSetup(b, 'linearPlot', 'Linear plot')
  b.root('linearLine', 'FunctionDeclaration', { name: 'line', type: doubleType }, { parameters: ['linearX'], body: 'linearBody' })
  b.make('linearX', 'Parameter', { name: 'x', type: doubleType })
  b.block('linearBody', ['linearReturn'])
  b.returnValue('linearReturn', 'linearSum')
  b.binary('linearSum', '+', 'linearProduct', 'linearOne')
  b.doubleValue('linearOne', 1)
  b.binary('linearProduct', '*', 'linearTwo', 'linearXRef')
  b.doubleValue('linearTwo', 2)
  b.ref('linearXRef', 'x')
  xyPlotMain(b, 'linearPlot', 'line', 'Linear function plotted')
  return workspace(b.project, [
    note('linearPlotNote', 'Linear plot', 'Traceur XY : `SET_FUNCTION(line)` échantillonne la droite `line(x) = 2x + 1` sur `[-10, 10]`. Déplacez et zoomez le graphique avec Mafs.', 0, 620, 900, 220),
  ])
}

// Traceur moyen : interférence de deux ondes sinusoïdales.
function waveInterference() {
  const b = builder()
  xyPlotSetup(b, 'waveInterference', 'Wave interference')
  b.root('waveFunction', 'FunctionDeclaration', { name: 'wave', type: doubleType }, { parameters: ['waveX'], body: 'waveBody' })
  b.make('waveX', 'Parameter', { name: 'x', type: doubleType })
  b.block('waveBody', ['waveReturn'])
  b.returnValue('waveReturn', 'waveSum')
  b.binary('waveSum', '+', 'waveFirst', 'waveSecond')
  b.math('waveFirst', 'sin', ['waveXRefA'])
  b.ref('waveXRefA', 'x')
  b.binary('waveSecond', '*', 'waveHalf', 'waveFast')
  b.doubleValue('waveHalf', 0.5)
  b.math('waveFast', 'sin', ['waveAngle'])
  b.binary('waveAngle', '*', 'waveFrequency', 'waveXRefB')
  b.doubleValue('waveFrequency', 2.5)
  b.ref('waveXRefB', 'x')
  xyPlotMain(b, 'waveInterference', 'wave', 'Wave interference plotted')
  return workspace(b.project, [
    note('waveInterferenceNote', 'Wave interference', 'Deux ondes se superposent : `wave(x) = sin(x) + 0,5·sin(2,5x)`. Le tracé fait apparaître les battements et les nœuds ; Mafs permet de les inspecter en zoomant.', 0, 620, 900, 220),
  ])
}

// Traceur difficile : série de Fourier approchant une onde carrée.
function fourierSquare() {
  const b = builder()
  xyPlotSetup(b, 'fourierSquare', 'Fourier square')
  b.root('fourierFunction', 'FunctionDeclaration', { name: 'squareWave', type: doubleType }, { parameters: ['fourierX'], body: 'fourierBody' })
  b.make('fourierX', 'Parameter', { name: 'x', type: doubleType })
  b.block('fourierBody', ['fourierTotal', 'fourierOdd', 'fourierIndexLoop', 'fourierReturn'])
  b.variable('fourierTotal', 'total', doubleType, 'fourierTotalStart')
  b.doubleValue('fourierTotalStart', 0)
  b.variable('fourierOdd', 'odd', doubleType, 'fourierOddStart')
  b.doubleValue('fourierOddStart', 0)
  b.intValue('fourierLimit', 4)
  b.assign('fourierOddAssign', 'fourierOddTarget', 'fourierOddValue')
  b.ref('fourierOddTarget', 'odd')
  b.make('fourierOddValue', 'CastExpression', { type: doubleType }, { argument: 'fourierOddInt' })
  b.binary('fourierOddInt', '-', 'fourierDoubleK', 'fourierOne')
  b.intValue('fourierOne', 1)
  b.binary('fourierDoubleK', '*', 'fourierTwo', 'fourierKRead')
  b.intValue('fourierTwo', 2)
  b.ref('fourierKRead', 'k')
  b.assign('fourierAccumulate', 'fourierTotalTarget', 'fourierTotalValue')
  b.ref('fourierTotalTarget', 'total')
  b.binary('fourierTotalValue', '+', 'fourierTotalRead', 'fourierTerm')
  b.ref('fourierTotalRead', 'total')
  b.binary('fourierTerm', '/', 'fourierSin', 'fourierOddRef')
  b.ref('fourierOddRef', 'odd')
  b.math('fourierSin', 'sin', ['fourierAngle'])
  b.binary('fourierAngle', '*', 'fourierOddAngle', 'fourierXRef')
  b.ref('fourierOddAngle', 'odd')
  b.ref('fourierXRef', 'x')
  b.countedLoop('fourierIndex', 'k', 'fourierLimit', ['fourierOddAssign', 'fourierAccumulate'], 1)
  b.returnValue('fourierReturn', 'fourierTotalRef')
  b.ref('fourierTotalRef', 'total')
  xyPlotMain(b, 'fourierSquare', 'squareWave', 'Square wave plotted')
  return workspace(b.project, [
    note('fourierSquareNote', 'Fourier square', 'Série de Fourier tronquée : `squareWave(x) = Σ sin((2k−1)x)/(2k−1)` pour `k = 1…3`. La boucle interne recalcule chaque harmonique à chaque point ; les ondulations de Gibbs restent visibles près des discontinuités.', 0, 620, 900, 240),
  ])
}

// Oscilloscope : trois canaux indépendants tracés simultanément.
function oscilloscopeDemo() {
  const b = builder()
  const scope = createOscilloscopeModule('oscilloscopeDemoScope', 'Oscilloscope', 1)
  b.project.modules.push(scope.module)
  b.project.nodes.push(...scope.nodes)
  b.useModule('oscilloscopeDemoApp', 'Oscilloscope demo')
  const app = b.project.modules.find((module) => module.id === 'oscilloscopeDemoApp')
  const exported = (name) => scope.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'oscilloscopeAddImport', moduleId: scope.module.id, nodeId: exported('OSC_SP3_ADD_CHANNEL_1'), localName: 'addChannel' },
    { id: 'oscilloscopeRangeImport', moduleId: scope.module.id, nodeId: exported('OSC_SP3_SET_RANGE_1'), localName: 'setRange' },
  )
  b.root('oscilloscopeSin', 'FunctionDeclaration', { name: 'waveSin', type: doubleType }, { parameters: ['oscilloscopeSinX'], body: 'oscilloscopeSinBody' })
  b.make('oscilloscopeSinX', 'Parameter', { name: 'x', type: doubleType })
  b.block('oscilloscopeSinBody', ['oscilloscopeSinReturn'])
  b.returnValue('oscilloscopeSinReturn', 'oscilloscopeSinCall')
  b.math('oscilloscopeSinCall', 'sin', ['oscilloscopeSinXRef'])
  b.ref('oscilloscopeSinXRef', 'x')
  b.root('oscilloscopeCos', 'FunctionDeclaration', { name: 'waveCos', type: doubleType }, { parameters: ['oscilloscopeCosX'], body: 'oscilloscopeCosBody' })
  b.make('oscilloscopeCosX', 'Parameter', { name: 'x', type: doubleType })
  b.block('oscilloscopeCosBody', ['oscilloscopeCosReturn'])
  b.returnValue('oscilloscopeCosReturn', 'oscilloscopeCosCall')
  b.math('oscilloscopeCosCall', 'cos', ['oscilloscopeCosXRef'])
  b.ref('oscilloscopeCosXRef', 'x')
  b.root('oscilloscopeDouble', 'FunctionDeclaration', { name: 'waveDouble', type: doubleType }, { parameters: ['oscilloscopeDoubleX'], body: 'oscilloscopeDoubleBody' })
  b.make('oscilloscopeDoubleX', 'Parameter', { name: 'x', type: doubleType })
  b.block('oscilloscopeDoubleBody', ['oscilloscopeDoubleReturn'])
  b.returnValue('oscilloscopeDoubleReturn', 'oscilloscopeDoubleCall')
  b.math('oscilloscopeDoubleCall', 'sin', ['oscilloscopeDoubleAngle'])
  b.binary('oscilloscopeDoubleAngle', '*', 'oscilloscopeDoubleTwo', 'oscilloscopeDoubleXRef')
  b.doubleValue('oscilloscopeDoubleTwo', 2)
  b.ref('oscilloscopeDoubleXRef', 'x')
  b.root('oscilloscopeMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'oscilloscopeBody' })
  b.block('oscilloscopeBody', ['oscilloscopeRange', 'oscilloscopeAddSin', 'oscilloscopeAddCos', 'oscilloscopeAddDouble', 'oscilloscopePrint'])
  b.make('oscilloscopeRange', 'ExpressionStatement', {}, { expression: 'oscilloscopeRangeCall' })
  b.call('oscilloscopeRangeCall', 'oscilloscopeRangeCallee', ['oscilloscopeRangeMin', 'oscilloscopeRangeMax'])
  b.make('oscilloscopeRangeCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'oscilloscopeRangeImport' } })
  b.doubleValue('oscilloscopeRangeMin', -6.283185307179586)
  b.doubleValue('oscilloscopeRangeMax', 6.283185307179586)
  const addCall = (prefix, functionName) => {
    b.make(prefix, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    b.call(`${prefix}Call`, `${prefix}Callee`, [`${prefix}Ref`])
    b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId: 'oscilloscopeAddImport' } })
    b.ref(`${prefix}Ref`, functionName)
  }
  addCall('oscilloscopeAddSin', 'waveSin')
  addCall('oscilloscopeAddCos', 'waveCos')
  addCall('oscilloscopeAddDouble', 'waveDouble')
  b.stringValue('oscilloscopeMessage', 'Oscilloscope demo')
  b.print('oscilloscopePrint', 'oscilloscopeMessage')
  return workspace(b.project, [
    note('oscilloscopeDemoNote', 'Oscilloscope demo', 'Trois canaux indépendants sont ajoutés avec `ADD_CHANNEL` sur une fenêtre commune : `sin(x)`, `cos(x)` et `sin(2x)`. uPlot trace les signaux ; les commandes de la carte règlent le zoom, le déplacement, l’amplitude et l’offset sans relancer la simulation.', 0, 620, 900, 260),
  ])
}

// Spirographe : hypotrochoïde tracée progressivement.
function spirograph() {
  const b = builder()
  const width = 64
  const height = 40
  const frames = 12
  const screen = screenModule(b, 'spiro', 'Spirograph', width, height, 1)
  b.useModule('spiroApp', 'Spirograph')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'spiroApp')
  const api = screenBlitImports(app, screen, 'spiro')
  const grid = gridVariable(b, 'spiroGrid', width, height)
  twoColorPalette(b, 'spiroPalette', [120, 220, 255])
  const body = []
  for (let frame = 0; frame < frames; frame += 1) {
    body.push(...presentFrame(b, `spiro${frame}`, api, grid, 'spiroPalette', spirographGrid(width, height, frame, frames)))
  }
  b.root('spiroMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'spiroBody' })
  b.stringValue('spiroMessage', 'Spirograph')
  b.print('spiroPrint', 'spiroMessage')
  b.block('spiroBody', [b.liveRepeat('spiro', body), 'spiroPrint'])

  return workspace(b.project, [
    note('spiroNote', 'Spirograph', `Écran ${width}×${height}. Hypotrochoïde \`R=5\`, \`r=2\`, \`d=3.5\`, tracée progressivement en ${frames} images avec 700 échantillons. $$x=(R-r)\\cos\\theta+d\\cos\\!\\left(\\frac{R-r}{r}\\theta\\right),\\quad y=(R-r)\\sin\\theta-d\\sin\\!\\left(\\frac{R-r}{r}\\theta\\right)$$`, 0, 620, 900, 260),
  ])
}

// Jeu du chaos de Sierpinski : fractale statique déterministe.
function sierpinskiChaos() {
  const b = builder()
  const width = 64
  const height = 40
  const screen = screenModule(b, 'sier', 'Sierpinski chaos', width, height, 1)
  b.useModule('sierApp', 'Sierpinski chaos')
  const app = b.project.modules.find((module) => module.id === 'sierApp')
  const api = screenBlitImports(app, screen, 'sier')
  const grid = gridVariable(b, 'sierGrid', width, height)
  twoColorPalette(b, 'sierPalette', [120, 255, 160])
  const body = presentFrame(b, 'sier', api, grid, 'sierPalette', sierpinskiGrid(width, height))
  b.root('sierMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'sierBody' })
  b.stringValue('sierMessage', 'Sierpinski chaos')
  b.print('sierPrint', 'sierMessage')
  b.block('sierBody', [...body, 'sierPrint'])

  return workspace(b.project, [
    note('sierNote', 'Sierpinski chaos', `Écran ${width}×${height}. Douze mille points du jeu du chaos : un sommet du triangle est tiré, puis le point courant se déplace à mi-chemin. La grille finale est précalculée et envoyée par blit/present. $$P_{n+1}=\\frac{P_n+V_i}{2}$$`, 0, 620, 900, 240),
  ])
}

// Onde de pendules : douze longueurs identiques, fréquences entières croissantes.
function pendulumWave() {
  const b = builder()
  const width = 56
  const height = 24
  const frames = 9
  const screen = screenModule(b, 'pendulum', 'Pendulum wave', width, height, 1)
  b.useModule('pendulumApp', 'Pendulum wave')
  b.liveFlag()
  const app = b.project.modules.find((module) => module.id === 'pendulumApp')
  const api = screenBlitImports(app, screen, 'pendulum')
  const grid = gridVariable(b, 'pendulumGrid', width, height)
  twoColorPalette(b, 'pendulumPalette', [160, 220, 255])
  const body = []
  for (let frame = 0; frame < frames; frame += 1) {
    body.push(...presentFrame(b, `pendulum${frame}`, api, grid, 'pendulumPalette', pendulumGrid(width, height, frame, frames)))
  }
  b.root('pendulumMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'pendulumBody' })
  b.stringValue('pendulumMessage', 'Pendulum wave')
  b.print('pendulumPrint', 'pendulumMessage')
  b.block('pendulumBody', [b.liveRepeat('pendulum', body), 'pendulumPrint'])

  return workspace(b.project, [
    note('pendulumNote', 'Pendulum wave', `Écran ${width}×${height}. Huit pendules de même longueur ont des fréquences entières de 1 à 8. Les positions sont calculées pour ${frames} images sur une période complète. $$\\theta_i(t)=A\\sin(2\\pi f_i t),\\quad f_i=1,\\dots,8$$`, 0, 620, 900, 240),
  ])
}

// Trois niveaux de difficulté, du plus simple au plus avancé.
export const exampleCategories = [
  { id: 'simple', labelKey: 'examples.category.simple' },
  { id: 'medium', labelKey: 'examples.category.medium' },
  { id: 'hard', labelKey: 'examples.category.hard' },
]

// Deux boutons d'entrée appellent chacun leur fonction onClick(bool).
function buttonLed() {
  const b = builder()
  const toggle = createInputButtonModule('inputToggle', 'Toggle button', 1, { mode: 'toggle' })
  b.project.modules.push(toggle.module)
  b.project.nodes.push(...toggle.nodes)
  const hold = createInputButtonModule('inputHold', 'Hold button', 2, { mode: 'hold' })
  b.project.modules.push(hold.module)
  b.project.nodes.push(...hold.nodes)
  const led = createLedModule('inputLed', 'LED', 1, ledDefaults)
  b.project.modules.push(led.module)
  b.project.nodes.push(...led.nodes)
  const app = b.useModule('inputApp', 'Input app')
  b.liveFlag()
  const exportId = (module, name) => module.exports.find((entry) => entry.name === name).nodeId
  importFunction(app, 'inputLedImport', led.module.id, exportId(led.module, led.functions.setValue), 'setLed')

  // setToggle(value) recopie l'état du toggle dans la LED.
  b.root('inputToggleSet', 'FunctionDeclaration', { name: 'setToggle', type: voidType }, { parameters: ['inputToggleValue'], body: 'inputToggleSetBody' })
  b.make('inputToggleValue', 'Parameter', { name: 'value', type: booleanType })
  b.block('inputToggleSetBody', ['inputToggleSetStatement'])
  b.call('inputToggleSetCall', 'inputToggleSetCallee', ['inputToggleValueRef'])
  b.make('inputToggleSetCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'inputLedImport' } })
  b.ref('inputToggleValueRef', 'value')
  b.make('inputToggleSetStatement', 'ExpressionStatement', {}, { expression: 'inputToggleSetCall' })

  // setHold(value) est une impulsion : elle allume la LED une seule fois.
  b.root('inputHoldSet', 'FunctionDeclaration', { name: 'setHold', type: voidType }, { parameters: ['inputHoldValue'], body: 'inputHoldSetBody' })
  b.make('inputHoldValue', 'Parameter', { name: 'value', type: booleanType })
  b.block('inputHoldSetBody', ['inputHoldIf'])
  b.ifThen('inputHoldIf', 'inputHoldValueRef', 'inputHoldBody')
  b.ref('inputHoldValueRef', 'value')
  b.block('inputHoldBody', ['inputHoldSetStatement'])
  b.call('inputHoldSetCall', 'inputHoldSetCallee', ['inputHoldTrue'])
  b.make('inputHoldSetCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'inputLedImport' } })
  b.make('inputHoldTrue', 'Literal', { type: booleanType, value: true })
  b.make('inputHoldSetStatement', 'ExpressionStatement', {}, { expression: 'inputHoldSetCall' })

  b.stringValue('inputMessage', 'Two buttons and an LED')
  b.print('inputPrint', 'inputMessage')
  b.make('inputLoop', 'WhileStatement', {}, { test: 'inputLoopTest', body: 'inputLoopBody' })
  b.ref('inputLoopTest', 'SP3_LIVE')
  b.block('inputLoopBody', [])
  b.block('inputBody', ['inputPrint', 'inputLoop'])
  b.root('inputMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'inputBody' })

  // Lie chaque bouton à sa fonction ; l'import et l'export sont créés automatiquement.
  const toggleBinding = bindInputButtonCallback(b.project, toggle.module.id, 'inputToggleSet')
  const holdBinding = toggleBinding.ok ? bindInputButtonCallback(toggleBinding.project, hold.module.id, 'inputHoldSet') : toggleBinding
  const project = holdBinding.ok ? holdBinding.project : b.project

  return workspace(project, [
    note('inputNote', 'Two buttons and an LED', String.raw`Le toggle appelle setToggle(bool) immédiatement, puis toutes les 500 ms tant qu'il reste actif. Le bouton maintenu appelle setHold(bool) une seule fois avec true à l'appui. Les deux fonctions sont liées sur les cartes et importées par leur module ; setToggle recopie l'état dans la LED, setHold l'allume. $$\text{setToggle} : \text{LED} = \text{state},\quad \text{setHold} : \text{LED} = \text{true}$$`, 0, 1000, 1120, 240),
  ])
}

// Catalogue local, ouvrable sans réseau ni fichier externe, classé par difficulté puis par thème.
export const examples = [
  { id: 'fibonacci', labelKey: 'examples.fibonacci', category: 'medium', subcategory: 'basics', build: fibonacci },
  { id: 'recursion', labelKey: 'examples.recursion', category: 'medium', subcategory: 'basics', build: recursion },
  { id: 'arrays', labelKey: 'examples.arrays', category: 'simple', subcategory: 'arrays', build: arrays },
  { id: 'foreach', labelKey: 'examples.forEach', category: 'simple', subcategory: 'arrays', build: forEach },
  { id: 'sorting', labelKey: 'examples.sorting', category: 'medium', subcategory: 'sorting', build: sorting },
  { id: 'maths', labelKey: 'examples.maths', category: 'simple', subcategory: 'operations', build: maths },
  { id: 'imports', labelKey: 'examples.imports', category: 'simple', subcategory: 'modules', build: imports },
  { id: 'rgbLedDemo', labelKey: 'examples.rgbLedDemo', category: 'simple', subcategory: 'widgets', build: rgbLedDemo },
  { id: 'pointers', labelKey: 'examples.pointers', category: 'medium', subcategory: 'pointers', build: pointers },
  { id: 'higherOrder', labelKey: 'examples.higherOrder', category: 'medium', subcategory: 'functions', build: higherOrder },
  { id: 'quickSort', labelKey: 'examples.quickSort', category: 'hard', subcategory: 'sorting', build: quickSort },
  { id: 'coinChange', labelKey: 'examples.coinChange', category: 'hard', subcategory: 'dynamic', build: coinChange },
  { id: 'gaugeDemo', labelKey: 'examples.gaugeDemo', category: 'simple', subcategory: 'widgets', build: gaugeDemo },
  { id: 'carDashboard', labelKey: 'examples.carDashboard', category: 'medium', subcategory: 'widgets', build: carDashboard },
  { id: 'trafficControl', labelKey: 'examples.trafficControl', category: 'medium', subcategory: 'simulation', build: trafficControl },
  { id: 'dnaAnalyzer', labelKey: 'examples.dnaAnalyzer', category: 'medium', subcategory: 'widgets', build: dnaAnalyzer },
  { id: 'signalProcessing', labelKey: 'examples.signalProcessing', category: 'hard', subcategory: 'widgets', build: signalProcessing },
  { id: 'mandelbrotEscape', labelKey: 'examples.mandelbrotEscape', category: 'hard', subcategory: 'widgets', build: mandelbrotEscape },
  { id: 'collatzAtlas', labelKey: 'examples.collatzAtlas', category: 'medium', subcategory: 'widgets', build: collatzAtlas },
  { id: 'sortRace', labelKey: 'examples.sortRace', category: 'medium', subcategory: 'sorting', build: sortRace },
  { id: 'heatDiffusion', labelKey: 'examples.heatDiffusion', category: 'hard', subcategory: 'widgets', build: heatDiffusion },
  { id: 'imageConvolution', labelKey: 'examples.imageConvolution', category: 'hard', subcategory: 'widgets', build: imageConvolution },
  { id: 'weatherStation', labelKey: 'examples.weatherStation', category: 'medium', subcategory: 'widgets', build: weatherStation },
  { id: 'networkMonitor', labelKey: 'examples.networkMonitor', category: 'medium', subcategory: 'widgets', build: networkMonitor },
  { id: 'pixelScreens', labelKey: 'examples.pixelScreens', category: 'medium', subcategory: 'animation', build: pixelScreens },
  { id: 'rain', labelKey: 'examples.rain', category: 'medium', subcategory: 'animation', build: rain },
  { id: 'knapsack', labelKey: 'examples.knapsack', category: 'hard', subcategory: 'dynamic', build: knapsack },
  { id: 'calculus', labelKey: 'examples.calculus', category: 'hard', subcategory: 'operations', build: calculus },
  { id: 'gameOfLife', labelKey: 'examples.gameOfLife', category: 'hard', subcategory: 'automata', build: gameOfLife },
  { id: 'roverSurvey', labelKey: 'examples.roverSurvey', category: 'hard', subcategory: 'simulation', build: roverSurvey },
  { id: 'signalLab', labelKey: 'examples.signalLab', category: 'hard', subcategory: 'simulation', build: signalLab },
  { id: 'coral', labelKey: 'examples.coral', category: 'hard', subcategory: 'automata', build: coralGrowth },
  { id: 'labyrinth', labelKey: 'examples.labyrinth', category: 'hard', subcategory: 'automata', build: labyrinth },
  { id: 'starfield', labelKey: 'examples.starfield', category: 'hard', subcategory: 'animation', build: starfield },
  { id: 'colorFlow', labelKey: 'examples.colorFlow', category: 'medium', subcategory: 'animation', build: colorFlow },
  { id: 'rgbMixer', labelKey: 'examples.rgbMixer', category: 'medium', subcategory: 'widgets', build: rgbMixer },
  { id: 'functionPlot', labelKey: 'examples.functionPlot', category: 'medium', subcategory: 'widgets', build: functionPlot },
  { id: 'linearPlot', labelKey: 'examples.linearPlot', category: 'simple', subcategory: 'widgets', build: linearPlot },
  { id: 'waveInterference', labelKey: 'examples.waveInterference', category: 'medium', subcategory: 'widgets', build: waveInterference },
  { id: 'fourierSquare', labelKey: 'examples.fourierSquare', category: 'hard', subcategory: 'widgets', build: fourierSquare },
  { id: 'oscilloscopeDemo', labelKey: 'examples.oscilloscopeDemo', category: 'medium', subcategory: 'widgets', build: oscilloscopeDemo },
  { id: 'rotatingCube', labelKey: 'examples.rotatingCube', category: 'hard', subcategory: 'animation', build: rotatingCube },
  { id: 'rotatingTriangle', labelKey: 'examples.rotatingTriangle', category: 'medium', subcategory: 'animation', build: rotatingTriangle },
  { id: 'spirograph', labelKey: 'examples.spirograph', category: 'medium', subcategory: 'animation', build: spirograph },
  { id: 'sierpinskiChaos', labelKey: 'examples.sierpinskiChaos', category: 'hard', subcategory: 'animation', build: sierpinskiChaos },
  { id: 'pendulumWave', labelKey: 'examples.pendulumWave', category: 'medium', subcategory: 'animation', build: pendulumWave },
  ...[...widgetExamples, ...showcaseExamples].map((example) => ({
    ...example,
    build: () => {
      const { project, description, title } = example.build()
      const notesY = Math.ceil(project.modules.length / 3) * 520
      return workspace(project, [note(`${example.id}Note`, title, description, 0, notesY, 1120, 240)])
    },
  })),
  { id: 'buttonLed', labelKey: 'examples.buttonLed', category: 'simple', subcategory: 'input', build: buttonLed },
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
  { id: 'simulation', labelKey: 'examples.sub.simulation' },
  { id: 'input', labelKey: 'examples.sub.input' },
]
