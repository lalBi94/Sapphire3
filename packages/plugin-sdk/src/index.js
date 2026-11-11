import { PLUGIN_API_VERSION, PLUGIN_FORMAT_VERSION } from './constants.js'
import { evaluatePluginExpression, emitPluginExpression, isPlainRecord, runtimeValueMatchesType } from './expression.js'
import { isJsonSafe, validatePluginDocument } from './manifest.js'

export {
  COMPOSITE_NODE_KINDS,
  COMPOSITE_ROOT_KINDS,
  NATIVE_OPERATION_EMITTER_TARGETS,
  NATIVE_OPERATION_PURITY,
  PLUGIN_API_VERSION,
  PLUGIN_CAPABILITIES,
  PLUGIN_FILE_EXTENSION,
  PLUGIN_FORMAT_VERSION,
  PLUGIN_LIMITS,
  PLUGIN_PERMISSIONS,
  SUPPORTED_PLUGIN_PERMISSIONS,
  WIDGET_INTERACTION_KINDS,
  WIDGET_PROPERTY_TYPES,
  WIDGET_RENDERER_KINDS,
} from './constants.js'
export { PLUGIN_DIAGNOSTIC_CODES, createPluginDiagnostic } from './diagnostics.js'
export { compareVersions, satisfiesVersionRange } from './version.js'
export {
  defineComposite,
  defineNativeOperation,
  definePlugin,
  defineWidget,
  getPluginCapabilities,
  isJsonSafe,
  stringifyPluginDocument,
  validatePluginDocument,
} from './manifest.js'
export {
  emitPluginExpression,
  evaluatePluginExpression,
  isPlainRecord,
  isPluginType,
  normalizeLiteralValue,
  runtimeTypeOf,
  runtimeValueMatchesType,
  validatePluginExpression,
} from './expression.js'

const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor'])

// Copie uniquement les clés JSON sûres d'un objet, sans prototype modifiable.
function safeRecord(value) {
  const result = {}
  if (!isPlainRecord(value)) return result
  for (const [key, entry] of Object.entries(value)) {
    if (dangerousKeys.has(key) || !isJsonSafe(entry)) continue
    result[key] = entry
  }
  return result
}

// Construit les propriétés d'instance à partir des valeurs par défaut et des surcharges valides.
export function sanitizeWidgetProperties(widget, overrides = {}) {
  const properties = {}
  for (const property of widget?.properties ?? []) {
    if (!property?.id || dangerousKeys.has(property.id)) continue
    const candidate = isPlainRecord(overrides) && Object.hasOwn(overrides, property.id) ? overrides[property.id] : property.default
    const valid = property.type === 'string' || property.type === 'select' || property.type === 'color' ? typeof candidate === 'string'
      : property.type === 'boolean' ? typeof candidate === 'boolean'
        : property.type === 'int' ? Number.isInteger(candidate)
          : typeof candidate === 'number' && Number.isFinite(candidate)
    properties[property.id] = valid ? candidate : property.default
  }
  return properties
}

// Construit l'état initial d'un widget, en conservant un état restauré compatible.
export function sanitizeWidgetState(widget, persisted = null) {
  const state = safeRecord(widget?.initialState)
  if (isPlainRecord(persisted)) {
    for (const [key, value] of Object.entries(persisted)) {
      if (dangerousKeys.has(key) || !isJsonSafe(value)) continue
      state[key] = value
    }
  }
  for (const interaction of widget?.interactions ?? []) {
    const key = interaction.stateKey ?? interaction.id
    if (dangerousKeys.has(key) || Object.hasOwn(state, key)) continue
    if (interaction.kind === 'slider') state[key] = Number.isFinite(interaction.min) ? interaction.min : 0
    else if (interaction.kind === 'button') state[key] = interaction.value ?? false
  }
  return state
}

// Crée l'instance persistable d'un widget : propriétés, état et liaisons vides.
export function createWidgetInstance(widget, overrides = {}) {
  return {
    properties: sanitizeWidgetProperties(widget, overrides.properties),
    state: sanitizeWidgetState(widget, overrides.state),
    bindings: {
      inputs: isPlainRecord(overrides.bindings?.inputs) ? { ...overrides.bindings.inputs } : {},
      outputs: isPlainRecord(overrides.bindings?.outputs) ? { ...overrides.bindings.outputs } : {},
    },
  }
}

// Prépare une opération native compatible avec le registre du moteur.
export function createNativeOperationDefinition(plugin, operation) {
  const parameterNames = operation.parameters.map((parameter) => parameter.name)
  const parameters = operation.parameters.map((parameter) => parameter.type)
  return {
    id: operation.id,
    name: operation.name,
    description: operation.description,
    group: 'native.plugins',
    parameters,
    returnType: operation.returnType,
    purity: operation.purity,
    effects: [...(operation.effects ?? [])],
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    run(args) {
      if (!Array.isArray(args) || args.length !== parameters.length) {
        throw Object.assign(new Error('PLUGIN_OPERATION_ARGUMENTS'), { code: 'PLUGIN_OPERATION_ARGUMENTS' })
      }
      args.forEach((value, index) => {
        if (!runtimeValueMatchesType(value, parameters[index])) {
          throw Object.assign(new Error('PLUGIN_OPERATION_ARGUMENT_TYPE'), { code: 'PLUGIN_OPERATION_ARGUMENT_TYPE' })
        }
      })
      if (operation.validation && !evaluatePluginExpression(operation.validation, args, parameterNames)) {
        throw Object.assign(new Error('PLUGIN_OPERATION_VALIDATION'), { code: 'PLUGIN_OPERATION_VALIDATION' })
      }
      return evaluatePluginExpression(operation.implementation, args, parameterNames)
    },
    emit(target, argumentCodes) {
      const expression = operation.transpilers?.[target]
      if (!expression) return null
      return emitPluginExpression(expression, target, argumentCodes, parameterNames)
    },
  }
}

// Clone un brouillon composite pour qu'aucun appelant ne puisse muter le manifeste.
export function expandCompositeDraft(composite) {
  const clone = (value) => {
    if (Array.isArray(value)) return value.map(clone)
    if (isPlainRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]))
    return value
  }
  return clone(composite.expansion)
}

// Retourne les paramètres nommés d'une opération native.
export function getNativeOperationParameterNames(operation) {
  return (operation?.parameters ?? []).map((parameter) => parameter.name)
}

export const PLUGIN_SDK_VERSION = '0.1.0'
export { PLUGIN_API_VERSION as PLUGIN_CONTRACT_VERSION, PLUGIN_FORMAT_VERSION as PLUGIN_DOCUMENT_VERSION }
export { validatePluginDocument as validateManifest }
