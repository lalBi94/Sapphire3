import { analyzeProgram } from './analysis.js'
import { getAvailableActions } from './actionResolver.js'
import { createContextIndex, resolveContext } from './contextResolver.js'
import { diagnosticCodes as codes } from './diagnostics.js'
import { isId, isRecord } from './model.js'
import { sameType, primitiveType, acceptsOperand, arrayType } from './primitives.js'
import { binaryOperators, unaryOperators, getNodeSchema } from './nodeSchema.js'
import { normalizeContracts } from './contracts.js'

const hardInsertionCodes = new Set([
  codes.invalidStructure, codes.missingNode, codes.invalidModule, codes.multipleParents, codes.cycle,
  codes.illegalPlacement, codes.typeMismatch, codes.invalidType, codes.voidNotAllowed,
  codes.invalidLiteral, codes.overflow, codes.underflow, codes.divisionByZero, codes.conflict,
  codes.duplicateEntryPoint, codes.invalidEntryPoint,
])

// Retire un module et tous ses nœuds propriétaires, sans effacer les références externes.
export function deleteSourceModule(project, moduleId) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!isId(moduleId)) return failure('TARGET_INVALID')
  const matches = project.modules.filter((module) => module?.id === moduleId)
  if (matches.length !== 1) return failure(matches.length ? 'TARGET_AMBIGUOUS' : 'TARGET_MISSING')
  const candidate = {
    ...project,
    modules: project.modules.filter((module) => module?.id !== moduleId),
    nodes: project.nodes.filter((node) => node?.moduleId !== moduleId),
  }
  const analysis = analyzeProgram(candidate)
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), selection: null }
}

// Compare les diagnostics par localisation stable, sans dépendre du texte traduit.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Utilise une contrainte de résultat explicite même si des enfants manquent, sans publier de faux type résolu.
function resultConstraint(root, analysis, expectedType) {
  const resolved = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === root.id)?.type
  if (resolved) return { type: resolved }
  if (['Literal', 'CastExpression'].includes(root.kind) && root.properties.type?.kind === 'primitive') return { type: primitiveType(root.properties.type.name) }
  if (['ArrayLiteral', 'ArrayCreation'].includes(root.kind) && root.properties.elementType?.kind === 'primitive') {
    const element = primitiveType(root.properties.elementType.name)
    if (!element || element.name === 'void') return { incompatible: true }
    return { type: arrayType(element) }
  }
  if (['BinaryExpression', 'UnaryExpression'].includes(root.kind)) {
    const operators = root.kind === 'BinaryExpression' ? binaryOperators : unaryOperators
    const operator = root.properties.operator
    const rule = typeof operator === 'string' && Object.hasOwn(operators, operator) ? operators[operator] : null
    if (rule?.result === 'same' && expectedType && !acceptsOperand(rule.operands, expectedType)) return { incompatible: true }
    if (rule && rule.result !== 'same') return { type: primitiveType(rule.result) }
  }
  if (root.kind === 'CallExpression') return { type: analysis.semantic.nodeTypes.find((entry) => entry.nodeId === root.children.callee)?.type?.returnType ?? null }
  return { type: null }
}

// Insère atomiquement une nouvelle arborescence, après contrôle du slot, du contexte et des types connus.
export function insertSourceNodes(project, request, bundle, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', diagnostics: [], project }
  const context = getAvailableActions(project, request?.targetId, request?.slot, options)
  // Toute erreur renvoie exactement la source précédente ; aucun enfant n'est déplacé ou écrasé.
  const failure = (code, diagnostics = []) => ({ ok: false, code, diagnostics, project })
  if (!context.ok) return failure(context.code)
  if (!context.slot) return failure('SLOT_REQUIRED')
  if (context.slot.occupied || context.slot.malformed) return failure('SLOT_OCCUPIED')
  if (!bundle?.ok || !Array.isArray(bundle.nodes) || !isId(bundle.rootId)) return failure('DRAFT_INVALID')
  const root = bundle.nodes.find((node) => node?.id === bundle.rootId)
  if (!root || !context.actions.some((action) => action.kind === root.kind && action.slot === context.slot.name)) return failure('PLACEMENT_ILLEGAL')
  const ids = new Set()
  for (const node of bundle.nodes) {
    if (!isRecord(node) || !isId(node.id) || ids.has(node.id) || context.index.nodes.has(node.id)) return failure('ID_CONFLICT')
    if (node.moduleId !== context.moduleId) return failure('MODULE_INVALID')
    if (!isRecord(node.children) || !isRecord(node.properties) || !isRecord(node.references)) return failure('DRAFT_INVALID')
    ids.add(node.id)
  }
  for (const node of bundle.nodes) {
    for (const id of Object.values(node.children).flat()) {
      if (id !== null && !ids.has(id)) return failure('EXISTING_CHILD_FORBIDDEN')
    }
  }
  const slotName = context.slot.name
  let modules = project.modules
  let nodes = project.nodes
  if (context.target.kind === 'module') {
    modules = modules.map((module) => module?.id === context.target.id ? { ...module, rootNodeIds: [...(module.rootNodeIds ?? []), bundle.rootId] } : module)
  } else {
    nodes = nodes.map((node) => node?.id === context.target.id ? {
      ...node,
      children: { ...node.children, [slotName]: context.slot.many ? [...(node.children?.[slotName] ?? []), bundle.rootId] : bundle.rootId },
    } : node)
  }
  const candidate = { ...project, modules, nodes: [...nodes, ...bundle.nodes] }
  const analysis = analyzeProgram(candidate)
  const constraint = resultConstraint(root, analysis, context.expectedType)
  if (constraint.incompatible || (context.expectedType && constraint.type && !sameType(context.expectedType, constraint.type))) return failure('TYPE_MISMATCH')
  const previous = context.index.analysis ?? analyzeProgram(project)
  const previousKeys = new Set(previous.diagnostics.map(diagnosticKey))
  const invalid = analysis.diagnostics.filter((diagnostic) => {
    const call = candidate.nodes.find((node) => node?.id === diagnostic.location.nodeId)
    const signature = call?.kind === 'CallExpression' ? analysis.semantic.nodeTypes.find((entry) => entry.nodeId === call.children?.callee)?.type : null
    const pendingArguments = diagnostic.code === codes.typeMismatch && diagnostic.location.field === 'children.arguments' && signature?.kind === 'function' && (Array.isArray(call.children?.arguments) ? call.children.arguments.length : 0) < signature.parameters.length
    const pendingLiteral = diagnostic.code === codes.invalidLiteral && call?.kind === 'Literal' && isRecord(call.properties) && !Object.hasOwn(call.properties, 'value')
    const pendingReturn = diagnostic.code === codes.typeMismatch && call?.kind === 'ReturnStatement' && diagnostic.location.field === 'children.argument' && (call.children?.argument == null || candidate.nodes.find((node) => node?.id === call.children?.argument)?.kind === 'Hole')
    return !pendingArguments && !pendingLiteral && !pendingReturn && hardInsertionCodes.has(diagnostic.code) && !previousKeys.has(diagnosticKey(diagnostic))
  })
  if (invalid.length > 0) return failure('INSERTION_INVALID', invalid)
  // Des fragments incomplets sont permis, mais aucun enregistrement neuf ne peut rester détaché.
  if (analysis.diagnostics.some((diagnostic) => diagnostic.code === codes.detached && ids.has(diagnostic.location.nodeId))) return failure('DRAFT_INVALID')
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId: bundle.rootId }
}

// Réordonne une instruction dans sa liste parente, sans recréer ni remapper aucun identifiant.
export function reorderSourceNode(project, nodeId, offset, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', project }
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analyzeProgram(project))
  const parent = index.parents.get(nodeId)?.[0]
  if (!index.nodes.has(nodeId) || !parent) return { ok: false, code: 'TARGET_INVALID', project }
  const list = parent.kind === 'module' ? index.modules.get(parent.id)?.rootNodeIds : index.nodes.get(parent.id)?.children?.[parent.slot]
  if (!Array.isArray(list)) return { ok: false, code: 'REORDER_NOT_A_LIST', project }
  const from = list.indexOf(nodeId)
  const to = from + offset
  if (from === -1) return { ok: false, code: 'TARGET_INVALID', project }
  if (to < 0 || to >= list.length) return { ok: false, code: 'REORDER_BOUNDARY', project }
  const reordered = [...list]
  reordered.splice(from, 1)
  reordered.splice(to, 0, nodeId)
  const modules = parent.kind === 'module'
    ? project.modules.map((entry) => entry?.id === parent.id ? { ...entry, rootNodeIds: reordered } : entry)
    : project.modules
  const nodes = parent.kind === 'module'
    ? project.nodes
    : project.nodes.map((entry) => entry?.id === parent.id ? { ...entry, children: { ...entry.children, [parent.slot]: reordered } } : entry)
  const candidate = { ...project, modules, nodes }
  const analysis = analyzeProgram(candidate)
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId }
}

// Modifie les contraintes attachées à un nœud sans toucher à ses propriétés ni à ses liens.
export function setSourceNodeContracts(project, nodeId, contracts) {
  if (!Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', project }
  const matches = project.nodes.filter((node) => node?.id === nodeId)
  if (matches.length !== 1) return { ok: false, code: 'TARGET_INVALID', project }
  const normalized = normalizeContracts(contracts)
  const candidate = { ...project, nodes: project.nodes.map((node) => node?.id === nodeId ? { ...node, contracts: normalized } : node) }
  const analysis = analyzeProgram(candidate)
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId }
}

// Modifie les seules propriétés configurables, en conservant tous les identifiants et liens existants.
export function updateSourceNode(project, nodeId, patch) {
  if (!isRecord(patch) || Object.keys(patch).some((key) => !['properties', 'references'].includes(key))) return { ok: false, code: 'PATCH_INVALID', project }
  if ((patch.properties !== undefined && !isRecord(patch.properties)) || (patch.references !== undefined && !isRecord(patch.references))) return { ok: false, code: 'PATCH_INVALID', project }
  if (!Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', project }
  const matches = project.nodes.filter((node) => node?.id === nodeId)
  if (matches.length !== 1) return { ok: false, code: 'TARGET_INVALID', project }
  if (patch.properties?.entryPoint === true && matches[0].properties?.entryPoint !== true && project.nodes.some((node) => node?.id !== nodeId && node?.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)) {
    return { ok: false, code: codes.duplicateEntryPoint, project }
  }
  const candidate = { ...project, nodes: project.nodes.map((node) => node?.id === nodeId ? { ...node, ...patch } : node) }
  const analysis = analyzeProgram(candidate)
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId }
}

// Retire un identifiant d'un slot unique ou multiple sans déplacer les autres entrées.
function withoutChild(children, slot, id, many) {
  if (!isRecord(children)) return children
  if (many) return { ...children, [slot]: Array.isArray(children[slot]) ? children[slot].filter((entry) => entry !== id) : children[slot] }
  return { ...children, [slot]: null }
}

// Supprime une arborescence syntaxique et son lien parent, sans réécrire les références des autres nœuds.
export function deleteSourceNodes(project, targetId, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', project }
  const context = resolveContext(project, targetId, undefined, options.index)
  if (!context.ok) return { ok: false, code: context.code, project }
  if (context.target.kind !== 'node') return { ok: false, code: 'MODULE_NOT_DELETABLE', project }
  const parent = context.index.parents.get(context.target.id)?.[0]
  if (!parent) return { ok: false, code: 'TARGET_INVALID', project }

  // Parcourt sans récursion pour retirer aussi les descendants et résister aux cycles déjà présents.
  const removed = new Set()
  const pending = [context.target.id]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!isId(id) || removed.has(id)) continue
    removed.add(id)
    const node = context.index.nodes.get(id)
    if (!node || !isRecord(node.children)) continue
    for (const value of Object.values(node.children)) {
      for (const childId of Array.isArray(value) ? value : [value]) pending.push(childId)
    }
  }

  let nodes = project.nodes.filter((node) => !removed.has(node?.id))
  let modules = project.modules
  if (parent.kind === 'module') {
    modules = modules.map((module) => module?.id === parent.id
      ? { ...module, rootNodeIds: Array.isArray(module.rootNodeIds) ? module.rootNodeIds.filter((id) => id !== context.target.id) : module.rootNodeIds }
      : module)
  } else {
    const many = Boolean(getNodeSchema(context.index.nodes.get(parent.id)?.kind)?.slots?.[parent.slot]?.many)
    nodes = nodes.map((node) => node?.id === parent.id ? { ...node, children: withoutChild(node.children, parent.slot, context.target.id, many) } : node)
  }
  const candidate = { ...project, modules, nodes }
  const analysis = analyzeProgram(candidate)
  return {
    ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), removedNodeIds: [...removed],
    selection: parent.kind === 'module' ? { kind: 'module', id: parent.id } : { kind: 'node', id: parent.id },
  }
}
