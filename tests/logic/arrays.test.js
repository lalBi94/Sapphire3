import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeProgram, serializeSource, deserializeSource, simulateProgram, getAvailableActions, createContextIndex, createNodeBundle, insertSourceNodes, primitiveType, arrayType } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType } from './fixtures.js'

const intList = { kind: 'array', elementType: intType }
const stringType = { kind: 'primitive', name: 'string' }
const floatType = { kind: 'primitive', name: 'float' }
const voidType = { kind: 'primitive', name: 'void' }
const literal = (source, id, type, value) => node(source, 't', id, 'Literal', { type, value })
const reference = (source, id, target) => node(source, 't', id, 'Reference', {}, {}, { target: { kind: 'node', nodeId: target } })

// Variable tableau initialisée par un littéral, avec un point d'entrée qui imprime un élément.
function arrayProgram() {
  const source = program('t')
  root(source, 't', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(source, 't', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  literal(source, 'one', intType, 1)
  literal(source, 'two', intType, 2)
  literal(source, 'three', intType, 3)
  root(source, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: ['print'] })
  node(source, 't', 'print', 'PrintStatement', {}, { value: 'access' })
  node(source, 't', 'access', 'ArrayAccess', {}, { array: 'arrRef', index: 'index' })
  reference(source, 'arrRef', 'arr')
  literal(source, 'index', intType, 1)
  return source
}

// Crée un tableau local, modifie un élément, puis imprime un autre élément.
function filledProgram() {
  const source = program('t')
  root(source, 't', 'buffer', 'VariableDeclaration', { name: 'buffer', type: intList }, { initializer: 'creation' })
  node(source, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: 'fill' })
  literal(source, 'size', intType, 3)
  literal(source, 'fill', intType, 7)
  root(source, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: ['assign', 'print', 'return'] })
  node(source, 't', 'assign', 'AssignmentStatement', {}, { target: 'access', value: 'nine' })
  node(source, 't', 'access', 'ArrayAccess', {}, { array: 'bufferRef', index: 'two' })
  reference(source, 'bufferRef', 'buffer')
  literal(source, 'two', intType, 2)
  literal(source, 'nine', intType, 9)
  node(source, 't', 'print', 'PrintStatement', {}, { value: 'read' })
  node(source, 't', 'read', 'ArrayAccess', {}, { array: 'bufferRef2', index: 'zero' })
  reference(source, 'bufferRef2', 'buffer')
  literal(source, 'zero', intType, 0)
  node(source, 't', 'return', 'ReturnStatement', {}, { argument: null })
  return source
}

test('tableaux : un type tableau annoté accepte un littéral du même type d’élément', () => {
  const analysis = analyzeProgram(arrayProgram())
  assert.equal(analysis.canGenerate, true, JSON.stringify(analysis.diagnostics))
  const variableType = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'arr')?.type
  assert.deepEqual(variableType, arrayType(primitiveType('int')))
  const accessType = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'access')?.type
  assert.deepEqual(accessType, primitiveType('int'))
})

test('tableaux : une variable scalaire refuse un initialiseur tableau (le cas rapporté)', () => {
  const source = program('t')
  root(source, 't', 'v', 'VariableDeclaration', { name: 'v', type: intType }, { initializer: 'creation' })
  node(source, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: 'fill' })
  literal(source, 'size', intType, 2)
  literal(source, 'fill', intType, 0)
  const analysis = analyzeProgram(source)
  assert.equal(analysis.canGenerate, false)
  assert.equal(analysis.diagnostics.some(({ code, location }) => code === 'TYPE_MISMATCH' && location.field === 'children.initializer'), true)
})

test('tableaux : éléments hétérogènes et annotations d’élément invalides sont diagnostiqués', () => {
  const mixed = program('t')
  root(mixed, 't', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(mixed, 't', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'text'] })
  literal(mixed, 'one', intType, 1)
  literal(mixed, 'text', stringType, 'x')
  const mixedAnalysis = analyzeProgram(mixed)
  assert.equal(mixedAnalysis.canGenerate, false)
  assert.equal(mixedAnalysis.diagnostics.some(({ code, location }) => code === 'TYPE_MISMATCH' && location.field === 'children.elements[1]'), true)

  const missing = program('t')
  root(missing, 't', 'list', 'VariableDeclaration', { name: 'list', type: intList }, { initializer: 'literal' })
  node(missing, 't', 'literal', 'ArrayLiteral', {}, { elements: [] })
  assert.equal(analyzeProgram(missing).diagnostics.some(({ code, location }) => code === 'TYPE_REQUIRED' && location.field === 'properties.elementType'), true)

  const voidElements = program('t')
  root(voidElements, 't', 'list', 'VariableDeclaration', { name: 'list', type: intList }, { initializer: 'literal' })
  node(voidElements, 't', 'literal', 'ArrayLiteral', { elementType: voidType }, { elements: [] })
  assert.equal(analyzeProgram(voidElements).diagnostics.some(({ code, location }) => code === 'TYPE_INVALID' && location.field === 'properties.elementType'), true)
})

test('tableaux : le type tableau reste réservé aux variables, constantes et paramètres', () => {
  const source = program('t')
  root(source, 't', 'entry', 'FunctionDeclaration', { name: 'entry', type: intList, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: [] })
  const analysis = analyzeProgram(source)
  assert.equal(analysis.diagnostics.some(({ code, location }) => code === 'TYPE_INVALID' && location.nodeId === 'entry' && location.field === 'properties.type'), true)

  const literalSource = program('t')
  root(literalSource, 't', 'entry', 'FunctionDeclaration', { name: 'entry', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(literalSource, 't', 'body', 'Block', {}, { statements: ['print'] })
  node(literalSource, 't', 'print', 'PrintStatement', {}, { value: 'bad' })
  node(literalSource, 't', 'bad', 'Literal', { type: intList, value: 'x' })
  assert.equal(analyzeProgram(literalSource).diagnostics.some(({ code, location }) => code === 'TYPE_INVALID' && location.nodeId === 'bad'), true)
})

test('tableaux : taille et index exigent des expressions entières', () => {
  const source = program('t')
  root(source, 't', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'creation' })
  node(source, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: null })
  literal(source, 'size', floatType, '1.5')
  assert.equal(analyzeProgram(source).diagnostics.some(({ code, location }) => code === 'TYPE_MISMATCH' && location.field === 'children.size'), true)

  const indexed = program('t')
  root(indexed, 't', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, {})
  root(indexed, 't', 'entry', 'FunctionDeclaration', { name: 'entry', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(indexed, 't', 'body', 'Block', {}, { statements: [] })
  node(indexed, 't', 'bad', 'ArrayAccess', {}, { array: 'arrRef', index: 'indexRef' })
  reference(indexed, 'arrRef', 'arr')
  reference(indexed, 'indexRef', 'arr')
  const analysis = analyzeProgram(indexed)
  assert.equal(analysis.diagnostics.some(({ code, location }) => code === 'TYPE_MISMATCH' && location.field === 'children.index'), true)
})

test('tableaux : un élément de tableau est une cible d’affectation contrôlée', () => {
  const source = filledProgram()
  const analysis = analyzeProgram(source)
  assert.equal(analysis.canGenerate, true, JSON.stringify(analysis.diagnostics))
  assert.equal(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'access')?.type?.name, 'int')

  const badValue = filledProgram()
  badValue.nodes.find((entry) => entry.id === 'nine').properties = { type: stringType, value: 'x' }
  assert.equal(analyzeProgram(badValue).diagnostics.some(({ code, location }) => code === 'TYPE_MISMATCH' && location.nodeId === 'assign' && location.field === 'children.value'), true)

  const constant = program('t')
  root(constant, 't', 'arr', 'ConstantDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(constant, 't', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one'] })
  literal(constant, 'one', intType, 1)
  root(constant, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(constant, 't', 'body', 'Block', {}, { statements: ['assign'] })
  node(constant, 't', 'assign', 'AssignmentStatement', {}, { target: 'access', value: 'nine' })
  node(constant, 't', 'access', 'ArrayAccess', {}, { array: 'arrRef', index: 'zero' })
  reference(constant, 'arrRef', 'arr')
  literal(constant, 'zero', intType, 0)
  literal(constant, 'nine', intType, 9)
  assert.equal(analyzeProgram(constant).diagnostics.some(({ code, location }) => code === 'PLACEMENT_ILLEGAL' && location.nodeId === 'assign' && location.field === 'children.target'), true)
})

test('tableaux : le menu ne propose un tableau que si le slot en attend un', () => {
  const source = program('t')
  root(source, 't', 'scalar', 'VariableDeclaration', { name: 'scalar', type: intType }, {})
  root(source, 't', 'array', 'VariableDeclaration', { name: 'array', type: intList }, {})
  const analysis = analyzeProgram(source)
  const index = createContextIndex(source, analysis)
  const scalarActions = getAvailableActions(source, 'scalar', 'initializer', { index })
  assert.equal(scalarActions.actions.some((action) => action.kind === 'ArrayLiteral'), false)
  assert.equal(scalarActions.actions.some((action) => action.kind === 'ArrayCreation'), false)
  const arrayActions = getAvailableActions(source, 'array', 'initializer', { index })
  assert.equal(arrayActions.actions.some((action) => action.kind === 'ArrayLiteral'), true)
  assert.equal(arrayActions.actions.some((action) => action.kind === 'ArrayCreation'), true)
})

test('tableaux : l’insertion refuse un tableau incompatible et accepte le même type d’élément', () => {
  const source = program('t')
  root(source, 't', 'scalar', 'VariableDeclaration', { name: 'scalar', type: intType }, {})
  root(source, 't', 'array', 'VariableDeclaration', { name: 'array', type: intList }, {})
  const analysis = analyzeProgram(source)
  const index = createContextIndex(source, analysis)
  let sequence = 0
  const draft = (elementType) => createNodeBundle('t', { kind: 'ArrayLiteral', properties: { elementType }, children: { elements: [] } }, () => `fresh${sequence += 1}`)
  // Un slot scalaire ne propose même pas la construction : refus avant toute mutation.
  assert.equal(insertSourceNodes(source, { targetId: 'scalar', slot: 'initializer' }, draft(intType), { index }).code, 'PLACEMENT_ILLEGAL')
  // Un tableau d'éléments d'un autre type est refusé par la contrainte de résultat.
  assert.equal(insertSourceNodes(source, { targetId: 'array', slot: 'initializer' }, draft(stringType), { index }).code, 'TYPE_MISMATCH')
  assert.equal(insertSourceNodes(source, { targetId: 'array', slot: 'initializer' }, draft(intType), { index }).ok, true)
})

test('tableaux : simulation des littéraux, accès, écriture d’élément et paramètres tableau', () => {
  const result = simulateProgram(arrayProgram())
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.output, ['2'])

  const filledResult = simulateProgram(filledProgram())
  assert.equal(filledResult.ok, true, filledResult.error)
  assert.deepEqual(filledResult.output, ['7'])

  const parameter = program('t')
  root(parameter, 't', 'sum', 'FunctionDeclaration', { name: 'sum', type: intType }, { parameters: ['values'], body: 'sumBody' })
  node(parameter, 't', 'values', 'Parameter', { name: 'values', type: intList })
  node(parameter, 't', 'sumBody', 'Block', {}, { statements: ['returnSum'] })
  node(parameter, 't', 'returnSum', 'ReturnStatement', {}, { argument: 'add' })
  node(parameter, 't', 'add', 'BinaryExpression', { operator: '+' }, { left: 'first', right: 'second' })
  node(parameter, 't', 'first', 'ArrayAccess', {}, { array: 'valuesRef', index: 'indexZero' })
  node(parameter, 't', 'second', 'ArrayAccess', {}, { array: 'valuesRef2', index: 'indexOne' })
  reference(parameter, 'valuesRef', 'values')
  reference(parameter, 'valuesRef2', 'values')
  literal(parameter, 'indexZero', intType, 0)
  literal(parameter, 'indexOne', intType, 1)
  root(parameter, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'startBody' })
  node(parameter, 't', 'startBody', 'Block', {}, { statements: ['print'] })
  node(parameter, 't', 'print', 'PrintStatement', {}, { value: 'call' })
  node(parameter, 't', 'call', 'CallExpression', {}, { callee: 'sumRef', arguments: ['list'] })
  reference(parameter, 'sumRef', 'sum')
  node(parameter, 't', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['ten', 'twenty'] })
  literal(parameter, 'ten', intType, 10)
  literal(parameter, 'twenty', intType, 20)
  const parameterResult = simulateProgram(parameter)
  assert.equal(parameterResult.ok, true, parameterResult.error)
  assert.deepEqual(parameterResult.output, ['30'])
})

test('tableaux : bornes, cases jamais remplies et budget limitent la simulation', () => {
  const bounds = arrayProgram()
  bounds.nodes.find((entry) => entry.id === 'index').properties.value = 3
  assert.equal(simulateProgram(bounds).errorCode, 'SIMULATION_ARRAY_BOUNDS')

  const unfilled = program('t')
  root(unfilled, 't', 'buffer', 'VariableDeclaration', { name: 'buffer', type: intList }, { initializer: 'creation' })
  node(unfilled, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: null })
  literal(unfilled, 'size', intType, 2)
  root(unfilled, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(unfilled, 't', 'body', 'Block', {}, { statements: ['print'] })
  node(unfilled, 't', 'print', 'PrintStatement', {}, { value: 'read' })
  node(unfilled, 't', 'read', 'ArrayAccess', {}, { array: 'bufferRef', index: 'zero' })
  reference(unfilled, 'bufferRef', 'buffer')
  literal(unfilled, 'zero', intType, 0)
  assert.equal(simulateProgram(unfilled).errorCode, 'SIMULATION_UNINITIALIZED')

  const huge = program('t')
  root(huge, 't', 'buffer', 'VariableDeclaration', { name: 'buffer', type: intList }, { initializer: 'creation' })
  node(huge, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: null })
  literal(huge, 'size', intType, 100000)
  root(huge, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'hugeBody' })
  node(huge, 't', 'hugeBody', 'Block', {}, { statements: [] })
  assert.equal(simulateProgram(huge).errorCode, 'SIMULATION_STEP_LIMIT')

  const negative = program('t')
  root(negative, 't', 'buffer', 'VariableDeclaration', { name: 'buffer', type: intList }, { initializer: 'creation' })
  node(negative, 't', 'creation', 'ArrayCreation', { elementType: intType }, { size: 'size', initializer: null })
  literal(negative, 'size', intType, -1)
  root(negative, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'negativeBody' })
  node(negative, 't', 'negativeBody', 'Block', {}, { statements: [] })
  assert.equal(simulateProgram(negative).errorCode, 'SIMULATION_ARRAY_BOUNDS')
})

test('tableaux : le debug capture un résumé borné, jamais un tableau mutable', () => {
  const result = simulateProgram(arrayProgram(), { captureDebug: true })
  assert.equal(result.ok, true)
  const bound = result.debugFrames.flatMap((frame) => frame.globals).filter((entry) => entry.name === 'arr' && entry.initialized)
  assert.equal(bound.length > 0, true)
  assert.equal(typeof bound[bound.length - 1].value, 'string')
  assert.match(bound[bound.length - 1].value, /\[/)
})

test('tableaux : la source avec types tableau survit à un aller-retour JSON', () => {
  const source = arrayProgram()
  const saved = serializeSource(source)
  assert.notEqual(saved.json, null)
  const restored = deserializeSource(saved.json)
  assert.deepEqual(restored.source, source)
})

test('tableaux : le JavaScript généré exécute les mêmes accès et écritures que le simulateur', () => {
  const source = arrayProgram()
  const simulation = simulateProgram(source)
  const generated = transpileProgram(source)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  const output = execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8' })
  assert.equal(output, simulation.output.map((line) => `${line}\n`).join(''))

  const filledSimulation = simulateProgram(filledProgram())
  const filledGenerated = transpileProgram(filledProgram())
  assert.equal(filledGenerated.ok, true)
  const filledOutput = execFileSync(process.execPath, ['-e', filledGenerated.code], { encoding: 'utf8' })
  assert.equal(filledOutput, filledSimulation.output.map((line) => `${line}\n`).join(''))

  const bounds = arrayProgram()
  bounds.nodes.find((entry) => entry.id === 'index').properties.value = 3
  const generatedBounds = transpileProgram(bounds)
  assert.equal(generatedBounds.ok, true)
  assert.throws(() => execFileSync(process.execPath, ['-e', generatedBounds.code], { encoding: 'utf8' }), /SIMULATION_ARRAY_BOUNDS/)
})

test('tableaux : le backend Python génère les constructions et helpers de liste', () => {
  const generated = transpileProgram(arrayProgram(), { target: 'python' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /sapphireElement/)
  assert.match(generated.code, /\[\(1\), \(2\), \(3\)\]/)
})

test('tableaux : un index en variable, en expression ou issu d’un autre accès est accepté', () => {
  const uintType = primitiveType('uint')
  const source = program('t')
  root(source, 't', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(source, 't', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['zero', 'one', 'two'] })
  literal(source, 'zero', intType, 5)
  literal(source, 'one', intType, 6)
  literal(source, 'two', intType, 7)
  root(source, 't', 'cursor', 'VariableDeclaration', { name: 'cursor', type: uintType }, { initializer: 'cursorValue' })
  literal(source, 'cursorValue', uintType, 1)
  root(source, 't', 'steps', 'VariableDeclaration', { name: 'steps', type: intList }, { initializer: 'stepsList' })
  node(source, 't', 'stepsList', 'ArrayLiteral', { elementType: intType }, { elements: ['stepZero', 'stepOne'] })
  literal(source, 'stepZero', intType, 0)
  literal(source, 'stepOne', intType, 1)
  root(source, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: ['printCursor', 'printSum', 'printNested'] })
  node(source, 't', 'printCursor', 'PrintStatement', {}, { value: 'accessCursor' })
  node(source, 't', 'accessCursor', 'ArrayAccess', {}, { array: 'arrRef', index: 'cursorRef' })
  reference(source, 'arrRef', 'arr')
  reference(source, 'cursorRef', 'cursor')
  node(source, 't', 'printSum', 'PrintStatement', {}, { value: 'accessSum' })
  node(source, 't', 'accessSum', 'ArrayAccess', {}, { array: 'arrRef2', index: 'sum' })
  reference(source, 'arrRef2', 'arr')
  node(source, 't', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'cursorRef2', right: 'stepOneAsUint' })
  reference(source, 'cursorRef2', 'cursor')
  literal(source, 'stepOneAsUint', uintType, 1)
  node(source, 't', 'printNested', 'PrintStatement', {}, { value: 'accessNested' })
  node(source, 't', 'accessNested', 'ArrayAccess', {}, { array: 'arrRef3', index: 'innerAccess' })
  reference(source, 'arrRef3', 'arr')
  node(source, 't', 'innerAccess', 'ArrayAccess', {}, { array: 'stepsRef', index: 'cursorRef3' })
  reference(source, 'stepsRef', 'steps')
  reference(source, 'cursorRef3', 'cursor')
  const analysis = analyzeProgram(source)
  assert.equal(analysis.canGenerate, true, JSON.stringify(analysis.diagnostics))
  const result = simulateProgram(source)
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.output, ['6', '7', '6'])
})
