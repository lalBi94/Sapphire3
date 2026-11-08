import { createModule, createNode } from './logic/model.js'
import { xyPlotDefaultSamples, xyPlotGlobalName } from './logic/xyPlotState.js'

export { xyPlotGlobalName, xyPlotDefaultSamples } from './logic/xyPlotState.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const doubleArrayType = { kind: 'array', elementType: doubleType }
const functionType = { kind: 'function', parameters: [doubleType], returnType: doubleType }

// Produit le nom stable d'une fonction d'API interne à un traceur XY.
export function xyPlotFunctionName(kind, index) {
  return `XYPLOT_SP3_${kind}_${index}`
}

// Crée le module caché d'un traceur : échantillonne une fonction (double) -> double.
export function createXyPlotModule(moduleId, name, index, options = {}) {
  const samples = Number.isInteger(options.samples) && options.samples > 0
    ? Math.min(options.samples, 512)
    : xyPlotDefaultSamples
  const module = createModule(moduleId, name)
  module.xyPlot = { index, samples }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `xyPlot:${moduleId}:${suffix}:${++sequence}`
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
  const access = (suffix, array, indexNode) => node(suffix, 'ArrayAccess', {}, { array, index: indexNode })
  const call = (suffix, callee, args) => node(suffix, 'CallExpression', {}, { callee, arguments: args })
  const cast = (suffix, argument) => node(suffix, 'CastExpression', { type: doubleType }, { argument })

  const names = {
    points: xyPlotGlobalName('POINTS', index),
    count: xyPlotGlobalName('COUNT', index),
    xMin: xyPlotGlobalName('X_MIN', index),
    xMax: xyPlotGlobalName('X_MAX', index),
    yMin: xyPlotGlobalName('Y_MIN', index),
    yMax: xyPlotGlobalName('Y_MAX', index),
    auto: xyPlotGlobalName('AUTO', index),
    revision: xyPlotGlobalName('REVISION', index),
  }

  // Les points sont stockés à plat : [x0, y0, x1, y1, ...].
  const pointsInit = node('pointsInit', 'ArrayCreation', { elementType: doubleType }, { size: intValue('pointsSize', samples * 2), initializer: doubleValue('pointsZero', 0) })
  const pointsId = node('points', 'VariableDeclaration', { name: names.points, type: doubleArrayType }, { initializer: pointsInit })
  const countId = node('count', 'VariableDeclaration', { name: names.count, type: intType }, { initializer: intValue('countStart', 0) })
  const xMinId = node('xMin', 'VariableDeclaration', { name: names.xMin, type: doubleType }, { initializer: doubleValue('xMinStart', -10) })
  const xMaxId = node('xMax', 'VariableDeclaration', { name: names.xMax, type: doubleType }, { initializer: doubleValue('xMaxStart', 10) })
  const yMinId = node('yMin', 'VariableDeclaration', { name: names.yMin, type: doubleType }, { initializer: doubleValue('yMinStart', -10) })
  const yMaxId = node('yMax', 'VariableDeclaration', { name: names.yMax, type: doubleType }, { initializer: doubleValue('yMaxStart', 10) })
  const autoId = node('auto', 'VariableDeclaration', { name: names.auto, type: booleanType }, { initializer: boolValue('autoStart', true) })
  const revisionId = node('revision', 'VariableDeclaration', { name: names.revision, type: intType }, { initializer: intValue('revisionStart', 0) })
  module.rootNodeIds.push(pointsId, countId, xMinId, xMaxId, yMinId, yMaxId, autoId, revisionId)

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, returnType, parameters, statements) {
    const functionName = xyPlotFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name: functionName, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  // Échantillonne la fonction sur [xMin, xMax] et met à jour le compteur.
  const indexDecl = node('sampleIndex', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: intValue('sampleIndexStart', 0) })
  const indexTest = binary('sampleTest', '<', ref('sampleTestIndex', 'i'), intValue('sampleTestEnd', samples))
  const indexUpdate = assignment('sampleUpdate', ref('sampleUpdateTarget', 'i'), binary('sampleUpdateValue', '+', ref('sampleUpdateLeft', 'i'), intValue('sampleUpdateOne', 1)))
  const ratio = binary('ratio', '/', cast('ratioCast', ref('ratioIndex', 'i')), doubleValue('ratioDenominator', Math.max(1, samples - 1)))
  const xValue = node('xValue', 'MathCall', { name: 'lerp' }, { arguments: [ref('xMinRef', names.xMin), ref('xMaxRef', names.xMax), ratio] })
  const xDecl = node('x', 'VariableDeclaration', { name: 'x', type: doubleType }, { initializer: xValue })
  const yDecl = node('y', 'VariableDeclaration', { name: 'y', type: doubleType }, { initializer: call('yCall', ref('yCallee', 'fn'), [ref('yArgument', 'x')]) })
  const twiceIndex = (suffix) => binary(suffix, '*', ref(`${suffix}Index`, 'i'), intValue(`${suffix}Two`, 2))
  const writeX = assignment('writeX', access('writeXTarget', ref('writeXArray', names.points), twiceIndex('writeX')), ref('writeXValue', 'x'))
  const writeY = assignment('writeY', access('writeYTarget', ref('writeYArray', names.points), binary('writeYIndex', '+', twiceIndex('writeY'), intValue('writeYOne', 1))), ref('writeYValue', 'y'))
  const countIncrement = assignment('sampleCount', ref('sampleCountTarget', names.count), binary('sampleCountValue', '+', ref('sampleCountLeft', 'i'), intValue('sampleCountOne', 1)))
  const loopBody = block('sampleBody', [xDecl, yDecl, writeX, writeY, countIncrement])
  const loop = node('sampleLoop', 'ForStatement', {}, { initializer: indexDecl, test: indexTest, update: indexUpdate, body: loopBody })
  const setFunction = addFunction('SET_FUNCTION', voidType, [
    { id: 'parameter:function', name: 'fn', type: functionType },
  ], [
    assignment('resetCount', ref('resetCountTarget', names.count), intValue('resetCountValue', 0)),
    loop,
    assignment('setCount', ref('setCountTarget', names.count), intValue('setCountValue', samples)),
    assignment('setAuto', ref('setAutoTarget', names.auto), boolValue('setAutoValue', true)),
    assignment('setRevision', ref('setRevisionTarget', names.revision), binary('setRevisionValue', '+', ref('setRevisionLeft', names.revision), intValue('setRevisionOne', 1))),
  ])

  const setRange = addFunction('SET_RANGE', voidType, [
    { id: 'parameter:xMin', name: 'xMin', type: doubleType },
    { id: 'parameter:xMax', name: 'xMax', type: doubleType },
    { id: 'parameter:yMin', name: 'yMin', type: doubleType },
    { id: 'parameter:yMax', name: 'yMax', type: doubleType },
  ], [
    assignment('assignXMin', ref('assignXMinTarget', names.xMin), ref('assignXMinValue', 'xMin')),
    assignment('assignXMax', ref('assignXMaxTarget', names.xMax), ref('assignXMaxValue', 'xMax')),
    assignment('assignYMin', ref('assignYMinTarget', names.yMin), ref('assignYMinValue', 'yMin')),
    assignment('assignYMax', ref('assignYMaxTarget', names.yMax), ref('assignYMaxValue', 'yMax')),
    assignment('assignAuto', ref('assignAutoTarget', names.auto), boolValue('assignAutoValue', false)),
    assignment('assignRevision', ref('assignRevisionTarget', names.revision), binary('assignRevisionValue', '+', ref('assignRevisionLeft', names.revision), intValue('assignRevisionOne', 1))),
  ])

  const clear = addFunction('CLEAR', voidType, [], [
    assignment('clearCount', ref('clearCountTarget', names.count), intValue('clearCountValue', 0)),
    assignment('clearAuto', ref('clearAutoTarget', names.auto), boolValue('clearAutoValue', true)),
    assignment('clearRevision', ref('clearRevisionTarget', names.revision), binary('clearRevisionValue', '+', ref('clearRevisionLeft', names.revision), intValue('clearRevisionOne', 1))),
  ])

  return {
    module,
    nodes,
    functions: { setFunction, setRange, clear, names },
  }
}
