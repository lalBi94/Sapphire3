import { createProject, createModule, createNode } from './logic/model.js'
import { bindInputNumberCallback } from './logic/index.js'
import { createInputNumberModule } from './inputNumberNode.js'
import { createScreenModule } from './screenNode.js'
import { createGaugeModule } from './gaugeNode.js'
import { createProgressModule } from './progressNode.js'
import { createBarChartModule } from './barChartNode.js'
import { createLedModule, ledDefaults } from './ledNode.js'
import { createRgbLedModule, rgbLedDefaults } from './rgbLedNode.js'
import { exerciseVersion } from './exercise.js'
import { builder, workspace } from './examples.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }

// Décrit une annotation Comment placée sous les cartes du modèle.
function note(id, name, text, y) {
  return { id, type: 'comment', name, x: 0, y, width: 1120, height: 240, expandedNodeIds: [], text }
}

// Place une note sous la dernière rangée de cartes.
function noteUnder(project, id, name, text) {
  return note(id, name, text, Math.ceil(project.modules.length / 3) * 520)
}

// Ajoute un appel à une fonction importée dans le module courant.
function importedCall(b, prefix, importId, args) {
  b.make(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
  b.call(`${prefix}Call`, `${prefix}Callee`, args)
  b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
  return `${prefix}Statement`
}

// Construit une classe minimale avec attributs privés, constructeur et méthodes publiques.
function classBuilder(id, name) {
  const module = createModule(id, name, 'class')
  const nodes = []
  let sequence = 0
  const make = (kind, properties = {}, children = {}, references = {}) => {
    const nodeId = `${id}:${++sequence}`
    nodes.push(createNode(nodeId, id, kind, { properties, children, references }))
    return nodeId
  }
  const member = (kind, properties = {}, children = {}, references = {}) => {
    const nodeId = make(kind, properties, children, references)
    module.rootNodeIds.push(nodeId)
    return nodeId
  }
  const read = (name) => make('Reference', {}, {}, { target: { kind: 'name', name } })
  const thisNode = () => make('ThisExpression')
  const memberAccess = (object, name) => make('MemberExpression', { name }, { object })
  const integer = (value) => make('Literal', { type: intType, value: String(value) })
  const op = (operator, left, right) => make('BinaryExpression', { operator }, { left, right })
  const assign = (target, value) => make('AssignmentStatement', {}, { target, value })
  const block = (statements) => make('Block', {}, { statements })
  const returnValue = (argument) => make('ReturnStatement', {}, { argument })
  const parameter = (name, type) => make('Parameter', { name, type })
  return { module, nodes, member, read, thisNode, memberAccess, integer, op, assign, block, returnValue, parameter }
}

// Modèle vide : un document neuf sans dossier ni carte.
function blankTemplate() {
  return workspace(createProject('workspace'), [])
}

// Modèle entrée → sortie : une entrée entière liée à une fonction qui imprime la valeur.
function inputOutputTemplate() {
  const b = builder('workspace')
  const input = createInputNumberModule('templateNumberInput', 'Number input', 1, { valueType: 'int' })
  b.project.modules.push(input.module)
  b.project.nodes.push(...input.nodes)
  b.useModule('templateInputApp', 'Input → output')
  b.liveFlag()

  // function onChange(value: int): void { Print(value); }
  b.root('templateOnChange', 'FunctionDeclaration', { name: 'onChange', type: voidType }, { parameters: ['templateOnChangeValue'], body: 'templateOnChangeBody' })
  b.make('templateOnChangeValue', 'Parameter', { name: 'value', type: intType })
  b.block('templateOnChangeBody', ['templateOnChangePrint'])
  b.print('templateOnChangePrint', 'templateOnChangeValueRef')
  b.ref('templateOnChangeValueRef', 'value')

  // main: Print("Ready"); while SP3_LIVE { }
  b.root('templateInputMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'templateInputBody' })
  b.stringValue('templateReady', 'Ready')
  b.print('templateReadyPrint', 'templateReady')
  b.make('templateInputLoopTest', 'Reference', {}, {}, { target: { kind: 'name', name: 'SP3_LIVE' } })
  b.block('templateInputLoopBody', [])
  b.make('templateInputLoop', 'WhileStatement', {}, { test: 'templateInputLoopTest', body: 'templateInputLoopBody' })
  b.block('templateInputBody', ['templateReadyPrint', 'templateInputLoop'])

  const bound = bindInputNumberCallback(b.project, input.module.id, 'templateOnChange')
  if (!bound.ok) throw new Error(`Input template binding failed: ${bound.code ?? 'unknown'}`)
  return workspace(bound.project, [
    noteUnder(bound.project, 'templateInputNote', 'Input → output', 'Modifiez la valeur de Number input : la fonction onChange(int) liée imprime la nouvelle valeur dans Output. Le programme principal reste en veille avec SP3_LIVE ; ajoutez vos propres instructions autour de ce point de départ.'),
  ])
}

// Modèle tableau de bord : écran, jauge, progression, barres, LED et LED RVB animés.
function widgetDashboardTemplate() {
  const b = builder('workspace')
  const screen = createScreenModule('templateScreen', 'Dashboard screen', 1, { width: 32, height: 10 })
  const gauge = createGaugeModule('templateGauge', 'Level', 1, { min: 0, max: 100 })
  const progress = createProgressModule('templateProgress', 'Progress', 1, { min: 0, max: 100 })
  const chart = createBarChartModule('templateChart', 'Bars', 1, { size: 8 })
  const led = createLedModule('templateLed', 'Blink', 1, ledDefaults)
  const rgb = createRgbLedModule('templateRgb', 'Color', 1, rgbLedDefaults)
  b.project.modules.push(screen.module, gauge.module, progress.module, chart.module, led.module, rgb.module)
  b.project.nodes.push(...screen.nodes, ...gauge.nodes, ...progress.nodes, ...chart.nodes, ...led.nodes, ...rgb.nodes)
  const app = b.useModule('templateDashboardApp', 'Dashboard')
  b.liveFlag()

  const exported = (widget, name) => widget.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'templatePixelImport', moduleId: screen.module.id, nodeId: exported(screen, screen.functions.setPixel), localName: 'setPixel' },
    { id: 'templatePresentImport', moduleId: screen.module.id, nodeId: exported(screen, screen.functions.present), localName: 'present' },
    { id: 'templateGaugeImport', moduleId: gauge.module.id, nodeId: exported(gauge, gauge.functions.setValue), localName: 'setGauge' },
    { id: 'templateProgressImport', moduleId: progress.module.id, nodeId: exported(progress, progress.functions.setValue), localName: 'setProgress' },
    { id: 'templateBarImport', moduleId: chart.module.id, nodeId: exported(chart, chart.functions.setValue), localName: 'setBar' },
    { id: 'templateLedImport', moduleId: led.module.id, nodeId: exported(led, led.functions.setValue), localName: 'setLed' },
    { id: 'templateRgbImport', moduleId: rgb.module.id, nodeId: exported(rgb, rgb.functions.setColor), localName: 'setColor' },
  )

  // main: 48 images d'animation, puis un message.
  b.root('templateDashMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'templateDashBody' })
  b.make('templateDashFrame', 'VariableDeclaration', { name: 'frame', type: intType }, { initializer: 'templateDashFrameStart' })
  b.intValue('templateDashFrameStart', 0)
  b.liveTest('templateDashFrame', 'templateDashFrameRead', 'templateDashFrameEnd')
  b.ref('templateDashFrameRead', 'frame')
  b.intValue('templateDashFrameEnd', 48)
  b.make('templateDashFrameUpdate', 'AssignmentStatement', {}, { target: 'templateDashFrameTarget', value: 'templateDashFrameNext' })
  b.ref('templateDashFrameTarget', 'frame')
  b.binary('templateDashFrameNext', '+', 'templateDashFrameNextRead', 'templateDashFrameOne')
  b.ref('templateDashFrameNextRead', 'frame')
  b.intValue('templateDashFrameOne', 1)

  // level = frame % 100
  b.make('templateDashLevel', 'VariableDeclaration', { name: 'level', type: intType }, { initializer: 'templateDashLevelValue' })
  b.binary('templateDashLevelValue', '%', 'templateDashLevelRead', 'templateDashHundred')
  b.ref('templateDashLevelRead', 'frame')
  b.intValue('templateDashHundred', 100)
  b.make('templateDashLevelDouble', 'CastExpression', { type: doubleType }, { argument: 'templateDashLevelRef' })
  b.ref('templateDashLevelRef', 'level')
  b.make('templateDashLevelDoubleProgress', 'CastExpression', { type: doubleType }, { argument: 'templateDashLevelRefProgress' })
  b.ref('templateDashLevelRefProgress', 'level')

  const gaugeCall = importedCall(b, 'templateDashGauge', 'templateGaugeImport', ['templateDashLevelDouble'])
  const progressCall = importedCall(b, 'templateDashProgress', 'templateProgressImport', ['templateDashLevelDoubleProgress'])
  b.intValue('templateDashZero', 0)
  b.ref('templateDashLevelBar', 'level')
  const bar0 = importedCall(b, 'templateDashBar0', 'templateBarImport', ['templateDashZero', 'templateDashLevelBar'])
  b.intValue('templateDashHundredBar', 100)
  b.binary('templateDashBarOneValue', '-', 'templateDashHundredBar', 'templateDashLevelBarTwo')
  b.ref('templateDashLevelBarTwo', 'level')
  b.intValue('templateDashOne', 1)
  const bar1 = importedCall(b, 'templateDashBar1', 'templateBarImport', ['templateDashOne', 'templateDashBarOneValue'])

  // LED : frame % 2 == 0.
  b.binary('templateDashMod', '%', 'templateDashFrameReadLed', 'templateDashTwo')
  b.ref('templateDashFrameReadLed', 'frame')
  b.intValue('templateDashTwo', 2)
  b.intValue('templateDashZeroLed', 0)
  b.binary('templateDashEven', '==', 'templateDashMod', 'templateDashZeroLed')
  const ledCall = importedCall(b, 'templateDashLed', 'templateLedImport', ['templateDashEven'])

  // LED RVB : (level, 255 - level, 128).
  b.intValue('templateDashRgbMax', 255)
  b.binary('templateDashRgbGreen', '-', 'templateDashRgbMax', 'templateDashLevelRgb')
  b.ref('templateDashLevelRgb', 'level')
  b.ref('templateDashRgbRed', 'level')
  b.intValue('templateDashRgbBlue', 128)
  const rgbCall = importedCall(b, 'templateDashRgb', 'templateRgbImport', ['templateDashRgbRed', 'templateDashRgbGreen', 'templateDashRgbBlue'])

  // Pixel mobile : (frame % 10) * 32 + (frame % 32).
  b.binary('templateDashRow', '%', 'templateDashRowFrame', 'templateDashHeight')
  b.ref('templateDashRowFrame', 'frame')
  b.intValue('templateDashHeight', 10)
  b.binary('templateDashRowOffset', '*', 'templateDashRow', 'templateDashWidth')
  b.intValue('templateDashWidth', 32)
  b.binary('templateDashColumn', '%', 'templateDashColumnFrame', 'templateDashWidthColumn')
  b.ref('templateDashColumnFrame', 'frame')
  b.intValue('templateDashWidthColumn', 32)
  b.binary('templateDashIndex', '+', 'templateDashRowOffset', 'templateDashColumn')
  b.intValue('templateDashRed', 255)
  b.intValue('templateDashGreen', 213)
  b.intValue('templateDashBlue', 71)
  b.intValue('templateDashAlpha', 255)
  const pixelCall = importedCall(b, 'templateDashPixel', 'templatePixelImport', ['templateDashIndex', 'templateDashRed', 'templateDashGreen', 'templateDashBlue', 'templateDashAlpha'])
  const presentCall = importedCall(b, 'templateDashPresent', 'templatePresentImport', [])

  b.block('templateDashLoopBody', ['templateDashLevel', gaugeCall, progressCall, bar0, bar1, ledCall, rgbCall, pixelCall, presentCall, 'templateDashFrameUpdate'])
  b.make('templateDashLoop', 'WhileStatement', {}, { test: 'templateDashFrameTest', body: 'templateDashLoopBody' })
  b.stringValue('templateDashMessage', 'Dashboard ready')
  b.print('templateDashPrint', 'templateDashMessage')
  b.block('templateDashBody', ['templateDashFrame', 'templateDashLoop', 'templateDashPrint'])

  return workspace(b.project, [
    noteUnder(b.project, 'templateDashboardNote', 'Dashboard', 'Ce modèle anime un écran, une jauge, une barre de progression, un graphique à barres, une LED et une LED RVB. Le pixel se déplace sur l’écran, la jauge et la progression suivent le niveau, les barres se croisent et les LED changent de couleur. Run live est actif par défaut ; le Run borné garde 48 images.'),
  ])
}

// Modèle classe + instance : une classe Counter privée, instanciée et utilisée par main.
function classInstanceTemplate() {
  const counter = classBuilder('templateCounterClass', 'Counter')
  counter.member('VariableDeclaration', { name: 'value', type: intType, visibility: 'private' }, { initializer: counter.integer(0) })
  const constructorBody = counter.block([counter.assign(counter.memberAccess(counter.thisNode(), 'value'), counter.read('start'))])
  counter.member('FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: [counter.parameter('start', intType)], body: constructorBody })
  const addBody = counter.block([counter.assign(counter.memberAccess(counter.thisNode(), 'value'), counter.op('+', counter.memberAccess(counter.thisNode(), 'value'), counter.read('delta')))])
  counter.member('FunctionDeclaration', { name: 'add', type: voidType, visibility: 'public' }, { parameters: [counter.parameter('delta', intType)], body: addBody })
  const getBody = counter.block([counter.returnValue(counter.memberAccess(counter.thisNode(), 'value'))])
  counter.member('FunctionDeclaration', { name: 'get', type: intType, visibility: 'public' }, { parameters: [], body: getBody })

  const b = builder('workspace')
  b.project.modules.push(counter.module)
  b.project.nodes.push(...counter.nodes)
  b.useModule('templateClassApp', 'Class demo')
  b.root('templateClassMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'templateClassBody' })
  b.make('templateCounterDecl', 'VariableDeclaration', { name: 'counter', type: { kind: 'class', classId: 'templateCounterClass' } }, { initializer: 'templateCounterNew' })
  b.make('templateCounterNew', 'NewExpression', { classId: 'templateCounterClass' }, { arguments: ['templateCounterStart'] })
  b.intValue('templateCounterStart', 1)
  b.make('templateAddStatement', 'ExpressionStatement', {}, { expression: 'templateAddCall' })
  b.call('templateAddCall', 'templateAddCallee', ['templateAddTwo'])
  b.make('templateAddCallee', 'MemberExpression', { name: 'add' }, { object: 'templateAddCounter' })
  b.ref('templateAddCounter', 'counter')
  b.intValue('templateAddTwo', 2)
  b.print('templateClassPrint', 'templateGetCall')
  b.call('templateGetCall', 'templateGetCallee', [])
  b.make('templateGetCallee', 'MemberExpression', { name: 'get' }, { object: 'templateGetCounter' })
  b.ref('templateGetCounter', 'counter')
  b.block('templateClassBody', ['templateCounterDecl', 'templateAddStatement', 'templateClassPrint'])

  return workspace(b.project, [
    noteUnder(b.project, 'templateClassNote', 'Class + instance', 'Counter garde son attribut value privé. Le constructeur l’initialise, add(delta) le modifie et get() le retourne. main crée une instance avec new, ajoute 2 puis imprime le résultat. Modifiez la classe ou ajoutez une seconde instance pour poursuivre.'),
  ])
}

// Modèle exercice : une fonction sum incomplète et un test prêt à vérifier.
function exerciseTemplate() {
  const b = builder('workspace')
  b.useModule('templateExerciseApp', 'Exercise')
  b.root('templateSum', 'FunctionDeclaration', { name: 'sum', type: intType }, { parameters: ['templateSumA', 'templateSumB'], body: 'templateSumBody' })
  b.make('templateSumA', 'Parameter', { name: 'a', type: intType })
  b.make('templateSumB', 'Parameter', { name: 'b', type: intType })
  b.block('templateSumBody', ['templateSumReturn'])
  b.returnValue('templateSumReturn', 'templateSumZero')
  b.intValue('templateSumZero', 0)
  b.root('templateExerciseMain', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'templateExerciseBody' })
  b.print('templateExercisePrint', 'templateExerciseCall')
  b.call('templateExerciseCall', 'templateExerciseSumRef', ['templateExerciseTwo', 'templateExerciseThree'])
  b.ref('templateExerciseSumRef', 'sum')
  b.intValue('templateExerciseTwo', 2)
  b.intValue('templateExerciseThree', 3)
  b.block('templateExerciseBody', ['templateExercisePrint'])

  const result = workspace(b.project, [
    noteUnder(b.project, 'templateExerciseNote', 'Exercise', 'Complétez la fonction sum(a, b) pour retourner la somme de deux entiers. Le panneau Exercise contient le test sum(2, 3) = 5. Utilisez Check pour vérifier, puis Reset to starter pour revenir à ce point de départ.'),
  ])
  const starter = JSON.parse(JSON.stringify({ project: result.project, presentation: result.presentation }))
  result.exercise = {
    version: exerciseVersion,
    title: 'Somme de deux entiers',
    instructions: 'Complétez la fonction sum(a, b) pour qu’elle retourne la somme de a et b.',
    starter,
    tests: [
      { id: 'template-exercise-sum', kind: 'function', title: 'sum(2, 3) = 5', functionName: 'sum', args: [2, 3], expectedReturn: '5' },
    ],
  }
  return result
}

// Catalogue des modèles de workspace proposés dans la barre de navigation.
export const workspaceTemplates = [
  { id: 'blank', labelKey: 'templates.blank', descriptionKey: 'templates.blankDescription', build: blankTemplate },
  { id: 'inputOutput', labelKey: 'templates.inputOutput', descriptionKey: 'templates.inputOutputDescription', build: inputOutputTemplate },
  { id: 'widgetDashboard', labelKey: 'templates.widgetDashboard', descriptionKey: 'templates.widgetDashboardDescription', build: widgetDashboardTemplate },
  { id: 'classInstance', labelKey: 'templates.classInstance', descriptionKey: 'templates.classInstanceDescription', build: classInstanceTemplate },
  { id: 'exercise', labelKey: 'templates.exercise', descriptionKey: 'templates.exerciseDescription', build: exerciseTemplate },
]
