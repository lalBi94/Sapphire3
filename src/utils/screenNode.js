import { createModule, createNode } from './logic/model.js'
import { screenLimits } from './logic/mathNatives.js'
import { screenGlobalName } from './logic/screenState.js'

export { screenGlobalName } from './logic/screenState.js'

export const screenDefaults = Object.freeze({ width: 15, height: 9 })

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }

// Produit le nom stable d'une fonction d'API interne à un écran.
export function screenFunctionName(kind, index) {
  return `SCREEN_SP3_${kind}_${index}`
}

// Crée le module caché d'un écran avec ses globals et ses fonctions exportées.
export function createScreenModule(moduleId, name, index, options = {}) {
  const width = Math.min(screenLimits.maximumDimension, Math.max(1, Number(options.width) || screenDefaults.width))
  const height = Math.min(screenLimits.maximumDimension, Math.max(1, Number(options.height) || screenDefaults.height))
  const module = createModule(moduleId, name)
  module.screen = { index, width, height }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `screen:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const literal = (suffix, value) => node(suffix, 'Literal', { type: intType, value: String(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const callNative = (suffix, nativeName, args) => node(suffix, 'MathCall', { name: nativeName }, { arguments: args })
  const expression = (suffix, value) => node(suffix, 'ExpressionStatement', {}, { expression: value })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const returnValue = (suffix, value) => node(suffix, 'ReturnStatement', {}, { argument: value })

  const names = {
    pixels: screenGlobalName('PIXELS', index),
    width: screenGlobalName('WIDTH', index),
    height: screenGlobalName('HEIGHT', index),
  }
  const pixelsValue = node('pixelsValue', 'ArrayCreation', { elementType: intType }, { size: literal('pixelCount', 4), initializer: literal('pixelZero', 0) })
  const pixelsId = node('pixels', 'VariableDeclaration', { name: names.pixels, type: intArrayType }, { initializer: pixelsValue })
  // Le tampon démarre en 1×1 : un seul redimensionnement natif crée la grille finale,
  // sans consommer un pas de simulation par pixel (indispensable aux grands écrans).
  const widthValue = literal('widthValue', 1)
  const widthId = node('width', 'VariableDeclaration', { name: names.width, type: intType }, { initializer: widthValue })
  const heightValue = literal('heightValue', 1)
  const heightId = node('height', 'VariableDeclaration', { name: names.height, type: intType }, { initializer: heightValue })
  const pixelsResize = assignment('resizePixelsInit', ref('pixelsResizeTarget', names.pixels), callNative('resizePixelsInitCall', 'screenResize', [ref('pixelsResizeSource', names.pixels), ref('pixelsResizeWidth', names.width), ref('pixelsResizeHeight', names.height), literal('pixelsResizeNextWidth', width), literal('pixelsResizeNextHeight', height)]))
  const widthResize = assignment('widthResizeInit', ref('widthResizeTarget', names.width), literal('widthResizeValue', width))
  const heightResize = assignment('heightResizeInit', ref('heightResizeTarget', names.height), literal('heightResizeValue', height))
  module.rootNodeIds.push(pixelsId, widthId, heightId, pixelsResize, widthResize, heightResize)

  // Ajoute une fonction racine exportable et retourne ses identifiants de paramètres.
  function addFunction(kind, returnType, parameters, statements) {
    const name = screenFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name })
    return { functionId, name }
  }

  const setPixel = addFunction('SET_PIXEL', voidType, [
    { id: 'parameter:index', name: 'index', type: intType },
    { id: 'parameter:red', name: 'red', type: intType },
    { id: 'parameter:green', name: 'green', type: intType },
    { id: 'parameter:blue', name: 'blue', type: intType },
    { id: 'parameter:alpha', name: 'alpha', type: intType },
  ], [
    expression('setPixelCall', callNative('setPixelNative', 'screenSetPixel', [
      ref('pixelsRef', names.pixels), ref('widthRef', names.width), ref('heightRef', names.height),
      ref('indexRef', 'index'), ref('redRef', 'red'), ref('greenRef', 'green'), ref('blueRef', 'blue'), ref('alphaRef', 'alpha'),
    ])),
  ])
  const getPixel = addFunction('GET_PIXEL', voidType, [
    { id: 'parameter:index', name: 'index', type: intType },
    { id: 'parameter:output', name: 'output', type: intArrayType },
  ], [
    expression('getPixelCall', callNative('getPixelNative', 'screenGetPixel', [
      ref('pixelsRef', names.pixels), ref('widthRef', names.width), ref('heightRef', names.height),
      ref('indexRef', 'index'), ref('outputRef', 'output'),
    ])),
  ])
  const getWidth = addFunction('GET_WIDTH', intType, [], [returnValue('widthReturn', ref('widthReturnRef', names.width))])
  const getHeight = addFunction('GET_HEIGHT', intType, [], [returnValue('heightReturn', ref('heightReturnRef', names.height))])

  addFunction('SET_WIDTH', voidType, [{ id: 'parameter:width', name: 'width', type: intType }], [
    assignment('resizePixels', ref('pixelsTarget', names.pixels), callNative('resizeCall', 'screenResize', [ref('pixelsRefWidth', names.pixels), ref('widthRefWidth', names.width), ref('heightRefWidth', names.height), ref('widthParamRef', 'width'), ref('heightRefWidthTwo', names.height)])),
    assignment('assignWidth', ref('widthTarget', names.width), ref('widthValueRef', 'width')),
  ])
  addFunction('SET_HEIGHT', voidType, [{ id: 'parameter:height', name: 'height', type: intType }], [
    assignment('resizePixels', ref('pixelsTarget', names.pixels), callNative('resizeCall', 'screenResize', [ref('pixelsRefHeight', names.pixels), ref('widthRefHeight', names.width), ref('heightRefHeight', names.height), ref('widthRefHeightTwo', names.width), ref('heightParamRef', 'height')])),
    assignment('assignHeight', ref('heightTarget', names.height), ref('heightValueRef', 'height')),
  ])
  const blit = addFunction('BLIT', voidType, [
    { id: 'parameter:grid', name: 'grid', type: intArrayType },
    { id: 'parameter:palette', name: 'palette', type: intArrayType },
  ], [
    expression('blitCall', callNative('blitNative', 'screenBlit', [
      ref('pixelsRefBlit', names.pixels), ref('widthRefBlit', names.width), ref('heightRefBlit', names.height),
      ref('gridRefBlit', 'grid'), ref('gridWidthRefBlit', names.width), ref('gridHeightRefBlit', names.height), ref('paletteRefBlit', 'palette'),
    ])),
  ])
  const present = addFunction('PRESENT', voidType, [], [
    expression('presentCall', callNative('presentNative', 'screenPresent', [])),
  ])

  return {
    module,
    nodes,
    functions: { setPixel: setPixel.name, getPixel: getPixel.name, getWidth: getWidth.name, getHeight: getHeight.name, blit: blit.name, present: present.name, names },
  }
}
