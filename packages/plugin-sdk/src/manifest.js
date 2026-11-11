import {
  COMPOSITE_NODE_KINDS,
  COMPOSITE_ROOT_KINDS,
  NATIVE_OPERATION_EMITTER_TARGETS,
  NATIVE_OPERATION_PURITY,
  PLUGIN_API_VERSION,
  PLUGIN_CAPABILITIES,
  PLUGIN_ENTITY_ID_PATTERN,
  PLUGIN_FORMAT_VERSION,
  PLUGIN_ID_PATTERN,
  PLUGIN_LIMITS,
  PLUGIN_PERMISSIONS,
  PLUGIN_VERSION_PATTERN,
  SUPPORTED_PLUGIN_PERMISSIONS,
  WIDGET_INTERACTION_KINDS,
  WIDGET_PROPERTY_TYPES,
  WIDGET_RENDERER_KINDS,
} from './constants.js'
import { createPluginDiagnostic, PLUGIN_DIAGNOSTIC_CODES, pluginFailure } from './diagnostics.js'
import { isPlainRecord, isPluginType, validatePluginExpression } from './expression.js'

const supportedPermissionSet = new Set(SUPPORTED_PLUGIN_PERMISSIONS)

// Vérifie qu'une valeur reste sérialisable en JSON, sans cycle ni prototype exotique.
export function isJsonSafe(value, depth = 0, seen = new Set()) {
  if (depth > 30) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0)
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol' || value === undefined) return false
  if (!Array.isArray(value) && !isPlainRecord(value)) return false
  if (seen.has(value)) return false
  seen.add(value)
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonSafe(entry, depth + 1, seen))
    : Object.values(value).every((entry) => isJsonSafe(entry, depth + 1, seen))
  seen.delete(value)
  return valid
}

// Compte les octets d'une valeur JSON sans jamais exécuter de code.
function jsonSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch {
    return Infinity
  }
}

// Valide une chaîne courte et non vide.
function requiredString(value, path, diagnostics, maximum = PLUGIN_LIMITS.maximumStringLength) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A non-empty string is required.', path))
    return false
  }
  return true
}

// Valide un identifiant stable du manifeste.
function requiredId(value, path, diagnostics) {
  if (typeof value !== 'string' || !PLUGIN_ENTITY_ID_PATTERN.test(value)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A stable identifier is required.', path))
    return false
  }
  return true
}

// Valide une taille de widget en pixels entiers.
function validSize(value, path, diagnostics, minimum = 80) {
  if (!isPlainRecord(value) || !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < minimum || value.height < minimum || value.width > 4000 || value.height > 4000) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A positive integer size is required.', path))
    return false
  }
  return true
}

// Valide un type de port ou de paramètre, sans void pour une entrée.
function validPortType(value, path, diagnostics, allowVoid = false) {
  if (!isPluginType(value, { allowVoid })) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A primitive or primitive-array type is required.', path))
    return false
  }
  return true
}

// Valide une propriété configurable et sa valeur par défaut.
function validateProperty(property, path, diagnostics) {
  if (!isPlainRecord(property)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A property object is required.', path))
    return
  }
  requiredId(property.id, `${path}.id`, diagnostics)
  requiredString(property.label, `${path}.label`, diagnostics, 120)
  if (!WIDGET_PROPERTY_TYPES.includes(property.type)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, `Unsupported property type: ${property.type}.`, `${path}.type`))
    return
  }
  if (property.type === 'select') {
    if (!Array.isArray(property.options) || property.options.length === 0 || property.options.length > 64 || property.options.some((option) => typeof option !== 'string')) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A select property requires string options.', `${path}.options`))
    }
  }
  const defaultValue = property.default
  const valid = property.type === 'string' || property.type === 'select' || property.type === 'color' ? typeof defaultValue === 'string'
    : property.type === 'boolean' ? typeof defaultValue === 'boolean'
      : property.type === 'int' ? Number.isInteger(defaultValue)
        : typeof defaultValue === 'number' && Number.isFinite(defaultValue)
  if (!valid) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The property default does not match its type.', `${path}.default`))
}

// Valide un port typé d'entrée ou de sortie.
function validatePort(port, path, diagnostics) {
  if (!isPlainRecord(port)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A port object is required.', path))
    return
  }
  requiredId(port.id, `${path}.id`, diagnostics)
  requiredString(port.name, `${path}.name`, diagnostics, 120)
  validPortType(port.type, `${path}.type`, diagnostics)
  if (port.description !== undefined) requiredString(port.description, `${path}.description`, diagnostics)
}

// Valide une interaction utilisateur et sa liaison de sortie éventuelle.
function validateInteraction(interaction, path, diagnostics, outputIds) {
  if (!isPlainRecord(interaction)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'An interaction object is required.', path))
    return
  }
  requiredId(interaction.id, `${path}.id`, diagnostics)
  requiredString(interaction.label, `${path}.label`, diagnostics, 120)
  if (!WIDGET_INTERACTION_KINDS.includes(interaction.kind)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, `Unsupported interaction: ${interaction.kind}.`, `${path}.kind`))
  }
  if (interaction.kind === 'slider') {
    for (const key of ['min', 'max', 'step']) {
      if (typeof interaction[key] !== 'number' || !Number.isFinite(interaction[key])) {
        diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A finite slider bound is required.', `${path}.${key}`))
      }
    }
    if (interaction.max <= interaction.min) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The slider maximum must exceed its minimum.', `${path}.max`))
    if (interaction.step <= 0) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The slider step must be positive.', `${path}.step`))
  }
  if (interaction.stateKey !== undefined && !PLUGIN_ENTITY_ID_PATTERN.test(interaction.stateKey)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The state key is invalid.', `${path}.stateKey`))
  }
  if (interaction.output !== undefined && !outputIds.has(interaction.output)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The interaction output is not declared.', `${path}.output`))
  }
  if (interaction.value !== undefined && !isJsonSafe(interaction.value)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The interaction value must be JSON-safe.', `${path}.value`))
  }
}

// Vérifie une source de rendu `input.*`, `state.*` ou `property.*`.
function validRendererSource(source, path, diagnostics, inputIds, propertyIds, stateKeys) {
  if (typeof source !== 'string') {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'A renderer source is required.', path))
    return
  }
  const separator = source.indexOf('.')
  const scope = separator > 0 ? source.slice(0, separator) : ''
  const id = separator > 0 ? source.slice(separator + 1) : ''
  const known = scope === 'input' ? inputIds.has(id) : scope === 'state' ? stateKeys.has(id) : scope === 'property' ? propertyIds.has(id) : false
  if (!known) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, `Unknown renderer source: ${source}.`, path))
}

// Valide récursivement l'arbre de rendu déclaratif, sans accepter de HTML ou de code.
function validateRendererNode(node, path, diagnostics, context, depth = 0, counter = { count: 0 }) {
  counter.count += 1
  if (counter.count > PLUGIN_LIMITS.maximumRendererNodes) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'Renderer node limit reached.', path))
    return
  }
  if (depth > PLUGIN_LIMITS.maximumRendererDepth || !isPlainRecord(node) || !WIDGET_RENDERER_KINDS.includes(node.kind)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'Invalid renderer node.', path))
    return
  }
  if (node.kind === 'stack' || node.kind === 'row') {
    if (!Array.isArray(node.children) || node.children.length > PLUGIN_LIMITS.maximumRendererNodes) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'A renderer container requires children.', `${path}.children`))
      return
    }
    node.children.forEach((child, index) => validateRendererNode(child, `${path}.children[${index}]`, diagnostics, context, depth + 1, counter))
    return
  }
  if (node.kind === 'text') {
    requiredString(node.text, `${path}.text`, diagnostics)
    return
  }
  if (node.kind === 'divider' || node.kind === 'spacer') return
  if (node.kind === 'value' || node.kind === 'bar' || node.kind === 'led') {
    validRendererSource(node.source, `${path}.source`, diagnostics, context.inputIds, context.propertyIds, context.stateKeys)
    if (node.label !== undefined) requiredString(node.label, `${path}.label`, diagnostics, 120)
    if (node.suffix !== undefined && typeof node.suffix !== 'string') diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'A suffix must be a string.', `${path}.suffix`))
    if (node.precision !== undefined && (!Number.isInteger(node.precision) || node.precision < 0 || node.precision > 8)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'The precision is invalid.', `${path}.precision`))
    if (node.kind === 'bar') {
      for (const key of ['min', 'max']) if (node[key] !== undefined && (typeof node[key] !== 'number' || !Number.isFinite(node[key]))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'The bar bound is invalid.', `${path}.${key}`))
    }
    return
  }
  if (node.kind === 'input' || node.kind === 'button') {
    const interaction = context.interactions.get(node.interaction)
    if (!interaction || (node.kind === 'input' ? interaction.kind !== 'slider' : interaction.kind !== 'button')) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'The renderer interaction is not declared.', `${path}.interaction`))
    }
  }
}

// Valide un widget complet, y compris ses ports, propriétés, état et rendu.
function validateWidget(widget, path, diagnostics, plugin) {
  if (!isPlainRecord(widget)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A widget object is required.', path))
    return
  }
  requiredId(widget.id, `${path}.id`, diagnostics)
  requiredString(widget.name, `${path}.name`, diagnostics, 120)
  requiredString(widget.description, `${path}.description`, diagnostics)
  requiredString(widget.category, `${path}.category`, diagnostics, 120)
  requiredString(widget.icon, `${path}.icon`, diagnostics, 80)
  if (widget.version !== undefined && (typeof widget.version !== 'string' || !PLUGIN_VERSION_PATTERN.test(widget.version))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The widget version is invalid.', `${path}.version`))
  if (widget.author !== undefined) requiredString(widget.author, `${path}.author`, diagnostics, 120)
  if (!validSize(widget.defaultSize, `${path}.defaultSize`, diagnostics)) return
  if (!validSize(widget.minSize, `${path}.minSize`, diagnostics)) return
  if (widget.minSize.width < 180 || widget.minSize.height < 120) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The minimum size is below the canvas minimum (180x120).', `${path}.minSize`))
  }
  if (widget.minSize.width > widget.defaultSize.width || widget.minSize.height > widget.defaultSize.height) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The minimum size exceeds the default size.', `${path}.minSize`))
  }
  const propertyIds = new Set()
  if (widget.properties !== undefined) {
    if (!Array.isArray(widget.properties) || widget.properties.length > PLUGIN_LIMITS.maximumProperties) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The property list is invalid.', `${path}.properties`))
    } else {
      widget.properties.forEach((property, index) => {
        validateProperty(property, `${path}.properties[${index}]`, diagnostics)
        if (property?.id) propertyIds.add(property.id)
      })
    }
  }
  const inputIds = new Set()
  const outputIds = new Set()
  for (const [field, target] of [['inputs', inputIds], ['outputs', outputIds]]) {
    const ports = widget[field]
    if (ports === undefined) continue
    if (!Array.isArray(ports) || ports.length > PLUGIN_LIMITS.maximumPorts) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, `The ${field} list is invalid.`, `${path}.${field}`))
      continue
    }
    ports.forEach((port, index) => {
      validatePort(port, `${path}.${field}[${index}]`, diagnostics)
      if (port?.id) target.add(port.id)
    })
  }
  const interactions = new Map()
  if (widget.interactions !== undefined) {
    if (!Array.isArray(widget.interactions) || widget.interactions.length > PLUGIN_LIMITS.maximumPorts) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The interaction list is invalid.', `${path}.interactions`))
    } else {
      widget.interactions.forEach((interaction, index) => {
        validateInteraction(interaction, `${path}.interactions[${index}]`, diagnostics, outputIds)
        if (interaction?.id) interactions.set(interaction.id, interaction)
      })
    }
  }
  if (!isPlainRecord(widget.initialState) || !isJsonSafe(widget.initialState) || jsonSize(widget.initialState) > PLUGIN_LIMITS.maximumStateBytes) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The initial state must be bounded JSON.', `${path}.initialState`))
    return
  }
  const stateKeys = new Set(Object.keys(widget.initialState))
  for (const interaction of interactions.values()) stateKeys.add(interaction.stateKey ?? interaction.id)
  if (!isPlainRecord(widget.renderer)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.rendererInvalid, 'A renderer object is required.', `${path}.renderer`))
    return
  }
  validateRendererNode(widget.renderer, `${path}.renderer`, diagnostics, { inputIds, propertyIds, stateKeys, interactions })
  // Une capacité widget implique la permission de rendu et de persistance de son état.
  if (!plugin.permissions.includes(PLUGIN_PERMISSIONS.widgets)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.widgets}.`, path))
  if (!plugin.permissions.includes(PLUGIN_PERMISSIONS.widgetState)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.widgetState}.`, path))
}

// Valide une opération native typée, son implémentation et ses émetteurs optionnels.
function validateNativeOperation(operation, path, diagnostics) {
  if (!isPlainRecord(operation)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A native operation object is required.', path))
    return
  }
  requiredId(operation.id, `${path}.id`, diagnostics)
  requiredString(operation.name, `${path}.name`, diagnostics, 120)
  requiredString(operation.description, `${path}.description`, diagnostics)
  if (!NATIVE_OPERATION_PURITY.includes(operation.purity)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The purity must be pure or effect.', `${path}.purity`))
  if (operation.effects !== undefined && (!Array.isArray(operation.effects) || operation.effects.some((entry) => typeof entry !== 'string' || entry.length > 120))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Effects must be string labels.', `${path}.effects`))
  const parameterNames = []
  if (!Array.isArray(operation.parameters) || operation.parameters.length > PLUGIN_LIMITS.maximumPorts) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The parameter list is invalid.', `${path}.parameters`))
    return
  }
  operation.parameters.forEach((parameter, index) => {
    if (!isPlainRecord(parameter)) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A parameter object is required.', `${path}.parameters[${index}]`))
      return
    }
    requiredId(parameter.name, `${path}.parameters[${index}].name`, diagnostics)
    validPortType(parameter.type, `${path}.parameters[${index}].type`, diagnostics)
    parameterNames.push(parameter.name)
  })
  validPortType(operation.returnType, `${path}.returnType`, diagnostics, true)
  if (new Set(parameterNames).size !== parameterNames.length) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Duplicate parameter names.', `${path}.parameters`))
  const implementation = validatePluginExpression(operation.implementation, parameterNames, 0, `${path}.implementation`)
  diagnostics.push(...implementation.diagnostics)
  if (operation.validation !== undefined) {
    const validation = validatePluginExpression(operation.validation, parameterNames, 0, `${path}.validation`)
    diagnostics.push(...validation.diagnostics)
  }
  if (operation.transpilers !== undefined) {
    if (!isPlainRecord(operation.transpilers)) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Transpilers must be an object.', `${path}.transpilers`))
    } else {
      for (const [target, expression] of Object.entries(operation.transpilers)) {
        if (!NATIVE_OPERATION_EMITTER_TARGETS.includes(target)) {
          diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, `Unsupported transpiler target: ${target}.`, `${path}.transpilers.${target}`))
          continue
        }
        const emitted = validatePluginExpression(expression, parameterNames, 0, `${path}.transpilers.${target}`)
        diagnostics.push(...emitted.diagnostics)
      }
    }
  }
}

// Valide un brouillon composite natif, borné et sérialisable.
function validateCompositeDraft(draft, path, diagnostics, depth = 0, counter = { count: 0 }) {
  counter.count += 1
  if (counter.count > PLUGIN_LIMITS.maximumRendererNodes || depth > PLUGIN_LIMITS.maximumRendererDepth) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'Composite expansion is too large.', path))
    return
  }
  if (!isPlainRecord(draft) || typeof draft.kind !== 'string' || !COMPOSITE_NODE_KINDS.includes(draft.kind)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'Invalid composite node kind.', path))
    return
  }
  if (draft.properties !== undefined && (!isPlainRecord(draft.properties) || !isJsonSafe(draft.properties))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'Invalid composite properties.', `${path}.properties`))
  if (draft.references !== undefined && (!isPlainRecord(draft.references) || !isJsonSafe(draft.references))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'Invalid composite references.', `${path}.references`))
  if (draft.children !== undefined) {
    if (!isPlainRecord(draft.children)) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'Invalid composite children.', `${path}.children`))
      return
    }
    for (const [slot, value] of Object.entries(draft.children)) {
      const entries = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
      entries.forEach((child, index) => validateCompositeDraft(child, `${path}.children.${slot}${Array.isArray(value) ? `[${index}]` : ''}`, diagnostics, depth + 1, counter))
    }
  }
}

// Valide un nœud composite de niveau A.
function validateComposite(composite, path, diagnostics, plugin) {
  if (!isPlainRecord(composite)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A composite object is required.', path))
    return
  }
  requiredId(composite.id, `${path}.id`, diagnostics)
  requiredString(composite.name, `${path}.name`, diagnostics, 120)
  requiredString(composite.description, `${path}.description`, diagnostics)
  if (!isPlainRecord(composite.expansion) || !COMPOSITE_ROOT_KINDS.includes(composite.expansion.kind)) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.compositeInvalid, 'A native root expansion is required.', `${path}.expansion`))
    return
  }
  validateCompositeDraft(composite.expansion, `${path}.expansion`, diagnostics)
  if (!plugin.permissions.includes(PLUGIN_PERMISSIONS.composites)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.composites}.`, path))
}

// Valide le manifeste complet et retourne une copie normalisée, sans mutation.
export function validatePluginDocument(input) {
  const diagnostics = []
  if (!isPlainRecord(input)) return pluginFailure(PLUGIN_DIAGNOSTIC_CODES.invalidDocument, 'A plugin document object is required.')
  if (input.pluginFormatVersion !== PLUGIN_FORMAT_VERSION) {
    return pluginFailure(PLUGIN_DIAGNOSTIC_CODES.unsupportedFormat, `Plugin format ${PLUGIN_FORMAT_VERSION} is required.`)
  }
  if (input.apiVersion !== PLUGIN_API_VERSION) {
    return pluginFailure(PLUGIN_DIAGNOSTIC_CODES.unsupportedApi, `Plugin API ${PLUGIN_API_VERSION} is required.`)
  }
  if (typeof input.id !== 'string' || !PLUGIN_ID_PATTERN.test(input.id)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A valid plugin id is required.', 'id'))
  requiredString(input.name, 'name', diagnostics, 120)
  if (typeof input.version !== 'string' || !PLUGIN_VERSION_PATTERN.test(input.version)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'A semantic plugin version is required.', 'version'))
  requiredString(input.author, 'author', diagnostics, 120)
  requiredString(input.description, 'description', diagnostics)
  if (input.minAppVersion !== undefined && (typeof input.minAppVersion !== 'string' || !PLUGIN_VERSION_PATTERN.test(input.minAppVersion))) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The minimum host version is invalid.', 'minAppVersion'))
  if (input.license !== undefined) requiredString(input.license, 'license', diagnostics, 120)
  if (input.homepage !== undefined && typeof input.homepage !== 'string') diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The homepage must be a string.', 'homepage'))
  const permissions = Array.isArray(input.permissions) ? input.permissions : []
  if (!Array.isArray(input.permissions) || permissions.some((permission) => typeof permission !== 'string')) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Permissions must be a string array.', 'permissions'))
  for (const permission of permissions) {
    if (!supportedPermissionSet.has(permission)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.unsupportedPermission, `Unsupported permission: ${permission}.`, 'permissions'))
  }
  const dependencies = input.dependencies === undefined ? [] : input.dependencies
  if (!Array.isArray(dependencies) || dependencies.length > PLUGIN_LIMITS.maximumDependencies) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'The dependency list is invalid.', 'dependencies'))
  } else {
    const seen = new Set()
    dependencies.forEach((dependency, index) => {
      if (!isPlainRecord(dependency) || typeof dependency.id !== 'string' || !PLUGIN_ID_PATTERN.test(dependency.id) || typeof dependency.version !== 'string') {
        diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.dependencyInvalid, 'Invalid plugin dependency.', `dependencies[${index}]`))
        return
      }
      if (dependency.id === input.id) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.dependencyInvalid, 'A plugin cannot depend on itself.', `dependencies[${index}].id`))
      if (seen.has(dependency.id)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.dependencyInvalid, 'Duplicate plugin dependency.', `dependencies[${index}].id`))
      seen.add(dependency.id)
      if (dependency.optional !== undefined && typeof dependency.optional !== 'boolean') diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.dependencyInvalid, 'The optional flag must be boolean.', `dependencies[${index}].optional`))
    })
  }
  const plugin = {
    ...input,
    permissions: [...permissions],
    dependencies: Array.isArray(dependencies) ? dependencies.map((dependency) => ({ ...dependency })) : [],
    widgets: Array.isArray(input.widgets) ? input.widgets : [],
    nativeOperations: Array.isArray(input.nativeOperations) ? input.nativeOperations : [],
    composites: Array.isArray(input.composites) ? input.composites : [],
  }
  if (plugin.widgets.length > PLUGIN_LIMITS.maximumWidgets) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Too many widgets.', 'widgets'))
  if (plugin.nativeOperations.length > PLUGIN_LIMITS.maximumNativeOperations) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Too many native operations.', 'nativeOperations'))
  if (plugin.composites.length > PLUGIN_LIMITS.maximumComposites) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'Too many composites.', 'composites'))
  if (plugin.widgets.length + plugin.nativeOperations.length + plugin.composites.length === 0) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.invalidField, 'At least one capability is required.', 'capabilities'))
  if (plugin.widgets.length > 0 && !plugin.permissions.includes(PLUGIN_PERMISSIONS.widgets)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.widgets}.`, 'permissions'))
  if (plugin.nativeOperations.length > 0 && !plugin.permissions.includes(PLUGIN_PERMISSIONS.nativeOperations)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.nativeOperations}.`, 'permissions'))
  if (plugin.composites.length > 0 && !plugin.permissions.includes(PLUGIN_PERMISSIONS.composites)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.missingPermission, `Missing permission ${PLUGIN_PERMISSIONS.composites}.`, 'permissions'))
  const widgetIds = new Set()
  plugin.widgets.forEach((widget, index) => {
    validateWidget(widget, `widgets[${index}]`, diagnostics, plugin)
    if (widget?.id && widgetIds.has(widget.id)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.duplicateId, `Duplicate widget id: ${widget.id}.`, `widgets[${index}].id`))
    if (widget?.id) widgetIds.add(widget.id)
  })
  const operationIds = new Set()
  plugin.nativeOperations.forEach((operation, index) => {
    validateNativeOperation(operation, `nativeOperations[${index}]`, diagnostics)
    if (operation?.id && operationIds.has(operation.id)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.duplicateOperation, `Duplicate native operation id: ${operation.id}.`, `nativeOperations[${index}].id`))
    if (operation?.id) operationIds.add(operation.id)
  })
  const compositeIds = new Set()
  plugin.composites.forEach((composite, index) => {
    validateComposite(composite, `composites[${index}]`, diagnostics, plugin)
    if (composite?.id && compositeIds.has(composite.id)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.duplicateComposite, `Duplicate composite id: ${composite.id}.`, `composites[${index}].id`))
    if (composite?.id) compositeIds.add(composite.id)
  })
  if (diagnostics.length > 0) {
    return { ok: false, code: diagnostics[0].code, message: diagnostics[0].message, diagnostics, plugin: null }
  }
  return { ok: true, plugin, diagnostics: [] }
}

// Décrit les capacités réellement déclarées par un manifeste valide.
export function getPluginCapabilities(plugin) {
  const capabilities = []
  if ((plugin?.widgets?.length ?? 0) > 0) capabilities.push(PLUGIN_CAPABILITIES.widgets)
  if ((plugin?.nativeOperations?.length ?? 0) > 0) capabilities.push(PLUGIN_CAPABILITIES.nativeOperations)
  if ((plugin?.composites?.length ?? 0) > 0) capabilities.push(PLUGIN_CAPABILITIES.composites)
  return capabilities
}

// Déclare et valide un plugin dans un script de développement.
export function definePlugin(document) {
  const result = validatePluginDocument(document)
  if (!result.ok) {
    const error = new Error(result.message)
    error.code = result.code
    error.diagnostics = result.diagnostics
    throw error
  }
  return result.plugin
}

// Déclare un widget sans le valider isolément : le manifeste complet reste la référence.
export function defineWidget(widget) {
  return widget
}

// Déclare une opération native typée.
export function defineNativeOperation(operation) {
  return operation
}

// Déclare un nœud composite de niveau A.
export function defineComposite(composite) {
  return composite
}

// Sérialise un manifeste validé pour un fichier `.sp3plugin`.
export function stringifyPluginDocument(document) {
  const result = validatePluginDocument(document)
  if (!result.ok) {
    const error = new Error(result.message)
    error.code = result.code
    error.diagnostics = result.diagnostics
    throw error
  }
  return JSON.stringify(result.plugin, null, 2)
}
