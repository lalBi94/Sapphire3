import { createModule, createNode } from './logic/model.js'
import {
  maximumOscilloscopeChannels,
  maximumOscilloscopeSamples,
  minimumOscilloscopeSamples,
  oscilloscopeChannelName,
  oscilloscopeDefaultSamples,
  oscilloscopeGlobalName,
} from './logic/oscilloscopeState.js'

export {
  maximumOscilloscopeChannels,
  maximumOscilloscopeSamples,
  minimumOscilloscopeSamples,
  oscilloscopeDefaultSamples,
  oscilloscopeGlobalName,
} from './logic/oscilloscopeState.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const doubleArrayType = { kind: 'array', elementType: doubleType }
const functionType = { kind: 'function', parameters: [doubleType], returnType: doubleType }

// Produit le nom stable d'une fonction interne à un oscilloscope.
export function oscilloscopeFunctionName(kind, index) {
  return `OSC_SP3_${kind}_${index}`
}

// Crée le module caché d'un oscilloscope multicanal, sans nouveau type logique.
export function createOscilloscopeModule(moduleId, name, index, options = {}) {
  const samples = Number.isInteger(options.samples) && options.samples > 0
    ? Math.max(minimumOscilloscopeSamples, Math.min(options.samples, maximumOscilloscopeSamples))
    : oscilloscopeDefaultSamples
  const module = createModule(moduleId, name)
  module.oscilloscope = { index, samples }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `oscilloscope:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const intValue = (suffix, value) => node(suffix, 'Literal', { type: intType, value: String(value) })
  const doubleValue = (suffix, value) => node(suffix, 'Literal', { type: doubleType, value: String(value) })
  const boolValue = (suffix, value) => node(suffix, 'Literal', { type: booleanType, value })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const binary = (suffix, operator, left, right) => node(suffix, 'BinaryExpression', { operator }, { left, right })
  const unary = (suffix, operator, operand) => node(suffix, 'UnaryExpression', { operator }, { operand })
  const access = (suffix, array, indexNode) => node(suffix, 'ArrayAccess', {}, { array, index: indexNode })
  const call = (suffix, callee, args) => node(suffix, 'CallExpression', {}, { callee, arguments: args })
  const cast = (suffix, argument) => node(suffix, 'CastExpression', { type: doubleType }, { argument })
  const variable = (suffix, variableName, type, initializer) => node(suffix, 'VariableDeclaration', { name: variableName, type }, { initializer })
  const returnStatement = (suffix, argument = null) => node(suffix, 'ReturnStatement', {}, argument ? { argument } : {})

  const names = {
    xMin: oscilloscopeGlobalName('X_MIN', index),
    xMax: oscilloscopeGlobalName('X_MAX', index),
    count: oscilloscopeGlobalName('COUNT', index),
    nextId: oscilloscopeGlobalName('NEXT_ID', index),
    revision: oscilloscopeGlobalName('REVISION', index),
  }

  const xMinId = variable('xMin', names.xMin, doubleType, doubleValue('xMinStart', -10))
  const xMaxId = variable('xMax', names.xMax, doubleType, doubleValue('xMaxStart', 10))
  const countId = variable('count', names.count, intType, intValue('countStart', 0))
  const nextIdId = variable('nextId', names.nextId, intType, intValue('nextIdStart', 1))
  const revisionId = variable('revision', names.revision, intType, intValue('revisionStart', 0))
  module.rootNodeIds.push(xMinId, xMaxId, countId, nextIdId, revisionId)

  const zeroName = oscilloscopeFunctionName('ZERO', index)
  const zeroFunction = (() => {
    const parameterId = node('zero:param:x', 'Parameter', { name: 'x', type: doubleType })
    const bodyId = block('zero:body', [returnStatement('zero:return', doubleValue('zero:value', 0))])
    const functionId = node('zero:function', 'FunctionDeclaration', { name: zeroName, type: doubleType }, { parameters: [parameterId], body: bodyId })
    module.rootNodeIds.push(functionId)
    return zeroName
  })()

  // Chaque emplacement possède son drapeau, son identifiant, sa fonction et ses valeurs.
  const slots = []
  for (let slot = 0; slot < maximumOscilloscopeChannels; slot += 1) {
    const activeName = oscilloscopeChannelName('ACTIVE', index, slot)
    const idName = oscilloscopeChannelName('ID', index, slot)
    const functionName = oscilloscopeChannelName('FN', index, slot)
    const valuesName = oscilloscopeChannelName('Y', index, slot)
    const activeId = variable(`slot:${slot}:active`, activeName, booleanType, boolValue(`slot:${slot}:activeStart`, false))
    const channelId = variable(`slot:${slot}:id`, idName, intType, intValue(`slot:${slot}:idStart`, 0))
    const channelFunction = variable(`slot:${slot}:function`, functionName, functionType, ref(`slot:${slot}:zeroRef`, zeroFunction))
    const valuesInit = node(`slot:${slot}:valuesInit`, 'ArrayCreation', { elementType: doubleType }, { size: intValue(`slot:${slot}:valuesSize`, samples), initializer: doubleValue(`slot:${slot}:valuesZero`, 0) })
    const valuesId = variable(`slot:${slot}:values`, valuesName, doubleArrayType, valuesInit)
    module.rootNodeIds.push(activeId, channelId, channelFunction, valuesId)
    slots.push({ activeName, idName, functionName, valuesName, activeId, channelId, channelFunction, valuesId })
  }

  // Déclare une fonction racine et, si demandé, l'exporte.
  function declareFunction(kind, returnType, parameters, statements, exported = true) {
    const functionName = oscilloscopeFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(`${kind}:param:${parameter.id}`, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`${kind}:body`, statements)
    const functionId = node(`${kind}:function`, 'FunctionDeclaration', { name: functionName, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    if (exported) module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  // Échantillonne une fonction sur la fenêtre courante et remplit le tableau fourni.
  const sampleName = (() => {
    const indexDecl = variable('sample:index', 'i', intType, intValue('sample:indexStart', 0))
    const indexTest = binary('sample:test', '<', ref('sample:testIndex', 'i'), intValue('sample:testEnd', samples))
    const indexUpdate = assignment('sample:update', ref('sample:updateTarget', 'i'), binary('sample:updateValue', '+', ref('sample:updateLeft', 'i'), intValue('sample:updateOne', 1)))
    const ratio = binary('sample:ratio', '/', cast('sample:ratioCast', ref('sample:ratioIndex', 'i')), doubleValue('sample:ratioDenominator', Math.max(1, samples - 1)))
    const xValue = node('sample:xValue', 'MathCall', { name: 'lerp' }, { arguments: [ref('sample:xMinRef', names.xMin), ref('sample:xMaxRef', names.xMax), ratio] })
    const xDecl = variable('sample:x', 'x', doubleType, xValue)
    const yValue = call('sample:yCall', ref('sample:yCallee', 'fn'), [ref('sample:yArgument', 'x')])
    const write = assignment('sample:write', access('sample:writeTarget', ref('sample:writeArray', 'values'), ref('sample:writeIndex', 'i')), yValue)
    const loopBody = block('sample:body', [xDecl, write])
    const loop = node('sample:loop', 'ForStatement', {}, { initializer: indexDecl, test: indexTest, update: indexUpdate, body: loopBody })
    return declareFunction('SAMPLE', voidType, [
      { id: 'function', name: 'fn', type: functionType },
      { id: 'values', name: 'values', type: doubleArrayType },
    ], [loop], false)
  })()

  // Construit une chaîne if / else if avec un éventuel bloc final.
  function ifChain(prefix, branches, finalStatements = null) {
    let current = finalStatements ? block(`${prefix}:final`, finalStatements) : null
    for (let position = branches.length - 1; position >= 0; position -= 1) {
      const branch = branches[position]
      const consequent = block(`${prefix}:then:${position}`, branch.statements)
      const alternate = current ? block(`${prefix}:else:${position}`, [current]) : null
      current = node(`${prefix}:if:${position}`, 'IfStatement', {}, { test: branch.test, consequent, alternate })
    }
    return current
  }

  const sampleCall = (suffix, functionReference, valuesReference) => {
    const callId = call(`${suffix}:call`, ref(`${suffix}:callee`, sampleName), [functionReference, valuesReference])
    return node(`${suffix}:statement`, 'ExpressionStatement', {}, { expression: callId })
  }

  // ADD_CHANNEL(fn) : premier emplacement libre, échantillonnage immédiat, identifiant stable.
  const addBranches = slots.map((slot, position) => ({
    test: unary(`add:${position}:test`, 'not', ref(`add:${position}:activeRef`, slot.activeName)),
    statements: [
      assignment(`add:${position}:active`, ref(`add:${position}:activeTarget`, slot.activeName), boolValue(`add:${position}:activeValue`, true)),
      assignment(`add:${position}:id`, ref(`add:${position}:idTarget`, slot.idName), ref(`add:${position}:nextId`, names.nextId)),
      assignment(`add:${position}:function`, ref(`add:${position}:functionTarget`, slot.functionName), ref(`add:${position}:functionValue`, 'fn')),
      sampleCall(`add:${position}:sample`, ref(`add:${position}:sampleFunction`, 'fn'), ref(`add:${position}:sampleValues`, slot.valuesName)),
      assignment(`add:${position}:nextIdUpdate`, ref(`add:${position}:nextIdTarget`, names.nextId), binary(`add:${position}:nextIdValue`, '+', ref(`add:${position}:nextIdRead`, names.nextId), intValue(`add:${position}:nextIdOne`, 1))),
      assignment(`add:${position}:count`, ref(`add:${position}:countTarget`, names.count), binary(`add:${position}:countValue`, '+', ref(`add:${position}:countRead`, names.count), intValue(`add:${position}:countOne`, 1))),
      assignment(`add:${position}:revision`, ref(`add:${position}:revisionTarget`, names.revision), binary(`add:${position}:revisionValue`, '+', ref(`add:${position}:revisionRead`, names.revision), intValue(`add:${position}:revisionOne`, 1))),
      returnStatement(`add:${position}:return`, ref(`add:${position}:returnValue`, slot.idName)),
    ],
  }))
  const addChannel = declareFunction('ADD_CHANNEL', intType, [
    { id: 'function', name: 'fn', type: functionType },
  ], [ifChain('add', addBranches, [returnStatement('add:returnZero', intValue('add:zero', 0))])])

  // SET_CHANNEL(id, fn) : remplace la fonction du canal correspondant.
  const setBranches = slots.map((slot, position) => ({
    test: binary(`set:${position}:test`, 'and',
      ref(`set:${position}:activeRef`, slot.activeName),
      binary(`set:${position}:idTest`, '==', ref(`set:${position}:idRef`, slot.idName), ref(`set:${position}:idParam`, 'id'))),
    statements: [
      assignment(`set:${position}:function`, ref(`set:${position}:functionTarget`, slot.functionName), ref(`set:${position}:functionValue`, 'fn')),
      sampleCall(`set:${position}:sample`, ref(`set:${position}:sampleFunction`, 'fn'), ref(`set:${position}:sampleValues`, slot.valuesName)),
      assignment(`set:${position}:revision`, ref(`set:${position}:revisionTarget`, names.revision), binary(`set:${position}:revisionValue`, '+', ref(`set:${position}:revisionRead`, names.revision), intValue(`set:${position}:revisionOne`, 1))),
      returnStatement(`set:${position}:return`),
    ],
  }))
  const setChannel = declareFunction('SET_CHANNEL', voidType, [
    { id: 'id', name: 'id', type: intType },
    { id: 'function', name: 'fn', type: functionType },
  ], [ifChain('set', setBranches)])

  // REMOVE_CHANNEL(id) : libère l'emplacement et décrémente le nombre de canaux.
  const removeBranches = slots.map((slot, position) => ({
    test: binary(`remove:${position}:test`, 'and',
      ref(`remove:${position}:activeRef`, slot.activeName),
      binary(`remove:${position}:idTest`, '==', ref(`remove:${position}:idRef`, slot.idName), ref(`remove:${position}:idParam`, 'id'))),
    statements: [
      assignment(`remove:${position}:active`, ref(`remove:${position}:activeTarget`, slot.activeName), boolValue(`remove:${position}:activeValue`, false)),
      assignment(`remove:${position}:id`, ref(`remove:${position}:idTarget`, slot.idName), intValue(`remove:${position}:idValue`, 0)),
      assignment(`remove:${position}:count`, ref(`remove:${position}:countTarget`, names.count), binary(`remove:${position}:countValue`, '-', ref(`remove:${position}:countRead`, names.count), intValue(`remove:${position}:countOne`, 1))),
      assignment(`remove:${position}:revision`, ref(`remove:${position}:revisionTarget`, names.revision), binary(`remove:${position}:revisionValue`, '+', ref(`remove:${position}:revisionRead`, names.revision), intValue(`remove:${position}:revisionOne`, 1))),
      returnStatement(`remove:${position}:return`),
    ],
  }))
  const removeChannel = declareFunction('REMOVE_CHANNEL', voidType, [
    { id: 'id', name: 'id', type: intType },
  ], [ifChain('remove', removeBranches)])

  // SET_RANGE(xMin, xMax) : valide la fenêtre puis rééchantillonne les canaux actifs.
  const rangeAssignments = [
    assignment('range:xMin', ref('range:xMinTarget', names.xMin), ref('range:xMinValue', 'xMin')),
    assignment('range:xMax', ref('range:xMaxTarget', names.xMax), ref('range:xMaxValue', 'xMax')),
  ]
  const rangeResamples = slots.map((slot, position) => node(`range:${position}:if`, 'IfStatement', {}, {
    test: ref(`range:${position}:activeRef`, slot.activeName),
    consequent: block(`range:${position}:then`, [
      sampleCall(`range:${position}:sample`, ref(`range:${position}:sampleFunction`, slot.functionName), ref(`range:${position}:sampleValues`, slot.valuesName)),
    ]),
    alternate: null,
  }))
  const rangeRevision = assignment('range:revision', ref('range:revisionTarget', names.revision), binary('range:revisionValue', '+', ref('range:revisionRead', names.revision), intValue('range:revisionOne', 1)))
  const setRange = declareFunction('SET_RANGE', voidType, [
    { id: 'xMin', name: 'xMin', type: doubleType },
    { id: 'xMax', name: 'xMax', type: doubleType },
  ], [
    node('range:if', 'IfStatement', {}, {
      test: binary('range:test', '>', ref('range:testMax', 'xMax'), ref('range:testMin', 'xMin')),
      consequent: block('range:then', [...rangeAssignments, ...rangeResamples, rangeRevision]),
      alternate: null,
    }),
  ])

  // CLEAR() : désactive tous les canaux, remet les compteurs et la fenêtre par défaut.
  const clearStatements = []
  for (const [position, slot] of slots.entries()) {
    clearStatements.push(assignment(`clear:${position}:active`, ref(`clear:${position}:activeTarget`, slot.activeName), boolValue(`clear:${position}:activeValue`, false)))
    clearStatements.push(assignment(`clear:${position}:id`, ref(`clear:${position}:idTarget`, slot.idName), intValue(`clear:${position}:idValue`, 0)))
  }
  clearStatements.push(
    assignment('clear:count', ref('clear:countTarget', names.count), intValue('clear:countValue', 0)),
    assignment('clear:nextId', ref('clear:nextIdTarget', names.nextId), intValue('clear:nextIdValue', 1)),
    assignment('clear:xMin', ref('clear:xMinTarget', names.xMin), doubleValue('clear:xMinValue', -10)),
    assignment('clear:xMax', ref('clear:xMaxTarget', names.xMax), doubleValue('clear:xMaxValue', 10)),
    assignment('clear:revision', ref('clear:revisionTarget', names.revision), binary('clear:revisionValue', '+', ref('clear:revisionRead', names.revision), intValue('clear:revisionOne', 1))),
  )
  const clear = declareFunction('CLEAR', voidType, [], clearStatements)

  return {
    module,
    nodes,
    functions: { addChannel, setChannel, removeChannel, setRange, clear, names },
  }
}
